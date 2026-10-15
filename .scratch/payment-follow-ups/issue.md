# Các lỗi hiện hữu phát hiện khi rà soát thanh toán

Ngày ghi nhận: 2026-10-15. Chưa được duyệt mở rộng triển khai; không thay thế hồ sơ đối soát PayOS.

## 1. Thanh toán lại thiếu dịch vụ
- Hiện trạng: `orderController.retryPayosPayment` gọi `orderService.retryPayosPayment`, nhưng dịch vụ không xuất hàm tương ứng. Tuyến hiện tại sẽ trả lỗi 500.
- Bằng chứng: đã tìm trong nguồn hiện tại và kiểm tra nguồn HEAD bằng `git show` + biểu thức tìm khai báo xuất; HEAD cũng không có hàm xuất tương ứng.
- Mong đợi: tạo lại liên kết chỉ sau khi kiểm tra lần thanh toán trước và giành quyền thay thế nguyên tử; không mở nhiều liên kết hoặc bỏ sót tiền của lượt cũ.
- Trạng thái: chưa triển khai; không tự ý khôi phục một hàm từ phỏng đoán vì có rủi ro thanh toán trùng.

## 2. Hoàn tiền đồng thời điều phối thiết bị bay
- Hiện trạng: sau bước ghi nhận tiền và dọn giỏ, một yêu cầu hoàn tiền có thể đưa đơn vào `refund_pending` trước khi điều phối thiết bị bay; hàm điều phối chưa có điều kiện chặn trạng thái này tại thời điểm gán.
- Bằng chứng: rà soát độc lập đọc cả nguồn hiện tại và HEAD thấy cùng thứ tự ghi nhận → dọn giỏ → điều phối. Không có kiểm thử tái hiện thực thi trong lượt này.
- Mong đợi: đơn đang hoàn tiền/hủy không nhận gán mới; yêu cầu hoàn tiền và gán phải phối hợp bằng điều kiện trạng thái nguyên tử, không chỉ kiểm tra lại trước gọi hàm.
- Trạng thái: chưa triển khai; cần duyệt thiết kế phối hợp hoàn tiền/điều phối riêng, không thay thuật toán chọn thiết bị bay.

## 3. Kiểm thử thư xác minh phụ thuộc dịch vụ ngoài
- Lượt toàn bộ API cuối: `tests/unit/userService.test.js > userService > verifyEmail & resendVerification > should resend verification email for unverified user` quá thời gian 30 giây; nhật ký có `Missing credentials for "PLAIN"`.
- Nguồn: dịch vụ tài khoản gọi gửi thư; `utils/sendEmail.js` tạo kết nối SMTP thực, thiếu cấu hình sẽ dùng máy chủ mặc định. Đây không phải tình huống PayOS.
- Mong đợi: kiểm thử nghiệp vụ dùng thay thế dịch vụ thư ở ranh giới ngoài; kiểm thử SMTP thật tách riêng và có cấu hình rõ. Không tăng thời gian hoặc bỏ kiểm thử để che lỗi.
- Trạng thái: chưa sửa mã/tệp kiểm thử tài khoản trong phạm vi này.
