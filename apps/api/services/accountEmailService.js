import * as emailJobRepo from "../repositories/accountEmailJobRepository.js";
import * as userRepo from "../repositories/userRepository.js";
import { logger } from "../utils/logger.js";

const DEFAULT_PENDING_RESET_GRACE_MS = 30 * 1000;
const RESET_TOKEN_LIFETIME_MS = 15 * 60 * 1000;
const VERIFICATION_TOKEN_LIFETIME_MS = (Number(process.env.EMAIL_VERIFICATION_TOKEN_LIFETIME_MS) || 15 * 60) * 1000;
const resetDeliveryStates = new Set(["queued", "processing", "sent", "failed"]);

const pendingResetGraceMs = () => {
  const configured = Number(process.env.ACCOUNT_EMAIL_PENDING_RESET_GRACE_MS);
  return Number.isFinite(configured) && configured >= 1000
    ? configured
    : DEFAULT_PENDING_RESET_GRACE_MS;
};

const BRAND = {
  name: "Drone Food",
  color: "#ff5b39",
  background: "#f8fafc",
  text: "#172554",
};

const escapeHtml = (value = "") => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const layout = ({ title, intro, body = "", actionLabel, actionUrl, footer }) => `
  <!doctype html>
  <html lang="vi">
    <body style="margin:0;background:${BRAND.background};font-family:Arial,sans-serif;color:${BRAND.text};">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:28px 12px;">
        <tr><td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
            <tr><td style="padding:22px 28px;background:${BRAND.color};color:#ffffff;font-size:22px;font-weight:700;">${BRAND.name}</td></tr>
            <tr><td style="padding:30px 28px;">
              <h1 style="margin:0 0 14px;font-size:24px;line-height:1.3;">${title}</h1>
              <p style="margin:0 0 18px;line-height:1.65;color:#475569;">${intro}</p>
              ${body}
              ${actionLabel && actionUrl ? `<p style="margin:26px 0;"><a href="${escapeHtml(actionUrl)}" style="display:inline-block;padding:13px 22px;border-radius:10px;background:${BRAND.color};color:#ffffff;text-decoration:none;font-weight:700;">${actionLabel}</a></p>` : ""}
              <p style="margin:22px 0 0;line-height:1.6;color:#64748b;font-size:13px;">${footer}</p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
  </html>
`;

const enqueue = (job) => emailJobRepo.enqueue(job);

const enqueueBestEffort = async (job) => {
  try {
    await enqueue(job);
    return true;
  } catch (error) {
    // Never log the recipient, rendered HTML, reset URL, or provider details.
    logger.warn({
      event: job.event,
      userId: job.userId ? String(job.userId) : undefined,
      errorName: error?.name || "EmailQueueError",
      errorCode: error?.code || undefined,
    }, "Could not queue account email");
    return false;
  }
};

export const queueWelcomeEmail = ({ userId, to, name }) => enqueueBestEffort({
  event: "account.welcome",
  userId,
  to,
  idempotencyKey: `account.welcome:${userId}`,
  subject: "Chào mừng bạn đến với Drone Food",
  html: layout({
    title: `Xin chào ${escapeHtml(name || "bạn")}!`,
    intro: "Tài khoản Drone Food của bạn đã được tạo thành công.",
    body: '<p style="margin:0;line-height:1.65;color:#475569;">Bạn có thể đăng nhập và sử dụng các chức năng phù hợp với tài khoản của mình.</p>',
    footer: "Nếu bạn không tạo tài khoản này, vui lòng liên hệ bộ phận hỗ trợ Drone Food.",
  }),
});

export const prepareEmailVerificationEmail = ({
  userId,
  to,
  name,
  verificationUrl,
  verificationTokenHash,
  purpose = "registration",
  verificationTokenExpiresAt = new Date(Date.now() + VERIFICATION_TOKEN_LIFETIME_MS),
}) => enqueue({
  event: purpose === "email_change"
    ? "email.change_verification_requested"
    : "email.verification_requested",
  userId,
  to,
  idempotencyKey: `email.verification:${purpose}:${verificationTokenHash}`,
  status: "pending",
  verificationTokenHash,
  verificationTokenExpiresAt,
  verificationPurpose: purpose,
  reconcileAfter: new Date(Date.now() + pendingResetGraceMs()),
  subject: purpose === "email_change"
    ? "Xác nhận địa chỉ email mới cho Drone Food"
    : "Xác minh tài khoản Drone Food",
  html: layout({
    title: purpose === "email_change" ? "Xác nhận email mới" : "Xác minh địa chỉ email",
    intro: `Xin chào ${escapeHtml(name || "bạn")}, hãy xác nhận địa chỉ email này để hoàn tất ${purpose === "email_change" ? "việc thay đổi email đăng nhập" : "đăng ký tài khoản"}.`,
    body: '<p style="margin:0;line-height:1.65;color:#475569;">Liên kết có hiệu lực trong 15 phút và chỉ dùng được một lần.</p>',
    actionLabel: "Xác nhận email",
    actionUrl: verificationUrl,
    footer: "Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email và liên hệ bộ phận hỗ trợ nếu cần.",
  }),
});

export const activateEmailVerificationEmail = async ({
  jobId,
  userId,
  verificationTokenHash,
  purpose,
}) => {
  try {
    const tokenIsActive = purpose === "email_change"
      ? await userRepo.hasActivePendingEmailToken(userId, verificationTokenHash)
      : await userRepo.hasActiveEmailVerificationToken(userId, verificationTokenHash);
    if (!tokenIsActive) {
      await emailJobRepo.cancelPendingVerification(jobId, verificationTokenHash);
      return { activated: false, reason: "stale_token" };
    }

    const activation = await emailJobRepo.activatePendingVerification(jobId, verificationTokenHash);
    if (activation.matchedCount === 1) return { activated: true, recovered: false };

    let state = await emailJobRepo.findVerificationJobState(jobId, verificationTokenHash);
    if (state && resetDeliveryStates.has(state.status)) return { activated: true, recovered: false };

    const recovery = await emailJobRepo.recoverVerificationJob(jobId, verificationTokenHash);
    if (recovery.matchedCount === 1) return { activated: true, recovered: true };

    state = await emailJobRepo.findVerificationJobState(jobId, verificationTokenHash);
    return state && resetDeliveryStates.has(state.status)
      ? { activated: true, recovered: false }
      : { activated: false, reason: "retry_pending" };
  } catch (error) {
    logger.warn({
      jobId: String(jobId),
      userId: String(userId),
      errorName: error?.name || "VerificationEmailActivationError",
      errorCode: error?.code || undefined,
    }, "Email verification activation will be retried");
    return { activated: false, reason: "retry_pending" };
  }
};

export const cancelEmailVerificationEmail = (jobId, verificationTokenHash) =>
  emailJobRepo.cancelPendingVerification(jobId, verificationTokenHash);

export const queueEmailChangeNotice = ({ userId, to, name, completed, authVersion }) => enqueueBestEffort({
  event: completed ? "email.changed" : "email.change_requested",
  userId,
  to,
  idempotencyKey: completed
    ? `email.changed:${userId}:${authVersion}`
    : `email.change_requested:${userId}:${Date.now()}`,
  subject: completed ? "Email đăng nhập Drone Food đã được thay đổi" : "Yêu cầu thay đổi email Drone Food",
  html: layout({
    title: completed ? "Email đăng nhập đã thay đổi" : "Đã nhận yêu cầu đổi email",
    intro: `Xin chào ${escapeHtml(name || "bạn")}, ${completed ? "email đăng nhập của tài khoản vừa được thay đổi và các phiên cũ đã bị thu hồi." : "chúng tôi vừa nhận được yêu cầu thay đổi email đăng nhập của tài khoản."}`,
    footer: "Nếu bạn không thực hiện yêu cầu này, hãy đổi mật khẩu ngay và liên hệ bộ phận hỗ trợ Drone Food.",
  }),
});

// Password reset uses a standalone-Mongo-safe three-step protocol:
// prepare a durable pending job, persist the matching User token, then
// activate the job. The worker reconciles a crash between the last two steps.
export const preparePasswordResetEmail = ({
  userId,
  to,
  name,
  resetUrl,
  resetTokenHash,
  resetTokenExpiresAt = new Date(Date.now() + RESET_TOKEN_LIFETIME_MS),
}) => enqueue({
  event: "password.reset_requested",
  userId,
  to,
  idempotencyKey: `password.reset_requested:${resetTokenHash}`,
  status: "pending",
  resetTokenHash,
  resetTokenExpiresAt,
  reconcileAfter: new Date(Date.now() + pendingResetGraceMs()),
  subject: "Đặt lại mật khẩu Drone Food",
  html: layout({
    title: "Yêu cầu đặt lại mật khẩu",
    intro: `Xin chào ${escapeHtml(name || "bạn")}, chúng tôi đã nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.`,
    body: '<p style="margin:0;line-height:1.65;color:#475569;">Liên kết có hiệu lực trong 15 phút và chỉ dùng được một lần.</p>',
    actionLabel: "Đặt lại mật khẩu",
    actionUrl: resetUrl,
    footer: "Nếu bạn không gửi yêu cầu này, hãy bỏ qua email. Mật khẩu hiện tại của bạn vẫn được giữ nguyên.",
  }),
});

export const activatePasswordResetEmail = async ({ jobId, userId, resetTokenHash }) => {
  try {
    const tokenIsActive = await userRepo.hasActivePasswordResetToken(userId, resetTokenHash);
    if (!tokenIsActive) {
      await emailJobRepo.cancelPending(jobId, resetTokenHash);
      return { activated: false, reason: "stale_token" };
    }

    const activation = await emailJobRepo.activatePending(jobId, resetTokenHash);
    if (activation.matchedCount === 1) return { activated: true, recovered: false };

    let state = await emailJobRepo.findResetJobState(jobId, resetTokenHash);
    if (state && resetDeliveryStates.has(state.status)) {
      return { activated: true, recovered: false };
    }

    // A stale reconciler may have cancelled the job just before the request
    // persisted its token. Re-checking the User token above makes this retry safe.
    const recovery = await emailJobRepo.recoverResetJob(jobId, resetTokenHash);
    if (recovery.matchedCount === 1) return { activated: true, recovered: true };

    state = await emailJobRepo.findResetJobState(jobId, resetTokenHash);
    if (state && resetDeliveryStates.has(state.status)) {
      return { activated: true, recovered: false };
    }

    logger.warn({ jobId: String(jobId), userId: String(userId) }, "Password reset email remains pending for retry");
    return { activated: false, reason: "retry_pending" };
  } catch (error) {
    logger.warn({
      jobId: String(jobId),
      userId: String(userId),
      errorName: error?.name || "ResetEmailActivationError",
      errorCode: error?.code || undefined,
    }, "Password reset email activation will be retried");
    return { activated: false, reason: "retry_pending" };
  }
};

export const cancelPasswordResetEmail = (jobId, resetTokenHash) =>
  emailJobRepo.cancelPending(jobId, resetTokenHash);

export const queuePasswordChangedEmail = ({ userId, to, name, source, authVersion }) => enqueueBestEffort({
  event: source === "reset" ? "password.reset_succeeded" : "password.changed",
  userId,
  to,
  idempotencyKey: `password.changed:${userId}:${authVersion}`,
  subject: "Mật khẩu Drone Food đã được thay đổi",
  html: layout({
    title: "Mật khẩu đã được thay đổi",
    intro: `Xin chào ${escapeHtml(name || "bạn")}, mật khẩu tài khoản Drone Food của bạn vừa được thay đổi thành công.`,
    body: '<p style="margin:0;line-height:1.65;color:#475569;">Các phiên đăng nhập cũ đã được đóng. Hãy đăng nhập lại bằng mật khẩu mới trên thiết bị của bạn.</p>',
    footer: "Nếu bạn không thực hiện thay đổi này, hãy dùng chức năng Quên mật khẩu ngay và liên hệ bộ phận hỗ trợ.",
  }),
});
