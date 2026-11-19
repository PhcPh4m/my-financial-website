# Quản lý Tài chính Cá nhân

Quản lý Tài chính Cá nhân là một ứng dụng web giúp bạn ghi chép thu chi hằng ngày, theo dõi ngân sách theo tháng, quản lý nhiều ví và xem biểu đồ để biết tiền đã đi đâu.

Ứng dụng là **web tĩnh**: chạy hoàn toàn trên trình duyệt, không có máy chủ, và dữ liệu được lưu ngay trên thiết bị của bạn trong `localStorage`. Không cần đăng ký tài khoản.

**Phiên bản hiện tại: 1.10.19 (bản thử).** Lịch sử thay đổi ở cuối file.

## Có gì trong ứng dụng

- **Ghi chép nhanh:** gõ một dòng như "cơm trưa 45k hôm qua", ứng dụng tự đoán số tiền, ngày và danh mục.
- **Ngân sách tháng:** đặt hạn mức chi và được báo khi chạm 80% hoặc vượt 100%.
- **Nhiều ví:** theo dõi tiền mặt, ngân hàng, ví điện tử riêng, và xem tổng tài sản.
- **Biểu đồ:** thu chi 6 tháng gần nhất, chi theo danh mục, chi theo ngày trong tháng.
- **Công cụ:** giao dịch định kỳ, chia tiền nhóm, máy tính lãi kép, trả góp, thuế thu nhập cá nhân.
- **Giao diện:** sáng hoặc tối, 10 bảng màu, và độ mờ của khung kính tùy chỉnh.
- **Hướng dẫn trong app:** trang Hướng dẫn mô tả cách dùng từng chức năng.

## Cấu trúc thư mục

```
my-financial-website/
├── index.html        Giao dịch
├── analytics.html    Biểu đồ & Phân tích
├── tools.html        Công cụ
├── settings.html     Cài đặt
├── guide.html        Hướng dẫn (trang tự mô tả cách dùng)
├── css/              Kết quả biên dịch SCSS. Trang chỉ đọc file này.
├── scss/             Nguồn CSS. Sửa ở đây. pages/ là điểm vào của từng trang.
├── js/               Logic ứng dụng
└── README.md         File này
```

Thư mục `js/`, chia theo chức năng:

| Nhóm | File | Vai trò |
|---|---|---|
| Lõi | `utils.js`, `storage.js`, `app.js` | Tiện ích, lưu dữ liệu, khởi tạo trang Giao dịch |
| Giao dịch | `quickadd.js`, `wallet-ocr.js`, `ocr-engine.js`, `history-import.js`, `bank-history-parser.js` | Nhập nhanh, ví, đọc số dư và lịch sử từ ảnh |
| Biểu đồ | `analytics.js`, `chart.js`, `details-anim.js` | Trang Phân tích và các biểu đồ |
| Công cụ | `tools.js`, `calc.js`, `recurring-split.js`, `bank-rates.js` | Giao dịch định kỳ, chia tiền nhóm, máy tính |
| Giao diện | `topbar.js`, `transition.js`, `motion.js`, `icons.js`, `settings.js` | Thanh chuyển trang, chuyển động, icon, Cài đặt |
| Hướng dẫn | `guide.js` | Mục lục và chuyển mục trong trang Hướng dẫn |
| Dữ liệu ngoài | `api.js` | Gọi dịch vụ bên ngoài (thời tiết) |

## Chạy

- **Live Server** (VS Code): mở thư mục rồi bấm Go Live.
- Hoặc: `python3 -m http.server 5500`, rồi mở http://localhost:5500/index.html

Cần Internet để tải Chart.js (biểu đồ) và lấy dự báo thời tiết (Open-Meteo, không cần khóa).

## Sửa SCSS

Dự án không có `package.json`, nên biên dịch bằng extension **Live Sass Compiler** trong VS Code. Cấu hình đầu ra vào `css/`.

Các thay đổi CSS gần đây được sửa **song song** ở `scss/` và `css/`, vì môi trường làm việc không có trình biên dịch `sass`. Khi build lại, kết quả phải khớp với `css/` hiện có. Nếu lệch, nguồn đúng là `scss/`.

## Lưu ý dữ liệu

- Dữ liệu lưu trong `localStorage` của trình duyệt, gắn với **địa chỉ đầy đủ của trang** và với từng trình duyệt trên từng máy. Đổi link, đổi trình duyệt, xóa cache hoặc dữ liệu trang thì dữ liệu không còn hiện.
- Dữ liệu không đồng bộ giữa các thiết bị.
- Trong Messenger và Instagram, trình duyệt tích hợp có vùng lưu riêng và có thể không giữ lâu. Nên mở bằng Safari hoặc Chrome.
- Trên iPhone, Safari có thể xóa dữ liệu của trang không mở trong khoảng 7 ngày.
- **Xuất file JSON sao lưu định kỳ** (mục Sao lưu). Đây là đường khôi phục duy nhất hiện có.
- Ảnh dùng để đọc số dư và lịch sử giao dịch được xử lý trên máy người dùng, không gửi lên máy chủ.

## Các trang và chức năng

### Giao dịch (index.html)
- Nhập nhanh bằng một dòng chữ (ví dụ "cơm trưa 45k hôm qua"), hoặc điền đầy đủ form. Danh mục được đoán tự động.
- Tìm kiếm, lọc theo loại, danh mục, trạng thái, tháng; sắp xếp.
- Ngân sách tháng có cảnh báo ở 80% và 100%.
- Quản lý ví: nhiều ví, ví mặc định, số dư đầu, tổng tài sản. Xóa ví sẽ chuyển giao dịch về ví mặc định.
- Thời tiết và thẻ "Tiền thực có".

### Biểu đồ & Phân tích (analytics.html)
- Chọn tháng, thẻ số liệu (thu nhập, chi tiêu, chênh lệch, số giao dịch) kèm so sánh với tháng trước.
- Ngân sách tháng dạng đồng hồ.
- Biểu đồ thu chi 6 tháng gần nhất, chi theo danh mục, chi theo ngày trong tháng.
- Ba nhóm nội dung: Tổng quan, Chi tiết, Ngân sách.

### Công cụ (tools.html)
- Giao dịch định kỳ.
- Chia tiền nhóm.
- Máy tính: lãi kép, vay trả góp đều (có thể tính ngược lãi suất từ số tiền trả mỗi tháng), thuế thu nhập cá nhân. Các hằng số thuế và giảm trừ nằm đầu `js/calc.js`, cần kiểm tra lại khi luật thay đổi.

### Cài đặt (settings.html)
- Giao diện sáng hoặc tối.
- 10 bảng màu: Đại dương (mặc định), Rừng, Rượu, Tím, Cát, Hồng, Than, Đất, Xanh, Chàm.
- Độ mờ của khung kính.

### Hướng dẫn (guide.html)
- Mục lục bên trái trên máy tính. Trên điện thoại (≤860px) thu gọn thành một nút hiện mục đang đọc.
- Các mục: bắt đầu, ghi chép, ngân sách, ví, xem và cài đặt, sao lưu, lưu ý khi sử dụng, hỏi đáp.

## Hệ thống thiết kế

- **Bảng màu:** mỗi bảng khai báo `--bg`, `--surface`, `--input`, `--accent` và bộ màu biểu đồ `--chart-1` đến `--chart-8` cùng `--chart-daily`, cho cả sáng và tối (`css/palettes.css`, `scss/_palettes.scss`).
- **Viền:** `--border`, `--border-strong` và `--glass-border` lấy từ `--accent` của bảng, nên đổi theo bảng.
- **Kính:** khung dùng `--glass`, `--glass-strong` và `backdrop-filter` (`--blur`). Độ mờ chỉnh bằng `--glass-mul`.
- **Chuyển động:** token chung `--motion-fast` (0.15s), `--motion-base` (0.45s), `--motion-ease` (`css/redesign.css`, `scss/_tokens.scss`). Giảm chuyển động (`prefers-reduced-motion`) tắt hiệu ứng.
- **Thanh chuyển mục** (thanh trên cùng, Phân tích, Công cụ, Cài đặt, mục lục Hướng dẫn) dùng chung một kiểu: khung kính bo tròn, viên chọn kính sáng, mục đang chọn chỉ đổi màu chữ sang `--accent`. Khối chung ở cuối `css/redesign.css` và `scss/_redesign.scss`.
- **Hộp thoại:** khi đóng có hiệu ứng mờ dần (`is-closing`, `hideModal` trong `js/utils.js`).
- **Biểu đồ:** màu đọc từ bảng khi vẽ. Đổi bảng hoặc chế độ sáng/tối sẽ phát `themechange` để vẽ lại. Thu nhập và chi tiêu dùng `--chart-1` và `--chart-3`.
- **Số tiền:** ô số dùng `type="number"` kèm dòng xem trước có dấu chấm (`parseMoney`, `setMoneyValue`, `updateMoneyPreview` trong `js/utils.js`). Cách này không phụ thuộc bộ gõ tiếng Việt.
- **Font:** Be Vietnam Pro, tải từ Google Fonts. Số tiền dùng số cách đều (`tabular-nums`) để các cột thẳng hàng.

## Kiểm tra

- **Tương phản:** `contrast_check.py` (chạy ngoài dự án, trên máy phát triển) đã kiểm tra 58 cặp màu trên 10 bảng × 2 chế độ, đạt ngưỡng. Script hiện chỉ kiểm tra màu chữ và nền, chưa kiểm tra `--chart-*`.
- **Thiết bị thật:** phần lớn thay đổi gần đây được kiểm tra qua mã nguồn và ảnh chụp, chưa xem đầy đủ trên trình duyệt và thiết bị thật.
- **Chưa có bộ kiểm thử tự động.** Nên viết lại ít nhất cho các hàm trong `js/calc.js` và `js/storage.js`.

## Việc cần làm

1. **Kiểm tra trên thiết bị thật:** mục lục Hướng dẫn trên điện thoại, thanh tab phụ (Thêm / Danh sách / Định kỳ / Chia tiền), các ô ngày, tháng, loại, biểu đồ khi đổi bảng màu, và cột thu/chi trên các bảng khác bảng Đại dương.
2. **Kiểm tra tương phản** cho `--chart-1` đến `--chart-8` và `--chart-daily` (mở rộng `contrast_check.py`).
3. **Đồng bộ dữ liệu và đăng nhập:** nếu cần dùng trên nhiều thiết bị hoặc không muốn mất dữ liệu, cần máy chủ và tài khoản. Hướng đề xuất là Firebase hoặc Supabase, không tự viết backend. Trước khi đưa dữ liệu thật lên máy chủ, cần làm xong phần bảo mật: xác thực an toàn, phân quyền theo người dùng (Row Level Security nếu dùng Supabase), không đưa khóa bí mật vào mã phía trình duyệt, HTTPS và sao lưu tự động.
4. **Lưu dữ liệu bền hơn trên trình duyệt** (nếu chưa chuyển máy chủ): chuyển sang IndexedDB, gọi `navigator.storage.persist()`, nhắc xuất file khi có thay đổi chưa sao lưu, và cân nhắc cài như ứng dụng (PWA).
5. **Phân tích AI:** tìm cách phù hợp rồi thêm lại vào trang Phân tích.
6. **Tỷ giá và lạm phát:** thêm lại khi có nguồn dữ liệu phù hợp. Ô "Lạm phát năm" trong máy tính lãi kép hiện nhập tay.
7. **Bộ icon:** thống nhất kích thước và độ dày nét cho nút và trạng thái, kiểm tra trên giao diện sáng và tối.
8. **Thời lượng animation:** `_nav.scss`, `_transactions.scss`, `_analytics.scss` vẫn có một số thời lượng cứng cần chuyển sang token.

## Gợi ý chức năng mới

Mỗi chức năng có thể làm thành trang riêng theo cấu trúc hiện có (HTML, SCSS, JS):
- **Báo cáo theo năm:** bảng thu, chi và số dư từng tháng, chọn năm để xem.
- **Ngân sách theo danh mục:** đặt hạn mức cho từng danh mục và cảnh báo khi gần vượt.
- **Mục tiêu tiết kiệm:** số tiền cần đạt, ngày hạn, theo dõi tiến độ.
- **Nhập và xuất CSV:** mở bằng Excel hoặc Google Sheets, bên cạnh file JSON. CSV để xem và đối chiếu, không dùng để khôi phục vì không giữ ví, ngân sách và cài đặt.

## Lịch sử thay đổi (tóm tắt)

- **1.10.19 (bản thử):** thu gọn mục lục Hướng dẫn trên điện thoại; thêm mục "Lưu ý khi sử dụng"; hiệu ứng đóng hộp thoại và bộ token chuyển động; thanh chuyển mục thống nhất; viền theo bảng màu cho cả 10 bảng; bộ màu biểu đồ theo bảng và biểu đồ tròn mới; trang Phân tích đồng bộ với Tổng quan; thanh tab phụ một hàng trên điện thoại; ô ngày, tháng, loại cùng chiều cao.
- **1.10.16 – 1.10.18:** trang Hướng dẫn mới, kiểu kính (liquid glass), bảng màu Đại dương, Tím, Hồng; trình bày lại mục Hướng dẫn; bố cục nội dung không còn giới hạn chiều rộng.
- **v60 và trước:** redesign trang Phân tích (tiêu đề kỳ, thẻ số, hàng chi tiết, ngân sách); sửa định dạng số tiền (dấu chấm khi gõ, xử lý con trỏ, Telex trên Windows); font Be Vietnam Pro; icon Phosphor cho danh mục; thanh chuyển trang và Cài đặt dưới dạng nút bánh răng; thu gọn thanh trên; biểu đồ tải Chart.js đồng bộ; thêm vay trả góp, thuế thu nhập cá nhân, giao dịch định kỳ; bỏ toàn bộ máy chủ, đăng nhập, phân tích AI và tỷ giá (sẽ thêm lại sau).
