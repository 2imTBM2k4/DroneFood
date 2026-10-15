# Đợt 1 — Đăng ký và xét duyệt giao hàng bằng drone

## Yêu cầu và phạm vi đã chốt
Nguồn yêu cầu: lời nhắn triển khai của silentboiz trong phiên này. Chỉ làm đăng ký/xét duyệt/vận hành dịch vụ; không nâng cấp thương hiệu, tạo tài khoản quản lý, bán món từng chi nhánh, vùng bay hoặc thuật toán chọn drone.

- Mọi nhà hàng độc lập và chi nhánh được đăng ký; chủ và quản lý được gán chỉ thao tác địa điểm thuộc quyền.
- Hồ sơ nằm trong Branch: địa chỉ, tọa độ, người liên hệ, điện thoại, mô tả bàn giao.
- Chưa đăng ký → chờ duyệt → đã duyệt hoặc bị từ chối; chỉ hồ sơ bị từ chối được sửa/gửi lại. Quyết định có lý do và lưu nhật ký hiện có.
- Duyệt không bật `droneDeliveryEnabled`; bật phải có duyệt. Tắt không mất duyệt hoặc ảnh hưởng đơn đã nhận. Không công nhận quyền từ dữ liệu cũ.
- Báo giá/đặt đơn dùng cùng điều kiện, cả `restaurantId` cũ; dữ liệu hồ sơ không công khai.
- Giao diện nhà hàng gửi hồ sơ và quản trị xét duyệt.

## Xác minh ban đầu
- Có 16 tệp sửa sẵn và 3 ảnh chưa theo dõi; không ghi đè hoặc đưa vào phiên bản.
- Tạo nhánh `feat/drone-delivery-approval-phase1` từ nhánh main, giữ nguyên thay đổi đang có. Không tạo vùng làm việc riêng vì người dùng yêu cầu triển khai tại phiên và chưa yêu cầu worktree.
- Không có `.scratch` hồ sơ trước hoặc tệp kế hoạch tương ứng tìm thấy; yêu cầu hiện tại là đặc tả thực thi.
- `CONTEXT-MAP.md` và `CONTEXT.md` chưa tồn tại; không suy diễn từ tài liệu phiên trước.
- Đã xác minh Branch chưa có hồ sơ; công tắc tự bật, báo giá thiếu điều kiện drone và đường restaurantId không có Branch vẫn đặt drone được.
- Công cụ tra mã bỏ sót các đoạn với nhãn đã gửi trong phiên; đọc trực tiếp các đoạn thiếu để có mã thực tế.

## Danh sách thực thi
1. [x] Kiểm thử và dữ liệu Branch: hồ sơ riêng tư, chuyển trạng thái có kiểm soát, chống gửi/duyệt đồng thời, nhật ký. Độ phức tạp: vừa. Lưu ý: không tự bật và không sửa hồ sơ đang chờ/đã duyệt.
2. [x] Ánh xạ tương thích từng nhà hàng theo Merchant/MAIN hiện có; các đường gọi có phân quyền. Độ phức tạp: vừa. Lưu ý: không chạy chuyển đổi hàng loạt, không thay ID/role/món/giỏ/đơn cũ.
3. [x] Đồng bộ điều kiện báo giá/đặt đơn; bảo vệ tạo/cập nhật thông tin chi nhánh và dữ liệu công khai. Độ phức tạp: vừa. Lưu ý: không can thiệp đơn đã nhận.
4. [x] Giao diện nhà hàng và quản trị theo quy ước hiện tại. Độ phức tạp: vừa. Lưu ý: giữ thay đổi giao diện có sẵn.
5. [x] Kiểm thử liên quan và toàn bộ API, kiểm tra mã, tạo bản dựng hai giao diện, kiểm tra độc lập và rà soát bảo mật. Độ phức tạp: vừa. Đã xử lý lỗ hổng phân quyền gián tiếp trong gán quản lý chi nhánh.

## Kiểm chứng bắt buộc
Chủ/quản lý/người ngoài; gửi trùng; duyệt đồng thời; từ chối/gửi lại; chưa duyệt không bật/báo giá/đặt; đã duyệt+bật thành công; restaurantId không vượt; không lộ hồ sơ; tắt không phá đơn; cập nhật kiểm thử tự bật cũ; bảo vệ gán quản lý qua req.params.id ưu tiên trước body.merchantId.

## Nhật ký thực thi
- Đã triển khai dữ liệu/hồ sơ, các đường gọi riêng tư, ánh xạ từng nhà hàng, điều kiện dùng chung và giao diện. Không commit/push, không thêm thư viện.
- Đã quan sát kiểm thử thất bại trước triển khai: tự bật trả 200 thay vì 403; đường hồ sơ chưa tồn tại; báo giá/đặt cũ trả 200 khi chưa duyệt; gán drone cho đơn đã nhận bị chặn khi tắt; gán manager bằng body.merchantId của attacker trả 200 thay vì 403.
- Sau sửa: toàn bộ API `npm --prefix apps/api test` đạt 429/429 (51 tệp); 33 trường hợp tích hợp mới; unit test requireMerchantAccess 9/9; quy tắc giao diện nhà hàng 4/4; sidebar 3/3.
- Kiểm tra mã API/nhà hàng/quản trị đều không có lỗi; bản dựng nhà hàng/quản trị đạt. Quản trị có cảnh báo gói mã lớn hơn 500 kB.
- Đã sửa lỗi ánh xạ do timestamps tự động xung đột `updatedAt` khi upsert: tắt tự ghi timestamps riêng phép chèn dữ liệu kế thừa để bảo toàn ngày gốc.
- Đã sửa lỗ hổng phân quyền gián tiếp trong `requireMerchantAccess.cjs`: ưu tiên tài nguyên định danh trong `req.params.id` (Branch/Merchant) thay vì để `req.body.merchantId` hoặc `req.query.merchantId` của kẻ tấn công ghi đè ngữ cảnh phân quyền.
- Đã cập nhật kiểm thử luồng bật dịch vụ cũ để gửi và xét duyệt thật trước bật; kiểm thử giảm tiền về 0 cũng chuẩn bị hồ sơ được duyệt, không bỏ qua điều kiện nghiệp vụ.
- Assistant chưa kiểm thử tương tác trình duyệt thực tế; đã hoàn tất kiểm tra rà soát mã độc lập và viết kiểm thử bảo vệ. Ngày 2026-10-15, Minh xác nhận đã thử thành công luồng đặt/thanh toán giao bằng drone sau khi bật ngrok. Đây là nghiệm thu thủ công luồng thành công, không thay thế kiểm chứng các tình huống phân quyền/từ chối/tắt dịch vụ.
- Giữ hồ sơ công việc vì chưa tạo phiên bản; không xóa bằng chứng kiểm thử.
- Giao diện và điều kiện đặt đơn cùng tiêu thụ hồ sơ Branch; trạng thái duyệt độc lập với công tắc; dùng định danh lượt gửi submissionId khi xét duyệt để không duyệt nhầm hồ sơ mới.
- Lưu ý kiến trúc/nghiệp vụ: địa chỉ trong hồ sơ (`droneDeliveryApplication.address`) là bản chụp (snapshot) độc lập tại thời điểm đăng ký duyệt vị trí bàn giao, không tự động đồng bộ khi `Branch.address` đổi sau này.
- Đã sửa lỗi PayOS checkout `Unable to create PayOS payment link: Invalid time value`: nguyên nhân do truyền chuỗi `orderCode` vào vị trí tham số `date = new Date()` trong `orderPaymentDescription(orderId, orderCode, date)` dẫn đến `Intl.DateTimeFormat.prototype.format` ném lỗi `RangeError`. Đã xử lý an toàn và thêm unit test bảo vệ không vượt quá 25 ký tự.
- Đã hợp nhất giao diện Đăng ký giao hàng bằng drone vào trang Quản lý profile nhà hàng (`EditRestaurant.jsx`) thông qua tab navigation `?tab=drone`, chuyển hướng URL `/drone-delivery` sang profile tab, và dọn dẹp Sidebar.
- Đã thiết kế lại toàn diện giao diện duyệt hồ sơ giao hàng drone tại trang Admin (`Branches.jsx` và `Branches.css`): hiển thị thẻ thông tin tọa độ/địa chỉ/người liên hệ rõ ràng, thẻ lý do xét duyệt có màu phân biệt theo trạng thái, bộ đếm ký tự, cùng các nút hành động Từ chối / Phê duyệt trực quan.
- Kết quả kiểm thử: toàn bộ 51 tệp test API (430/430 tests passed), test frontends đạt 14/14, linters của cả 3 ứng dụng đều không có cảnh báo/lỗi (0 errors, 0 warnings), build của `apps/restaurant-web` và `apps/admin-web` đều thành công.
