# DroneFood — Kế hoạch triển khai module Thanh toán & Ví (Wallet)

## 1. Tóm tắt nghiệp vụ đã chốt

| Actor | Quy tắc |
|---|---|
| Khách hàng | VNPAY luôn khả dụng. COD chỉ hiện khi đơn được gán giao bằng **shipper người** (drone không nhận COD). |
| Nhà hàng | Đơn `delivered` → `giá trị đơn − hoa hồng%` vào **RestaurantWallet** (có trạng thái *pending settlement* trước khi khả dụng để rút). Rút: ≥500k/lần, ≤3 lần/ngày. |
| Shipper — Ký quỹ | Nạp tối thiểu 350k khi tham gia, có thể nạp thêm nhiều lần, **không bao giờ âm**. Là "quỹ đệm" xác định trần âm cho ví earnings. Hoàn lại khi huỷ tài khoản (trừ nợ nếu có). |
| Shipper — Ví earnings | Nhận 85% phí ship (đơn VNPAY, cộng ngay khi giao xong). Là ví **duy nhất được phép âm**. Đơn COD giao xong → tự động trừ (tiền hàng + 15% hoa hồng nền tảng) khỏi ví này. Rút: ≥500k/lần, ≤3 lần/ngày, chỉ khi dương. |
| Shipper — Ngưỡng | Trần âm = `-75% × ký quỹ hiện tại`. Cảnh báo sớm ở `-50% × ký quỹ hiện tại`. Chạm `-75%` → khoá nhận đơn mới, mở lại khi nạp thêm ký quỹ hoặc earnings dương trở lại trên ngưỡng. |
| Drone | Không có ví, không nhận COD. Phí giao 100% về nền tảng. |
| Admin | Cấu hình hoa hồng/tỷ lệ/ký quỹ/ngưỡng, duyệt rút tiền, duyệt huỷ tài khoản shipper (net-off ký quỹ), xử lý tranh chấp/hoàn tiền. |

## 2. Các quyết định thiết kế quan trọng

- Ký quỹ và ví earnings là **2 entity tách biệt** — không dùng chung số dư.
- Ngưỡng cảnh báo/khoá tính **động theo ký quỹ hiện tại**, không phải số cố định — nạp thêm ký quỹ sẽ tự nới trần âm.
- Hoa hồng/tỷ lệ áp dụng cho một đơn nên **snapshot tại thời điểm đặt đơn**, tránh việc admin đổi cấu hình sau này làm sai lệch dữ liệu lịch sử.
- Mọi biến động số dư đi qua một bảng **Transaction/Ledger** dùng chung, không sửa trực tiếp field `balance` mà không ghi log — để audit và test được.

## 3. Kế hoạch triển khai theo giai đoạn

### Giai đoạn 0 — Cấu hình nền tảng
- Model `PlatformConfig`: `restaurantCommissionRate`, `shipperFeeShareRate` (85%), `minShipperDeposit` (350k), `warningThresholdRate` (-50%), `lockThresholdRate` (-75%), `minWithdrawal` (500k), `maxWithdrawalsPerDay` (3).
- API admin CRUD cấu hình (chỉ 1 bản ghi active, có lịch sử thay đổi).

### Giai đoạn 1 — Data model
- `RestaurantWallet`: `restaurantId`, `availableBalance`, `pendingBalance`.
- `ShipperDeposit`: `shipperId`, `balance` (≥0), lịch sử nạp.
- `ShipperEarningsWallet`: `shipperId`, `balance` (có thể âm).
- `WalletTransaction` (ledger dùng chung): `ownerType` (restaurant/shipper_deposit/shipper_earnings), `ownerId`, `type` (order_settlement/cod_deduction/withdrawal/deposit_topup/deposit_refund/deposit_forfeit), `amount`, `balanceAfter`, `orderId?`, `createdAt`.
- `WithdrawalRequest`: `actorType`, `actorId`, `amount`, `status` (pending/approved/rejected/completed), `reviewedBy?`, timestamps.
- Bổ sung snapshot hoa hồng vào `Order`: `commissionRate`, `shipperFeeShareRate` tại thời điểm đặt đơn.

### Giai đoạn 2 — Service layer (Controller → Service → Repository)
- `CommissionService`: snapshot hoa hồng/tỷ lệ vào đơn khi tạo đơn.
- `RestaurantSettlementService`: cộng ví nhà hàng khi đơn `delivered`, xử lý *pending → available* sau khoảng thời gian đối soát.
- `ShipperSettlementService`:
  - Đơn VNPAY giao bằng shipper người → cộng 85% phí ship vào `ShipperEarningsWallet`.
  - Đơn COD giao xong → trừ (giá trị đơn + 15% hoa hồng) khỏi `ShipperEarningsWallet`; tính lại trạng thái ngưỡng dựa trên `ShipperDeposit.balance` hiện tại.
- `DepositService`: nạp ký quỹ (không giới hạn số lần), validate không âm, tự động mở khoá nhận đơn nếu earnings vượt lại ngưỡng.
- `WithdrawalService`: validate min 500k / max 3 lần/ngày theo actor, tạo `WithdrawalRequest`, xử lý duyệt.
- `AccountClosureService` (shipper): khi huỷ tài khoản, nếu earnings âm → trừ vào ký quỹ, hoàn phần dư còn lại; ghi log đầy đủ.

### Giai đoạn 3 — Middleware / guard
- Middleware chặn shipper nhận đơn mới nếu `earningsBalance ≤ -75% × depositBalance`.
- Response cảnh báo (không chặn) khi `earningsBalance ≤ -50% × depositBalance`.
- Middleware chặn tạo đơn COD nếu đơn được gán giao bằng drone.

### Giai đoạn 4 — API endpoints
- Nhà hàng: `GET /wallet`, `GET /wallet/transactions`, `POST /wallet/withdrawals`.
- Shipper: `GET /deposit`, `POST /deposit/topup`, `GET /earnings-wallet`, `GET /earnings-wallet/transactions`, `POST /earnings-wallet/withdrawals`, `GET /account-status` (đang khoá/cảnh báo hay bình thường).
- Admin: `GET/PATCH /withdrawals/:id`, `GET /shippers/locked`, `POST /shippers/:id/close-account`, `GET/PUT /platform-config`.

### Giai đoạn 5 — Testing (theo tiêu chuẩn đã thống nhất: test phải phản ánh đúng logic nghiệp vụ thực tế)
- Unit test từng service, đặc biệt: ngưỡng tính động theo ký quỹ thay đổi theo thời gian, rounding tiền tệ, race condition khi 2 đơn COD trừ ví cùng lúc.
- Integration test luồng đầy đủ: tạo đơn COD → giao xong → trừ ví → chạm ngưỡng → khoá nhận đơn → nạp ký quỹ → mở khoá lại.
- Edge case bắt buộc: huỷ tài khoản khi ví đang âm, rút tiền khi dưới mức tối thiểu, rút quá 3 lần/ngày, đơn bị huỷ sau khi đã settlement (reversal).

## 4. Prompt để đưa cho Claude Code

```
Bối cảnh dự án: DroneFood là web sàn thương mại đồ ăn giao bằng drone (repo:
https://github.com/2imTBM2k4/DroneFood). Backend: Node.js 20 + Express.js 4,
kiến trúc Controller → Service → Repository, MongoDB + Mongoose, JWT
access/refresh token, Joi validation, test bằng Vitest + Supertest +
mongodb-memory-server. Có 3 app: user, restaurant, admin, và đang bổ sung
app mobile riêng cho shipper (người giao hàng, khác với drone).

Nhiệm vụ: triển khai module Thanh toán & Ví (Wallet) theo đúng nghiệp vụ sau,
KHÔNG tự thêm/bớt quy tắc nếu chưa hỏi lại tôi:

1. Khách hàng thanh toán VNPAY hoặc COD. COD chỉ được phép khi đơn được gán
   giao bằng shipper người (không áp dụng khi giao bằng drone).

2. Nhà hàng có RestaurantWallet: khi đơn ở trạng thái "delivered", cộng
   (giá trị đơn - hoa hồng%) vào ví, ở trạng thái "pending" một khoảng thời
   gian đối soát trước khi chuyển "available" để rút. Rút tiền: tối thiểu
   500k/lần, tối đa 3 lần/ngày.

3. Shipper (người) có 2 khoản tách biệt:
   - ShipperDeposit (ký quỹ): tối thiểu 350k khi tham gia, có thể nạp thêm
     nhiều lần, KHÔNG BAO GIỜ được âm.
   - ShipperEarningsWallet (ví earnings): nhận 85% phí giao hàng khi đơn
     thanh toán trước (VNPAY) giao thành công. Là ví DUY NHẤT được phép âm.

4. Khi shipper giao xong một đơn COD: hệ thống tự động trừ
   (tiền hàng + 15% hoa hồng nền tảng) khỏi ShipperEarningsWallet.
   - Trần âm cho phép = -75% × ShipperDeposit.balance hiện tại (tính động,
     không phải số cố định — nếu shipper nạp thêm ký quỹ, trần âm tự nới ra).
   - Cảnh báo sớm khi earnings ≤ -50% × deposit hiện tại (không chặn nhận đơn).
   - Khoá không cho nhận đơn mới khi earnings ≤ -75% × deposit hiện tại;
     tự mở khoá lại khi nạp thêm ký quỹ hoặc earnings hồi phục trên ngưỡng.

5. Drone không có ví, không nhận đơn COD. Phí giao khi dùng drone: 100% về
   nền tảng (không chia %).

6. Khi shipper huỷ tài khoản lúc ShipperEarningsWallet đang âm: trừ thẳng
   khoản âm đó vào ShipperDeposit, hoàn lại phần dư ký quỹ còn lại (nếu có).
   Nếu earnings không âm, hoàn toàn bộ ký quỹ.

7. Mọi thay đổi số dư (nhà hàng, ký quỹ, earnings) phải ghi vào một bảng
   ledger dùng chung (WalletTransaction) — không sửa trực tiếp field balance
   mà không có bản ghi giao dịch tương ứng.

8. Hoa hồng nhà hàng và tỷ lệ chia phí ship (85/15) phải được snapshot vào
   đơn hàng tại thời điểm đặt đơn, không đọc config hiện tại khi settlement,
   để tránh việc đổi cấu hình sau này làm sai lệch dữ liệu đơn cũ.

Yêu cầu về cách làm việc:
- Nếu có điểm nào trong nghiệp vụ trên chưa đủ rõ để code (ví dụ: cấu trúc
  API cụ thể, format response, quy tắc duyệt rút tiền tự động hay cần admin
  duyệt thủ công), hãy hỏi lại tôi trước, không tự giả định.
- Comment hàm viết bằng tiếng Anh, mô tả rõ chức năng.
- Viết test phản ánh ĐÚNG logic nghiệp vụ thực tế ở trên (đặc biệt: ngưỡng
  âm tính động theo ký quỹ hiện tại, reversal khi đơn bị huỷ sau khi đã
  settlement, race condition khi nhiều đơn COD trừ ví gần như cùng lúc) —
  không chấp nhận test pass nhưng sai logic thực tế.
- Trước khi báo hoàn thành, tự kiểm tra lại (self-review/chạy test) và báo
  cáo rõ đã test những gì, kết quả ra sao.
- Đề xuất trước cấu trúc file/module (models, services, controllers, routes,
  tests) theo đúng kiến trúc Controller → Service → Repository hiện có của
  dự án, để tôi duyệt trước khi bạn code chi tiết.
```
