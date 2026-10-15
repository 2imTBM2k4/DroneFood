# Customer web context — payment confirmation

## Trust boundary
The browser never marks a payment paid or an order cancelled from PayOS redirect query parameters. The authenticated `/api/order/verify` endpoint owns confirmation; see [API ADR 0002](../api/docs/adr/0002-payos-on-demand-reconciliation.md).

## Customer actions
- `/verify` waits for authentication hydration, then checks server-confirmed payment for the referenced owned order. Polling is bounded to ten attempts, stops on confirmed payment or temporary provider unavailability and aborts on page exit.
- Pending unpaid PayOS orders expose **Kiểm tra thanh toán** in the list and detail. This performs one request, disables conflicting payment controls while busy, refreshes order data and refreshes the cart on confirmation. It does not create another payment link.
- A redirect or check that cannot confirm payment says confirmation is pending/unavailable, not that the bank transfer failed. Customers who already transferred money are instructed not to pay again.
- Existing **Thanh toán lại** is a distinct action, not automatic fallback after a failed check.
- The detail page consumes the existing `orderStatusUpdated` event to reload paid/status information. Order list refreshes remain ordinary reads, not gateway reconciliation sweeps.

## Limits
No background reconciliation job or automatic refund is introduced. Cancellation and payment are separate facts: a late paid cancelled order remains cancelled. Real PayOS settlement and ngrok availability need manual environment verification; automated tests use gateway doubles and an isolated database.
