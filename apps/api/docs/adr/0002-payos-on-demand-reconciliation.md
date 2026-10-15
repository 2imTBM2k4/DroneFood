# ADR 0002 — PayOS on-demand reconciliation

Date: 2026-10-15
Status: Accepted

## Context
A customer's bank transfer can succeed while the signed webhook cannot reach a local API (for example, when its ngrok tunnel is stopped). A browser redirect is not payment evidence. Previously `/api/order/verify` only read the stored paid flag, so it could not recover a missed webhook.

## Decision
- Keep the signed PayOS webhook as the primary confirmation path.
- The authenticated verify endpoint checks ownership first. Only unpaid PAYOS orders in `pending_payment`, with a persisted gateway attempt, may query PayOS on demand. List/detail reads do not reconcile all orders.
- Query by the stored payment link ID, falling back to the stored numeric order code. Use the SDK's response-signature validation, an 8-second timeout and no SDK retries. Provider failures leave the order unpaid and return a retryable, sanitized result.
- Accept reconciliation only for `PAID`, the exact attempt ID/code and order amount, sufficient finite paid amount and zero remaining balance. Browser payment/cancellation parameters never authorize an update.
- Share a conditional payment claim between reconciliation and the webhook. The condition includes the observed gateway attempt, order amount, order status and unpaid flag. A conflicting request reloads current state rather than overwriting it.
- Only the first claim activates `pending_payment` into `pending`, starts a shipper deadline or dispatches a drone. Duplicates do not repeat these effects. Existing transactional cart cleanup and notification event keys retain their idempotency.
- Late money on a cancelled/refund/completed order is recorded without reopening it or offering it for delivery. A warning identifies late-payment cases requiring manual investigation; this does not automatically initiate or claim a refund.
- An unpaid cancellation requires PayOS to confirm a matching cancelled/expired link with zero received money. Transport errors and paid/partially paid links block cancellation. A conditional local claim prevents an in-flight cancellation from overwriting a concurrent confirmation. Release delivery resources only after that claim succeeds.
- Confirmation emits the existing customer `orderStatusUpdated` event. Both redirect verification and explicit customer checks use the same endpoint.

## Consequences
This is a small on-demand recovery mechanism, not a background reconciliation service. Request-level deduplication does not guarantee durable exactly-once delivery effects across process crashes. If the process stops after recording payment but before dispatch/notification, operational recovery is still required; no outbox, queue or automatic refund subsystem is introduced here.

A cancelled order is not automatically queried by the customer verify endpoint. Late money is recorded when a valid webhook arrives (or a request that began before cancellation finishes); a cancelled order with a missing webhook still requires manual gateway investigation.
