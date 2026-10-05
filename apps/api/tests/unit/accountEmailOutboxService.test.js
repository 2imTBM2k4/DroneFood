import { beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcrypt";
import { AccountEmailJob, User } from "../../models/index.cjs";
import {
  processNextAccountEmailJob,
  reconcilePendingPasswordResetJobs,
  runAccountEmailWorkerCycle,
  startAccountEmailWorker,
  stopAccountEmailWorker,
} from "../../services/accountEmailOutboxService.js";
import {
  activatePasswordResetEmail,
  preparePasswordResetEmail,
  queueWelcomeEmail,
} from "../../services/accountEmailService.js";
import * as userService from "../../services/userService.js";

const sendEmailMock = vi.hoisted(() => vi.fn());

vi.mock("../../utils/sendEmail.js", () => ({ default: sendEmailMock }));

describe("account email outbox", () => {
  beforeEach(async () => {
    await stopAccountEmailWorker();
    sendEmailMock.mockReset();
  });

  it("marks successful delivery as sent", async () => {
    sendEmailMock.mockResolvedValue({ messageId: "test" });
    const job = await AccountEmailJob.create({
      event: "test.sent",
      to: "hidden@test.com",
      subject: "Test",
      html: "<p>Test</p>",
      idempotencyKey: "test.sent:1",
    });

    expect(await processNextAccountEmailJob()).toBe(true);
    const stored = await AccountEmailJob.findById(job._id).select("+to +subject +html");
    expect(stored.status).toBe("sent");
    expect(stored.attempts).toBe(1);
    expect(stored.sentAt).toBeInstanceOf(Date);
  });

  it("keeps one job per idempotency key under repeated concurrent enqueue stress", async () => {
    const indexes = await AccountEmailJob.collection.indexes();
    expect(indexes.find((index) => index.key?.idempotencyKey === 1)?.unique).toBe(true);

    for (let round = 0; round < 5; round += 1) {
      const input = {
        userId: `507f1f77bcf86cd79943909${round}`,
        to: `hidden-${round}@test.com`,
        name: "Test User",
      };
      await Promise.all(Array.from({ length: 25 }, () => queueWelcomeEmail(input)));
    }
    expect(await AccountEmailJob.countDocuments({ event: "account.welcome" })).toBe(5);
  });

  it("records a retryable failure without persisting provider secrets", async () => {
    sendEmailMock.mockImplementationOnce(async () => {
      throw Object.assign(new Error("secret provider response"), { code: "ETIMEDOUT" });
    });
    const job = await AccountEmailJob.create({
      event: "test.failed",
      to: "hidden@test.com",
      subject: "Test",
      html: "<p>secret reset link</p>",
      idempotencyKey: "test.failed:1",
    });

    expect(await processNextAccountEmailJob()).toBe(true);
    const stored = await AccountEmailJob.findById(job._id);
    expect(stored.status).toBe("failed");
    expect(stored.lastErrorCode).toBe("ETIMEDOUT");
    expect(JSON.stringify(stored.toObject())).not.toContain("secret provider response");
  });

  it("reconciles a pending reset job only when its stored token matches", async () => {
    const tokenHash = "a".repeat(64);
    const user = await User.create({
      name: "Pending Reset",
      email: "pending-reset@test.com",
      password: await bcrypt.hash("password123", 10),
      resetPasswordToken: tokenHash,
      resetPasswordExpires: new Date(Date.now() + 60_000),
    });
    const job = await preparePasswordResetEmail({
      userId: user._id,
      to: user.email,
      name: user.name,
      resetUrl: "http://account-security.test/reset-password/raw-token",
      resetTokenHash: tokenHash,
    });
    expect(job.status).toBe("pending");

    await AccountEmailJob.updateOne({ _id: job._id }, { $set: { reconcileAfter: new Date(0) } });
    await reconcilePendingPasswordResetJobs();
    expect((await AccountEmailJob.findById(job._id)).status).toBe("queued");
  });

  it("does not cancel a fresh pending reset during the request activation window", async () => {
    const tokenHash = "b".repeat(64);
    const user = await User.create({
      name: "In-flight Reset",
      email: "in-flight-reset@test.com",
      password: await bcrypt.hash("password123", 10),
    });
    const job = await preparePasswordResetEmail({
      userId: user._id,
      to: user.email,
      name: user.name,
      resetUrl: "http://account-security.test/reset-password/raw-token",
      resetTokenHash: tokenHash,
    });

    await reconcilePendingPasswordResetJobs();
    expect((await AccountEmailJob.findById(job._id)).status).toBe("pending");

    await User.updateOne({ _id: user._id }, {
      $set: {
        resetPasswordToken: tokenHash,
        resetPasswordExpires: new Date(Date.now() + 60_000),
      },
    });
    const activation = await activatePasswordResetEmail({
      jobId: job._id,
      userId: user._id,
      resetTokenHash: tokenHash,
    });

    expect(activation.activated).toBe(true);
    expect((await AccountEmailJob.findById(job._id)).status).toBe("queued");
  });

  it("recovers after a crash between token persistence and direct activation", async () => {
    const tokenHash = "f".repeat(64);
    const firstReconcileAt = new Date(Date.now() + 31_000);
    const tokenExpiresAt = new Date(Date.now() + 15 * 60_000);
    const user = await User.create({
      name: "Crash Boundary Reset",
      email: "crash-boundary-reset@test.com",
      password: await bcrypt.hash("password123", 10),
    });
    const job = await preparePasswordResetEmail({
      userId: user._id,
      to: user.email,
      name: user.name,
      resetUrl: "http://account-security.test/reset-password/current-token",
      resetTokenHash: tokenHash,
      resetTokenExpiresAt: tokenExpiresAt,
    });

    await reconcilePendingPasswordResetJobs({ now: firstReconcileAt });
    let storedJob = await AccountEmailJob.findById(job._id);
    expect(storedJob.status).toBe("pending");
    expect(storedJob.reconcileAfter.getTime()).toBeGreaterThan(firstReconcileAt.getTime());

    await User.updateOne({ _id: user._id }, {
      $set: {
        resetPasswordToken: tokenHash,
        resetPasswordExpires: tokenExpiresAt,
      },
    });
    const laterReconcileAt = new Date(storedJob.reconcileAfter.getTime() + 1);
    await reconcilePendingPasswordResetJobs({ now: laterReconcileAt });
    expect((await AccountEmailJob.findById(job._id)).status).toBe("queued");

    sendEmailMock.mockResolvedValue({ messageId: "current-link" });
    expect(await processNextAccountEmailJob()).toBe(true);
    storedJob = await AccountEmailJob.findById(job._id);
    expect(storedJob.status).toBe("sent");
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });

  it("retires an orphaned pending reset at token expiry without a busy loop", async () => {
    const now = new Date();
    const user = await User.create({
      name: "Orphan Reset",
      email: "orphan-reset@test.com",
      password: await bcrypt.hash("password123", 10),
    });
    const job = await preparePasswordResetEmail({
      userId: user._id,
      to: user.email,
      name: user.name,
      resetUrl: "http://account-security.test/reset-password/orphan-token",
      resetTokenHash: "1".repeat(64),
      resetTokenExpiresAt: new Date(now.getTime() + 1000),
    });

    const afterExpiry = new Date(now.getTime() + 31_000);
    expect(await reconcilePendingPasswordResetJobs({ now: afterExpiry })).toBe(1);
    const stored = await AccountEmailJob.findById(job._id);
    expect(stored.status).toBe("cancelled");
    expect(stored.expiresAt).toBeInstanceOf(Date);
    expect(await reconcilePendingPasswordResetJobs({ now: new Date(afterExpiry.getTime() + 60_000) })).toBe(0);
  });

  it("recovers a cancelled reset job when the matching token is now active", async () => {
    const tokenHash = "c".repeat(64);
    const user = await User.create({
      name: "Recovered Reset",
      email: "recovered-reset@test.com",
      password: await bcrypt.hash("password123", 10),
      resetPasswordToken: tokenHash,
      resetPasswordExpires: new Date(Date.now() + 60_000),
    });
    const job = await preparePasswordResetEmail({
      userId: user._id,
      to: user.email,
      name: user.name,
      resetUrl: "http://account-security.test/reset-password/raw-token",
      resetTokenHash: tokenHash,
    });
    await AccountEmailJob.updateOne({ _id: job._id }, { $set: { status: "cancelled" } });

    const activation = await activatePasswordResetEmail({
      jobId: job._id,
      userId: user._id,
      resetTokenHash: tokenHash,
    });

    expect(activation).toEqual({ activated: true, recovered: true });
    expect((await AccountEmailJob.findById(job._id)).status).toBe("queued");
  });

  it("sends only the current link after concurrent forgot-password requests", async () => {
    const user = await User.create({
      name: "Concurrent Forgot",
      email: "concurrent-forgot@test.com",
      password: await bcrypt.hash("password123", 10),
    });
    sendEmailMock.mockResolvedValue({ messageId: "test" });

    await Promise.all([
      userService.forgotPassword(user.email),
      userService.forgotPassword(user.email),
    ]);
    while (await processNextAccountEmailJob()) {
      // Drain both current and stale jobs deterministically.
    }

    const jobs = await AccountEmailJob.find({ event: "password.reset_requested" })
      .select("status +resetTokenHash");
    const storedUser = await User.findById(user._id).select("+resetPasswordToken");
    const sent = jobs.filter((job) => job.status === "sent");
    const cancelled = jobs.filter((job) => job.status === "cancelled");
    expect(jobs).toHaveLength(2);
    expect(sent).toHaveLength(1);
    expect(cancelled).toHaveLength(1);
    expect(sent[0].resetTokenHash).toBe(storedUser.resetPasswordToken);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });

  it("cancels a queued stale reset before contacting SMTP", async () => {
    const currentTokenHash = "d".repeat(64);
    const staleTokenHash = "e".repeat(64);
    const user = await User.create({
      name: "Stale Reset",
      email: "stale-reset@test.com",
      password: await bcrypt.hash("password123", 10),
      resetPasswordToken: currentTokenHash,
      resetPasswordExpires: new Date(Date.now() + 60_000),
    });
    const job = await AccountEmailJob.create({
      event: "password.reset_requested",
      userId: user._id,
      to: user.email,
      subject: "Test",
      html: "<p>stale reset link</p>",
      idempotencyKey: "password.reset_requested:stale-test",
      status: "queued",
      resetTokenHash: staleTokenHash,
    });
    sendEmailMock.mockResolvedValue({ messageId: "must-not-send" });

    expect(await processNextAccountEmailJob()).toBe(true);
    expect((await AccountEmailJob.findById(job._id)).status).toBe("cancelled");
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("does not overlap worker cycles", async () => {
    let releaseDelivery;
    sendEmailMock.mockImplementationOnce(() => new Promise((resolve) => {
      releaseDelivery = resolve;
    }));
    await AccountEmailJob.create({
      event: "test.non-overlap",
      to: "hidden@test.com",
      subject: "Test",
      html: "<p>Test</p>",
      idempotencyKey: "test.non-overlap:1",
    });

    startAccountEmailWorker();
    await vi.waitFor(() => expect(releaseDelivery).toBeTypeOf("function"));
    const second = runAccountEmailWorkerCycle();
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    releaseDelivery({ messageId: "done" });
    await second;
    await stopAccountEmailWorker();
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });

  it("waits for in-flight delivery during graceful stop", async () => {
    let releaseDelivery;
    sendEmailMock.mockImplementationOnce(() => new Promise((resolve) => {
      releaseDelivery = resolve;
    }));
    await AccountEmailJob.create({
      event: "test.graceful-stop",
      to: "hidden@test.com",
      subject: "Test",
      html: "<p>Test</p>",
      idempotencyKey: "test.graceful-stop:1",
    });

    startAccountEmailWorker();
    await vi.waitFor(() => expect(releaseDelivery).toBeTypeOf("function"));
    let stopped = false;
    const stopping = stopAccountEmailWorker().then(() => { stopped = true; });
    await Promise.resolve();
    expect(stopped).toBe(false);
    releaseDelivery({ messageId: "done" });
    await stopping;
    expect(stopped).toBe(true);
  });
});
