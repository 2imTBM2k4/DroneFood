import * as emailJobRepo from "../repositories/accountEmailJobRepository.js";
import * as userRepo from "../repositories/userRepository.js";
import sendEmail from "../utils/sendEmail.js";
import { logger } from "../utils/logger.js";
import { activateEmailVerificationEmail, activatePasswordResetEmail } from "./accountEmailService.js";

const LOCK_TIMEOUT_MS = 5 * 60 * 1000;
const DEFAULT_INTERVAL_MS = 5 * 1000;
const DEFAULT_PENDING_RETRY_MS = 30 * 1000;
const RESET_TOKEN_LIFETIME_MS = 15 * 60 * 1000;
const VERIFICATION_TOKEN_LIFETIME_MS = 24 * 60 * 60 * 1000;
let workerTimer = null;
let activeCycle = null;
let stopRequested = false;

const safeErrorCode = (error) => String(error?.code || error?.name || "EMAIL_DELIVERY_FAILED")
  .replace(/[^A-Za-z0-9_-]/g, "")
  .slice(0, 80);

const pendingRetryMs = () => {
  const configured = Number(process.env.ACCOUNT_EMAIL_PENDING_RESET_RETRY_MS);
  return Number.isFinite(configured) && configured >= 1000
    ? configured
    : DEFAULT_PENDING_RETRY_MS;
};

export const recoverStaleAccountEmailJobs = () => emailJobRepo.recoverStale(
  new Date(Date.now() - LOCK_TIMEOUT_MS)
);

export const reconcilePendingPasswordResetJobs = async ({ limit = 20, now = new Date() } = {}) => {
  const pendingJobs = await emailJobRepo.listPendingPasswordResets(limit, now);
  for (const job of pendingJobs) {
    const tokenIsActive = await userRepo.hasActivePasswordResetToken(
      job.userId,
      job.resetTokenHash
    );
    if (tokenIsActive) {
      await activatePasswordResetEmail({
        jobId: job._id,
        userId: job.userId,
        resetTokenHash: job.resetTokenHash,
      });
    } else {
      const tokenExpiresAt = job.resetTokenExpiresAt
        || new Date(job.createdAt.getTime() + RESET_TOKEN_LIFETIME_MS);
      if (tokenExpiresAt <= now) {
        await emailJobRepo.cancelPending(job._id, job.resetTokenHash);
      } else {
        const retryAt = new Date(Math.min(
          now.getTime() + pendingRetryMs(),
          tokenExpiresAt.getTime()
        ));
        await emailJobRepo.postponePending(job._id, job.resetTokenHash, retryAt);
      }
    }
  }
  return pendingJobs.length;
};

export const reconcilePendingVerificationJobs = async ({ limit = 20, now = new Date() } = {}) => {
  const pendingJobs = await emailJobRepo.listPendingVerifications(limit, now);
  for (const job of pendingJobs) {
    const tokenIsActive = job.verificationPurpose === "email_change"
      ? await userRepo.hasActivePendingEmailToken(job.userId, job.verificationTokenHash)
      : await userRepo.hasActiveEmailVerificationToken(job.userId, job.verificationTokenHash);
    if (tokenIsActive) {
      await activateEmailVerificationEmail({
        jobId: job._id,
        userId: job.userId,
        verificationTokenHash: job.verificationTokenHash,
        purpose: job.verificationPurpose,
      });
    } else {
      const tokenExpiresAt = job.verificationTokenExpiresAt
        || new Date(job.createdAt.getTime() + VERIFICATION_TOKEN_LIFETIME_MS);
      if (tokenExpiresAt <= now) {
        await emailJobRepo.cancelPendingVerification(job._id, job.verificationTokenHash);
      } else {
        const retryAt = new Date(Math.min(now.getTime() + pendingRetryMs(), tokenExpiresAt.getTime()));
        await emailJobRepo.postponePendingVerification(job._id, job.verificationTokenHash, retryAt);
      }
    }
  }
  return pendingJobs.length;
};

export const processNextAccountEmailJob = async () => {
  const job = await emailJobRepo.claimNext();
  if (!job) return false;

  try {
    if (job.event === "password.reset_requested") {
      const tokenIsActive = job.userId && job.resetTokenHash
        ? await userRepo.hasActivePasswordResetToken(job.userId, job.resetTokenHash)
        : false;
      if (!tokenIsActive) {
        await emailJobRepo.markCancelled(job._id);
        return true;
      }
    }
    if (["email.verification_requested", "email.change_verification_requested"].includes(job.event)) {
      const tokenIsActive = job.verificationPurpose === "email_change"
        ? await userRepo.hasActivePendingEmailToken(job.userId, job.verificationTokenHash)
        : await userRepo.hasActiveEmailVerificationToken(job.userId, job.verificationTokenHash);
      if (!tokenIsActive) {
        await emailJobRepo.markCancelled(job._id, "STALE_VERIFICATION_TOKEN");
        return true;
      }
    }
    await sendEmail({ to: job.to, subject: job.subject, html: job.html });
    await emailJobRepo.markSent(job._id);
  } catch (error) {
    const delayMs = Math.min(60 * 60 * 1000, 15 * 1000 * (2 ** Math.max(0, job.attempts - 1)));
    const errorCode = safeErrorCode(error);
    await emailJobRepo.markFailed(job._id, {
      errorCode,
      availableAt: new Date(Date.now() + delayMs),
    });
    logger.warn({
      event: job.event,
      jobId: String(job._id),
      userId: job.userId ? String(job.userId) : undefined,
      attempt: job.attempts,
      errorCode,
    }, "Account email delivery failed");
  }

  return true;
};

export const drainAccountEmailJobs = async ({ limit = 20 } = {}) => {
  let processed = 0;
  while (!stopRequested && processed < limit && await processNextAccountEmailJob()) {
    processed += 1;
  }
  return processed;
};

export const runAccountEmailWorkerCycle = () => {
  if (activeCycle) return activeCycle;
  activeCycle = (async () => {
    await recoverStaleAccountEmailJobs();
    await reconcilePendingPasswordResetJobs();
    await reconcilePendingVerificationJobs();
    if (!stopRequested) await drainAccountEmailJobs();
  })()
    .catch((error) => {
      logger.error({ errorName: error?.name || "EmailWorkerError" }, "Account email worker failed");
    })
    .finally(() => {
      activeCycle = null;
    });
  return activeCycle;
};

export const startAccountEmailWorker = () => {
  if (workerTimer) return workerTimer;
  stopRequested = false;
  void runAccountEmailWorkerCycle();
  const intervalMs = Number(process.env.ACCOUNT_EMAIL_WORKER_INTERVAL_MS) || DEFAULT_INTERVAL_MS;
  workerTimer = setInterval(() => void runAccountEmailWorkerCycle(), intervalMs);
  workerTimer.unref?.();
  return workerTimer;
};

export const stopAccountEmailWorker = async () => {
  stopRequested = true;
  if (workerTimer) clearInterval(workerTimer);
  workerTimer = null;
  if (activeCycle) await activeCycle;
};
