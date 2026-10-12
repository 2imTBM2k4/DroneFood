import AuditLog from "../models/auditLogModel.cjs";

const MAX_STRING_LENGTH = {
  reason: 255,
  userAgent: 120,
  ip: 45,
};

const MAX_METADATA_BYTES = 2048;

function truncate(str, max) {
  if (typeof str !== "string") return "";
  return str.length > max ? str.slice(0, max) : str;
}

function sanitizeMetadata(metadata) {
  if (!metadata || typeof metadata !== "object") return {};
  try {
    const jsonStr = JSON.stringify(metadata);
    if (jsonStr.length > MAX_METADATA_BYTES) {
      return {
        _truncated: true,
        _originalSize: jsonStr.length,
        summary: jsonStr.slice(0, 500),
      };
    }
    return JSON.parse(jsonStr);
  } catch {
    return {};
  }
}

/**
 * Write one entry to the audit trail.
 *
 * Deliberately swallows its own errors: an audit write must never be the
 * reason a legitimate business action fails. A failure is logged to the
 * server console so it is still visible in operations.
 */
export async function recordAudit({
  actor,
  action,
  targetType,
  targetId,
  merchantId = null,
  branchId = null,
  reason = "",
  metadata = {},
  category = "operations",
  outcome = "success",
  ip = "",
  userAgent = "",
  expiresAt,
}) {
  try {
    if (!action || !targetType) return null;

    // Filter out passive/read actions from regular non-admin users to avoid log bloat
    if (action.endsWith("_viewed") && actor?.role !== "admin") {
      return null;
    }

    return await AuditLog.create({
      actor: actor?._id || null,
      actorEmail: actor?.email || "",
      actorRole: actor?.role || "",
      category,
      outcome,
      ip: truncate(ip, MAX_STRING_LENGTH.ip),
      userAgent: truncate(userAgent, MAX_STRING_LENGTH.userAgent),
      action,
      targetType,
      targetId,
      merchantId,
      branchId,
      reason: truncate(reason, MAX_STRING_LENGTH.reason),
      metadata: sanitizeMetadata(metadata),
      ...(expiresAt ? { expiresAt } : {}),
    });
  } catch (error) {
    console.error("Audit log write failed:", error.message, { action });
    return null;
  }
}
