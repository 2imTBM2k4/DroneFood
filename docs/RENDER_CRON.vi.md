# Render Cron: hủy đơn shipper quá hạn

Tạo một **Cron Job** riêng trong cùng Render project với backend:

| Trường | Giá trị |
|---|---|
| Repository / Branch | Drone Food / `main` |
| Root Directory | `backend` |
| Build Command | `npm ci` |
| Start Command | `npm run jobs:expire-shipper-orders` |
| Schedule | `* * * * *` |

Copy các biến môi trường cần thiết từ backend Web Service, tối thiểu là
`MONGODB_URI` và `JWT_SECRET`. Cron job chỉ kết nối database, atomically hủy
đơn `shipper` đang `unassigned` quá deadline 15 phút, rồi tự kết thúc.

Không chạy lệnh này trong Render Web Service; Web Service và Cron Job phải là
hai service độc lập.
