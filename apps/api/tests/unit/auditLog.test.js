import { describe, it, expect, vi, beforeEach } from "vitest";
import AuditLog from "../../models/auditLogModel.cjs";
import { recordAudit } from "../../utils/auditLog.js";

describe("Audit Log Optimization & Retention", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("Filtering Read Logs", () => {
    it("drops _viewed action when actor is not an admin", async () => {
      const createSpy = vi.spyOn(AuditLog, "create");
      const result = await recordAudit({
        actor: { _id: "670000000000000000000001", role: "restaurant" },
        action: "money.transactions_viewed",
        targetType: "wallet",
        targetId: "670000000000000000000002",
      });

      expect(result).toBeNull();
      expect(createSpy).not.toHaveBeenCalled();
    });

    it("allows _viewed action when actor is an admin", async () => {
      const mockEntry = { _id: "audit-123" };
      const createSpy = vi.spyOn(AuditLog, "create").mockResolvedValue(mockEntry);

      const result = await recordAudit({
        actor: { _id: "670000000000000000000003", role: "admin" },
        action: "withdrawal.payout_details_viewed",
        targetType: "withdrawal",
        targetId: "670000000000000000000004",
      });

      expect(result).toEqual(mockEntry);
      expect(createSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("Sanitization & Truncation", () => {
    it("truncates long strings and caps oversized metadata", async () => {
      const createSpy = vi.spyOn(AuditLog, "create").mockImplementation(async (doc) => doc);

      const hugePayload = { bigArray: new Array(500).fill("long string data here to exceed size") };
      const longReason = "a".repeat(300);
      const longUserAgent = "b".repeat(200);
      const longIp = "c".repeat(100);

      const result = await recordAudit({
        actor: { _id: "670000000000000000000001", role: "admin" },
        action: "user.updated_by_admin",
        targetType: "user",
        targetId: "670000000000000000000002",
        reason: longReason,
        userAgent: longUserAgent,
        ip: longIp,
        metadata: hugePayload,
      });

      expect(result.reason.length).toBe(255);
      expect(result.userAgent.length).toBe(120);
      expect(result.ip.length).toBe(45);
      expect(result.metadata._truncated).toBe(true);
    });
  });

  describe("Schema TTL Calculation", () => {
    it("sets 5 years (1825 days) retention for money and banking categories", () => {
      const docMoney = new AuditLog({
        action: "withdrawal.requested",
        targetType: "withdrawal",
        category: "money",
      });
      const docBanking = new AuditLog({
        action: "bank_account.updated",
        targetType: "bank_account",
        category: "banking",
      });

      const now = Date.now();
      const daysDiffMoney = Math.round((docMoney.expiresAt.getTime() - now) / (1000 * 60 * 60 * 24));
      const daysDiffBanking = Math.round((docBanking.expiresAt.getTime() - now) / (1000 * 60 * 60 * 24));

      expect(daysDiffMoney).toBe(1825);
      expect(daysDiffBanking).toBe(1825);
    });

    it("sets 2 years (730 days) retention for access, security, and password categories", () => {
      const docAccess = new AuditLog({
        action: "permission.granted",
        targetType: "user",
        category: "access",
      });
      const docSecurity = new AuditLog({
        action: "security.alert",
        targetType: "user",
        category: "security",
      });
      const docPassword = new AuditLog({
        action: "password.reset",
        targetType: "user",
        category: "password",
      });

      const now = Date.now();
      const daysDiffAccess = Math.round((docAccess.expiresAt.getTime() - now) / (1000 * 60 * 60 * 24));
      const daysDiffSecurity = Math.round((docSecurity.expiresAt.getTime() - now) / (1000 * 60 * 60 * 24));
      const daysDiffPassword = Math.round((docPassword.expiresAt.getTime() - now) / (1000 * 60 * 60 * 24));

      expect(daysDiffAccess).toBe(730);
      expect(daysDiffSecurity).toBe(730);
      expect(daysDiffPassword).toBe(730);
    });

    it("sets 180 days retention for operations category by default", () => {
      const docOps = new AuditLog({
        action: "order.status_changed",
        targetType: "order",
      });

      const now = Date.now();
      const daysDiff = Math.round((docOps.expiresAt.getTime() - now) / (1000 * 60 * 60 * 24));
      expect(daysDiff).toBe(180);
    });

    it("sets 90 days retention for authentication and email categories", () => {
      const docAuth = new AuditLog({
        action: "user.login",
        targetType: "user",
        category: "authentication",
      });
      const docEmail = new AuditLog({
        action: "email.sent",
        targetType: "user",
        category: "email",
      });

      const now = Date.now();
      const daysDiffAuth = Math.round((docAuth.expiresAt.getTime() - now) / (1000 * 60 * 60 * 24));
      const daysDiffEmail = Math.round((docEmail.expiresAt.getTime() - now) / (1000 * 60 * 60 * 24));

      expect(daysDiffAuth).toBe(90);
      expect(daysDiffEmail).toBe(90);
    });

    it("records merchantId and branchId on audit entries", async () => {
      const createSpy = vi.spyOn(AuditLog, "create").mockImplementation(async (doc) => doc);

      const result = await recordAudit({
        actor: { _id: "670000000000000000000001", role: "admin" },
        action: "order.status.update",
        targetType: "order",
        targetId: "670000000000000000000002",
        merchantId: "670000000000000000000003",
        branchId: "670000000000000000000004",
      });

      expect(result.merchantId).toBe("670000000000000000000003");
      expect(result.branchId).toBe("670000000000000000000004");
    });
  });
});
