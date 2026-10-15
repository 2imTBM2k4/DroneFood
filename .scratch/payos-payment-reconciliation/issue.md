# Đối soát thanh toán PayOS

## Phạm vi được duyệt
Minh duyệt triển khai cả bốn bước ngày 2026-10-15: nghiệm thu Đợt 1; đối soát PayOS theo yêu cầu; chống xác nhận/điều phối trùng; đồng bộ giao diện và kiểm thử. Không tạo giao dịch thật, không cài thư viện, không commit/push. Giữ thay đổi đang được đưa vào vùng chuẩn bị phiên bản.

## Mục tiêu
Thông báo bị mất vẫn xác nhận được qua máy chủ khi khách quay về hoặc bấm kiểm tra; không tin trạng thái từ trình duyệt; hai nguồn chạy đồng thời chỉ xử lý lần đầu một lần; không hồi sinh đơn đã hủy.

## Thực thi
- [x] Kiểm chứng tự động các quy tắc Đợt 1; ghi riêng xác nhận thủ công luồng thành công của Minh (chưa thay thế mọi ca tương tác trình duyệt).
- [x] Kiểm thử thất bại trước và triển khai đối soát + cập nhật nguyên tử + bảo vệ hủy.
- [x] Kiểm thử trước và triển khai nút kiểm tra/vòng xác thực có hủy.
- [ ] Chốt nghiệm thu toàn bộ: đã chạy kiểm thử, kiểm tra mã, bản dựng, rà soát và cập nhật tài liệu; còn một kiểm thử thư xác minh thất bại và chưa kiểm thử tương tác trình duyệt thật.

## Quyết định
- Dùng đường xác thực có đăng nhập hiện có, chỉ hỏi PayOS cho đơn PayOS đang chờ trả tiền; không chạy đối soát nền mọi đơn.
- Thông báo ký hợp lệ và đối soát dùng chung bước ghi nhận có điều kiện. Thanh toán muộn trên đơn hủy được ghi nhận đã trả tiền nhưng không đổi trạng thái/điều phối.
- Chỉ đảm bảo chống lặp yêu cầu đồng thời, không cam kết phục hồi mọi tác dụng phụ khi tiến trình dừng đột ngột.

## Bằng chứng
- Minh xác nhận đã thử thành công đặt/thanh toán giao bằng thiết bị bay khi ngrok chạy. Chưa có xác nhận thủ công đầy đủ các tình huống phân quyền/từ chối/tắt dịch vụ.
- Công cụ tra mã hiện báo lỗi bộ kiểm soát; khảo sát trực tiếp bằng đọc/tìm kiếm. Không ghi được tệp kế hoạch trong thư mục riêng do quy tắc từ chối; bản kế hoạch trong hội thoại được Minh duyệt.
- Đã viết `apps/api/tests/integration/payosReconciliation.test.js` để kiểm tra đối soát thiếu thông báo, quyền sở hữu, mã/tiền/chữ ký, hai nguồn đồng thời, thông báo trùng, giỏ hàng, thanh toán muộn và hủy thất bại.
- Minh đã chạy kiểm thử trước triển khai: 29 trường hợp, 8 thất bại và 21 đạt. Tám lỗi được tái hiện: thiếu đối soát; xác nhận đồng thời không thống nhất; điều phối ba lần; chấp nhận sai liên kết; hồi sinh đơn hủy; thiếu sự kiện cập nhật; bỏ qua lỗi hủy; hủy khi cổng đã nhận tiền.
- Đã triển khai bước ghi nhận có điều kiện theo trạng thái/mã/lượt thanh toán; dùng chung cho thông báo và đối soát. Chỉ lần ghi nhận đầu tiên khởi động đơn, điều phối và thông báo đơn mới; thanh toán muộn giữ nguyên trạng thái kết thúc. Đối soát kiểm tra quyền sở hữu trước khi gọi PayOS, giới hạn chờ 8 giây và không tự thử lại tại thư viện.
- Đã nối thông báo thanh toán và `orderStatusUpdated` cho đường đối soát; giữ đường VNPay và đơn miễn thanh toán dùng chung bộ thông báo.
- Đã bảo vệ hủy: chỉ tiếp tục khi cổng trả liên kết khớp, trạng thái hủy/hết hạn và chưa nhận tiền; cập nhật có điều kiện để không ghi đè thanh toán đồng thời. Giải phóng thiết bị bay/phiếu giảm giá sau khi giành được quyền hủy.
- Sau khi công cụ hoạt động lại: 35/35 trường hợp đối soát đạt. Đã bổ sung các trường hợp VNPay không hỏi PayOS, đã trả tiền không hỏi/điều phối lại, tiền muộn trên refund_pending/delivered, sai số tiền/mã/chủng loại trong thông báo, đổi lượt thanh toán trong khi chờ và tạo hạn tài xế một lần. Bộ đối soát hiện đạt 44/44.
- Đã quan sát chín kiểm thử giao diện thất bại do chưa có tiện ích xác thực, sau đó triển khai tiện ích dùng chung có giới hạn lượt và hủy tín hiệu. Bổ sung kiểm thử chưa trả → đã trả và giới hạn thời gian thực cho hủy bộ hẹn giờ; hiện mười kiểm thử hành vi thanh toán đạt, toàn bộ giao diện khách đạt 19/19.
- Trang trả về không tin tham số thành công/hủy, đợi khôi phục đăng nhập rồi xác thực; vòng kiểm tra dừng khi rời trang. Danh sách/chi tiết có nút Kiểm tra thanh toán một lần, khóa các nút thanh toán xung đột và cập nhật đơn/giỏ.
- Hai lượt rà soát độc lập chỉ đọc đã thực hiện. Đã xử lý ba điểm giao diện được phát hiện: nút thử lại trên đầu trang chưa khóa theo kiểm tra; phần hai nút không xuống hàng trong cột hẹp; hàm tải giỏ giữ địa chỉ cũ khi đổi địa chỉ lúc chờ. Kiểm tra mã và bản dựng giao diện khách sau sửa đạt; có cảnh báo gói mã lớn hơn 500 kB.
- Lượt toàn bộ API đầu tiên đạt 465/465. Lượt cuối sau bổ sung đạt 473/474: `userService > verifyEmail & resendVerification > should resend verification email for unverified user` quá thời gian 30 giây, nhật ký có `Missing credentials for "PLAIN"`. Chạy riêng cũng thất bại cùng lỗi; không sửa/bỏ kiểm thử hoặc tăng giới hạn để che lỗi.
- Kiểm tra mã API và cả ba giao diện đạt. Giao diện khách đạt 19/19; nhà hàng + quản trị đạt 14/14; bản dựng cả ba đạt. Khách/quản trị có cảnh báo gói mã >500 kB; Git cảnh báo quy đổi LF→CRLF, `git diff --check` không báo lỗi khoảng trắng.
- Tài liệu quyết định/tên miền đã cập nhật; các lỗi hiện hữu ngoài phạm vi được theo dõi tại [payment-follow-ups](../payment-follow-ups/issue.md). Không commit/push, không cài thư viện, không sửa vùng chuẩn bị phiên bản.

## Giới hạn xác minh và công việc ngoài phạm vi
- Không giao dịch tiền thật hoặc thao tác trình duyệt tự động trong lượt này. Kiểm thử phía khách thực thi tiện ích, chưa dựng/tháo thành phần React thật; khóa nút/bố cục và hàm móc được rà soát mã, chưa có kiểm thử tương tác trình duyệt.
- Đường Thanh toán lại hiện hữu gọi `orderService.retryPayosPayment` nhưng dịch vụ không xuất hàm này. Đã kiểm tra `HEAD` cũng không có hàm xuất tương ứng. Đây là lỗi hiện hữu ngoài phần đối soát đã duyệt; chưa sửa và không tuyên bố đường Thanh toán lại hoạt động.
- Rà soát ghi nhận cạnh tranh hiện hữu giữa yêu cầu hoàn tiền sau khi xác nhận và điều phối drone: bộ điều phối chưa có điều kiện chặn trạng thái refund_pending tại thời điểm gán. Đã đối chiếu HEAD có cùng chuỗi ghi nhận → dọn giỏ → điều phối. Chưa mở rộng sửa bộ điều phối trong lượt này; cần theo dõi riêng trước khi tuyên bố toàn bộ luồng hoàn tiền/điều phối an toàn.
- Đơn đã hủy không được đối soát theo yêu cầu mới; thông báo ký hợp lệ hoặc yêu cầu đối soát bắt đầu trước lúc hủy vẫn ghi nhận tiền muộn. Nếu cả hai đều mất, cần đối chiếu cổng thủ công. Không có cơ chế phục hồi tác dụng phụ sau sự cố tiến trình.
