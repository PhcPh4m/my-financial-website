Quản lý Tài chính Cá nhân

Đề tài: Website quản lý tài chính cá nhân, môn Lập trình web, Khoa Công nghệ Thông tin, Trường Đại học Gia Định.

Ứng dụng web ghi chép thu chi, theo dõi ngân sách và xem biểu đồ theo tháng. Hiện là web tĩnh: chạy hoàn toàn trên trình duyệt, dữ liệu lưu trong localStorage. Trang Hướng dẫn trong ứng dụng mô tả cách dùng.

Cấu trúc thư mục
my-financial-website/
├── index.html        Giao dịch
├── analytics.html    Biểu đồ & Phân tích
├── tools.html        Công cụ
├── settings.html     Cài đặt (tab trên thanh chuyển trang)
├── guide.html        Hướng dẫn
├── css/              Kết quả biên dịch SCSS (trang chỉ đọc file này)
├── scss/             Nguồn CSS: sửa ở đây (pages/ là điểm vào của từng trang)
├── js/               Logic ứng dụng (settings.js: tùy chọn Cài đặt; icons.js: bộ icon Phosphor)
└── README.md         File này
Chạy
Live Server (VS Code): mở thư mục rồi bấm Go Live.
Hoặc: python3 -m http.server 5500 rồi mở http://localhost:5500/index.html

Cần Internet để tải Chart.js (biểu đồ) và lấy dự báo thời tiết.

Lưu ý dữ liệu
Dữ liệu lưu trong localStorage của trình duyệt, gắn với địa chỉ đầy đủ của trang và với từng trình duyệt trên từng máy. Đổi link, đổi trình duyệt, xóa cache hoặc dữ liệu trang thì dữ liệu sẽ không còn hiện.
Trong Messenger và Instagram, trình duyệt tích hợp có vùng lưu riêng và có thể không giữ lâu. Nên mở bằng Safari hoặc Chrome.
Xuất file JSON sao lưu định kỳ (mục Sao lưu). File này là đường khôi phục duy nhất hiện có.
Sửa SCSS

Dự án không còn package.json, nên biên dịch bằng extension Live Sass Compiler trong VS Code: lưu file .scss là css/ được cập nhật. Cần cấu hình extension để đầu ra vào css/ (xem gợi ý bên dưới).

Lưu ý: từ v43-step2 đến v44, các thay đổi CSS được sửa song song ở scss/ và css/ vì môi trường làm việc không có trình biên dịch sass. Khi build lại bằng Live Sass Compiler, kết quả phải khớp với các file css/ hiện có; nếu lệch, nguồn là scss/.

Nhật ký
v1.10.19 (bản thử, gửi người dùng thử)
Hướng dẫn:
Trên điện thoại (≤860px), mục lục thu gọn thành một nút hiện mục đang đọc, bấm để mở danh sách. Chọn mục xong tự thu lại (js/guide.js: syncToggle, setCollapsed).
Nội dung không còn bị giới hạn 70ch, các đoạn, danh sách, bước và khối ví dụ cùng một mép trái.
Thêm mục "Lưu ý khi sử dụng" (id="trial") trước "Hỏi đáp": giữ đúng link, dữ liệu chỉ ở trình duyệt, nên mở bằng Safari hoặc Chrome, cách xuất file sao lưu, cách gửi góp ý.
Mục "Các trang và thao tác": tên trang in đậm, bỏ đoạn hướng dẫn cột trái thừa.
Chuyển mục: mở 0.45s, đóng 0.3s (LEAVE_MS = 300 trong js/guide.js).
Hiệu ứng đóng mở:
Hộp thoại (gồm cửa sổ quản lý ví) có trạng thái đóng is-closing: mờ dần và thu nhẹ 0.45s rồi mới ẩn (hideModal trong js/utils.js).
Bộ token chung trong css/redesign.css và scss/_tokens.scss: --motion-fast 0.15s, --motion-base 0.45s, --motion-ease. Khối "Xem theo ví" dùng 450ms.
Giảm chuyển động (prefers-reduced-motion) vẫn tắt hiệu ứng.
Thanh chuyển mục thống nhất (theo thanh điều hướng trên cùng): .nav-tabs, .tabs (Phân tích, Công cụ), .seg (Cài đặt) và mục Nội dung của Hướng dẫn có cùng một kiểu: khung kính bo tròn, viên chọn kính sáng, mục đang chọn chỉ đổi màu chữ sang --accent. Khối chung nằm cuối css/redesign.css và scss/_redesign.scss; đã xóa các quy tắc tô đặc cũ.
10 bảng màu (Đại dương, Rừng, Rượu, Tím, Cát, Hồng, Than, Đất, Xanh, Chàm):
Viền và viền kính (--border, --border-strong, --glass-border) lấy từ --accent của bảng, trước đây là giá trị cố định nên không đổi theo bảng.
Đã kiểm tra tương phản 58 cặp màu trên 10 bảng × 2 chế độ bằng contrast_check.py, đạt ngưỡng.
Trang Phân tích:
Thẻ KPI nền trung tính như trang Tổng quan, màu xanh/đỏ chỉ còn ở badge. Icon có nền ô vuông.
Ô "Chọn tháng" và nút "Tất cả thời gian" cùng chiều cao 2.25rem.
Biểu đồ:
Mỗi bảng màu có bộ --chart-1 đến --chart-8 và --chart-daily (css/palettes.css, scss/_palettes.scss). js/chart.js đọc màu khi vẽ và vẽ lại khi đổi bảng hoặc chế độ sáng/tối (sự kiện themechange, phát từ js/settings.js).
Biểu đồ tròn là một vòng liền (cutout 58%), chú thích bên phải, khung 16rem, cùng chiều cao với biểu đồ cột.
Cột Thu nhập dùng --chart-1, cột Chi tiêu dùng --chart-3. Cột theo ngày đổi theo bảng; bảng Đại dương là xanh dương.
Badge tốt/xấu trên thẻ KPI vẫn giữ xanh/đỏ.
Điện thoại:
Thanh tab phụ (Thêm / Danh sách / Định kỳ / Chia tiền) giữ một hàng trên ≤600px.
Ô ngày, tháng, loại cùng chiều cao; không còn chồng mép.

Chưa kiểm chứng: chưa xem trên thiết bị thật. Cần kiểm tra: mục lục thu gọn trên điện thoại, thanh tab và ô form trên điện thoại, biểu đồ khi đổi bảng màu, và sự khác biệt giữa cột thu và chi trên các bảng khác bảng Đại dương.

v60 và các bản trước (lịch sử)
v60 (redesign trang Biểu đồ & Phân tích, mã nằm dưới .analytics-page):
Tiêu đề kỳ: "Đang xem" nhỏ và "Tháng 11/2026" lớn (1.625rem, weight 700) bên trái. Bộ chọn tháng và hai nút nằm bên phải. periodLabel vẫn được JS cập nhật. Body có class analytics-page.
Thẻ số: icon không còn khung nền, chữ số 1.5rem weight 700.
Hàng chi tiết: danh mục (5 phần) và bảng tổng hợp (7 phần) thành hai cột cân nhau, một cột trên màn hình ≤900px.
Ngân sách: lưới tự co theo chiều rộng (auto-fill, tối thiểu 11rem).
Khoảng cách giữa các khối là 1.25rem.

Chưa kiểm chứng: Chart.js không tải được trong môi trường kiểm tra, nên biểu đồ trống trong ảnh chụp. Cần mở có Internet để xem biểu đồ thật.

v59 (trang Biểu đồ & Phân tích):
Thứ tự biểu đồ: "Thu nhập và chi tiêu (6 tháng)" là biểu đồ chính, rộng toàn bộ, cao 20rem (.chart-card--hero). Hai biểu đồ phụ bên dưới khác kích thước: "Chi tiêu theo danh mục" rộng 2 phần (.chart-card--side) và "Chi tiêu theo ngày" rộng 3 phần (.chart-card--main). Trên màn hình ≤900px thì xếp một cột.
Bỏ tiêu đề "Thêm: ngân sách theo danh mục và phân tích AI" trong analytics.html. Tiêu đề này trùng với khối ngân sách và nhắc đến tính năng AI chưa có.
Mã CSS biểu đồ nằm ở cuối scss/_analytics.scss và css/analytics.css.

Chưa kiểm chứng: Chart.js không tải được trong môi trường kiểm tra (không có Internet), nên các biểu đồ trống trong ảnh chụp. Cần mở khi có mạng để xem biểu đồ thật. Chưa kiểm tra bố cục trên điện thoại thật.

v58: bốn ô chọn tháng (monthPicker ở Biểu đồ, monthFilter ở Giao dịch, recStart và recEnd ở Công cụ) có thuộc tính lang="en". Trình duyệt hiển thị định dạng tháng bằng tiếng Anh (mm/yyyy) thay cho ngôn ngữ của máy. Nhãn chữ bên ngoài vẫn là tiếng Việt.

Chưa kiểm chứng: cần mở trên Chrome và Safari để xác nhận định dạng hiển thị.

v57 (xử lý các lỗi còn lại từ v56):
Ký hiệu tiền: đổi ₫ (U+20AB) thành đ ở toàn bộ js/*.js và *.html. Glyph ₫ trong Be Vietnam Pro có gạch ngang nên trông như chữ đ bị gạch chân. Hàm formatCurrency và moneyPreviewFor trong js/utils.js đã đổi.
Bộ lọc giao dịch: .filters từ 3 cột thành 2 cột (scss/_transactions.scss và css/*.css). Các select không còn bị cắt chữ trong cột trái hẹp.

Chưa kiểm chứng: cần xem lại bộ lọc trên màn hình 1440px và 390px, và kiểm tra các số tiền hiển thị đ đúng vị trí.

v56 (unslop header và footer, đã kiểm tra bằng trình duyệt headless):
Header: icon thương hiệu bỏ khung tròn, chỉ còn icon màu accent (.brand__title .icon trong scss/_topbar.scss và cuối css/*.css). Tiêu đề 1.125rem weight 600.
Footer: bỏ dòng chữ căn giữa. Hai đầu căn trái và phải, chữ 0.75rem mờ, số năm dùng tabular-nums. Markup <p class="footer__inner"> ở 5 trang, style trong scss/_footer.scss và cuối css/*.css.
Lỗi nhãn tab trên điện thoại: nhãn bị cắt giữa chữ khi mở. Thêm cuộn ngang cho .nav-tabs ở ≤640px. Nhãn đang mở chiếm tối đa 9rem.
Lỗi thanh chọn tab lệch: khi nhãn đổi độ rộng lúc tải trang hoặc lúc rê chuột, thanh chọn không bám theo. js/topbar.js thêm ResizeObserver trên các .nav-link để gọi moveNavPill() mỗi khi độ rộng đổi.

Phát hiện chưa xử lý: trong ô lọc, các select "Loại", "Danh mục", "Trạng thái", "Sắp xếp" bị cắt chữ ("Ngày m"). Số dư có ký hiệu đ bị gạch chân. Cần rà lại ở bước sau.

Chưa kiểm chứng: chưa kiểm tra Windows và Safari thật. Đã chụp bằng Chromium headless ở 1440px và 390px (mobile emulation).

v55: font chữ là Be Vietnam Pro trên mọi thiết bị, bỏ SF Pro và Inter khỏi thứ tự font. Tải các trọng số theo mẫu: Light 300, Regular 400, Medium 500, SemiBold 600, Bold 700, Black 900 (Google Fonts, trong <head> của 5 trang). Tiêu đề thanh trên (.brand__title) và số dư (.kpi__value) dùng Bold 700; tiêu đề ô (.panel__title) dùng SemiBold 600.
v54: font chữ cho mọi thiết bị là Inter (Google Fonts, 400–700, có tiếng Việt), thay cho Be Vietnam Pro. Thứ tự font: -apple-system, BlinkMacSystemFont, "Inter", .... Trên Apple vẫn dùng SF Pro, trên Windows và Android dùng Inter. Inter là font có hình dáng gần SF Pro nhất mà vẫn được phép nhúng trên web. Liên kết Google Fonts trong <head> của 5 trang đã đổi sang Inter.
v53: thứ tự font đổi thành -apple-system, BlinkMacSystemFont, "Be Vietnam Pro", .... Trên iPhone, iPad và Mac, trình duyệt dùng SF Pro (font hệ thống của iOS, có đủ tiếng Việt). Trên Windows và Android, dùng Be Vietnam Pro. SF Pro không thể nhúng qua web nên đây là cách dùng đúng font iOS khi mở trên thiết bị Apple.
v52: font chữ là Be Vietnam Pro (Google Fonts, trọng số 400–700). Biến --font-sans trong scss/_tokens.scss và cuối :root của css/*.css. Liên kết Google Fonts nằm trong <head> của 5 trang và cần Internet. Thêm scss/_typography.scss: số tiền dùng tabular-nums để các cột thẳng hàng (.kpi__value, .transaction__amount, .money-preview, .tool-result__row strong...), .kpi__value weight 600 với tracking -0.02em, tiêu đề chặt 600 với tracking -0.015em.
v51: tiêu đề thanh trên (.brand__title, .brand__sub, .brand__title .icon trong scss/_topbar.scss và cuối mỗi css/*.css): bỏ khung vuông quanh icon, dùng icon tròn nhẹ, chữ 1.125rem weight 600, phụ đề 0.75rem mờ hơn. Áp dụng cho cả 5 trang. Font chữ chưa đổi; xem đề xuất trong phản hồi.
v50: đồng bộ thời lượng thanh chọn trang về 0.6s (xem mục 3 của v49). Các mục khác của v49 giữ nguyên.
v49:
Bỏ mục Chuyển động trong Cài đặt. Đã gỡ khỏi settings.html, js/settings.js (motion, applySettings), phần head script của 5 trang và mục "Chuyển động" trong Hướng dẫn. Đã bỏ các quy tắc giảm chuyển động do ta thêm (html[data-motion], prefers-reduced-motion kiểu :not). Các khối prefers-reduced-motion có sẵn trong v42 vẫn giữ nguyên.
Đổi tùy chọn có hiệu ứng: flashSwitch() trong js/settings.js bật lớp is-switching trên <html> trong 0.7s. Trong 650ms đó màu và kính đổi dần (.is-switching *, scss/_settings.scss). --glass-mul được đăng ký bằng @property nên có thể chuyển dần. Nút phân đoạn cũng chuyển màu nền 0.6s.
Thanh chọn trang: mở và thu nhãn, trượt thanh chọn tab dùng 0.6s. followNavPill mặc định 620ms. Thời lượng được chọn theo khảo sát animation trong dự án: nhóm hover/chạm 0.15s (49 chỗ), nhóm chuyển trạng thái 0.2–0.3s, nhóm chuyển trang và hiệu ứng vào 0.4–0.5s (page-in 0.5s), và các thay đổi mới 0.6s. Đổi giữa 0.5s và 0.7s, chọn 0.6s để không nhanh cũng không chậm.
Animation chuyển trang vẫn là bản v42.

Chưa kiểm chứng: chưa chạy trình duyệt. Cần kiểm tra: đổi Sáng/Tối và độ mờ kính có chuyển dần không, thanh chọn trang có quá chậm không, và nút phân đoạn có chuyển màu không.

v48:
Thứ tự thanh chuyển trang: Giao dịch, Biểu đồ & Phân tích, Công cụ, Hướng dẫn, Cài đặt. Cài đặt nằm cuối như các ứng dụng thường làm.
Icon Cài đặt: dùng ph-gear (bánh răng Phosphor). Thêm vào PHOSPHOR_PATHS trong js/icons.js. Đường vẽ được viết theo bộ Phosphor Regular, chưa đối chiếu với file gốc, nên cần xem trực tiếp. Tiêu đề trang Cài đặt cũng dùng ph-gear. Tiêu đề trang Công cụ đổi sang ph-wrench.
Animation: chưa tái hiện được lỗi trong môi trường này. CSS keyframes và khai báo animation của page-in, page-out, sheet-in, toast-in, topbar-in, brand-in, topbar-out khớp với v42. Nguyên nhân có khả năng nhất là chế độ chuyển động đang lưu là "Giảm chuyển động" (khóa app_settings trong localStorage), hoặc hệ điều hành đang bật "Giảm chuyển động". Khi đó mọi animation bị tắt có chủ đích. Cách kiểm tra: mở Cài đặt, chọn "Bình thường" trong mục Chuyển động.

Chưa kiểm chứng: chưa chạy trình duyệt. Cần kiểm tra: icon bánh răng hiển thị đúng hình, thứ tự thanh trên màn hình hẹp, và animation sau khi chọn "Bình thường".

v47:
Liquid glass: quay về đúng bản v42 (scss/_glass.scss, scss/_panel.scss, --blur blur(22px) saturate(160%)). Đã gỡ lớp liquid bản 2 ở v46. Các thay đổi --glass-mul của Cài đặt vẫn giữ.
Thanh chuyển trang: thêm "Cài đặt" (icon bánh răng) sau "Công cụ", trước "Hướng dẫn". Đã bỏ nút bánh răng ngoài cùng ở cả 5 trang. Thanh còn 5 mục.
Tốc độ thanh: mở và thu nhãn, trượt thanh chọn tab (.nav-tabs__pill) và followNavPill() đều dùng 0.5s, cùng thời lượng page-in của chuyển trang. Đổi trong scss/_nav.scss và css/*.css (phần "thanh điều hướng" cuối file).
Animation chuyển trang vẫn là bản v42.

Chưa kiểm chứng: chưa chạy trình duyệt. Cần kiểm tra thanh 5 mục trên màn hình hẹp (≤640px) và độ khớp của thanh chọn tab sau khi nhãn mở xong.

v46:
Thanh trên thu gọn (scss/_nav.scss, js/topbar.js, js/transition.js): mặc định chỉ hiện icon. Máy tính: rê chuột vào thanh để nhãn mở rộng. Điện thoại: chạm vào vùng thanh để bật tắt, chạm ra ngoài để thu lại. Hiệu ứng mở rộng dùng max-width và opacity của .nav-link__label. Thanh kính (.nav-tabs__pill) được followNavPill() đo lại trong lúc nhãn đổi kích thước, nên luôn khớp tab.
Bỏ nút sáng/tối ở thanh trên trên cả 5 trang. Đổi giao diện chỉ còn ở trang Cài đặt (nút bánh răng mở trang đó). applyTheme và toggleTheme trong js/utils.js vẫn chạy và tự bỏ qua nếu không có nút.
Liquid glass bản 2: .panel, .kpi, .modal__content, .weather-panel, .budget-card, .weather-widget bo góc 1.125rem, có kính sáng ở mép trên, viền sáng trong và bóng mềm. --blur là blur(28px) saturate(190%).
Animation chuyển trang và chuyển tab vẫn là bản v42, không đổi.

Chưa kiểm chứng: chưa chạy trình duyệt. Cần kiểm tra: nhãn mở ra đúng khi rê chuột và khi chạm trên điện thoại thật, thanh kính khớp tab trong lúc chuyển, và độ sáng của kính trên nền sáng.

v46 (liquid glass theo mẫu và thanh trên thu gọn):
Liquid glass (scss/_glass.scss, css/*.css): ô .panel, .kpi, .modal__content, .weather-panel, .budget-card dùng ánh sáng loang từ góc trên trái, viền sáng mỏng bằng ::after (mask), đáy hơi tối và backdrop-filter mạnh hơn (blur(28px) saturate(190%) brightness(1.06)). .topbar và .nav-tabs cũng là kính. Bo góc .panel và .modal__content là 1.125rem.
Thanh trên thu gọn (js/topbar.js, .nav-link__label trong _glass.scss): mặc định chỉ hiện icon. Trên máy tính, rê vào vùng tab thì mở rộng, rời ra thì thu gọn. Trên điện thoại, chạm vào vùng tab khi đang thu gọn thì mở rộng và không chuyển trang; chạm lần nữa mới chuyển. Chạm ra ngoài thanh trên thì thu gọn. Focus bàn phím cũng mở rộng. Thanh kính bám theo tab trong lúc nhãn co giãn (rAF, 480ms).
settings.html: đã bỏ các thẻ script của tools.html bị sao chép nhầm (storage.js, calc.js, bank-rates.js, tools.js) và thẻ script trùng.

Chưa kiểm chứng: chưa chạy trình duyệt. Cần xem: độ rõ của kính trên nền sáng, mật độ của liquid trên màn hình hẹp, và cảm giác mở rộng trên điện thoại thật. Giả định: "bấm vào vùng đó" là vùng tab điều hướng, không phải toàn bộ tiêu đề.

v45: khôi phục animation từ bản redesign v42, đưa Cài đặt sang nút bánh răng, liquid glass cho mọi ô và tiêu đề thanh trên gọn hơn. Cách làm việc: trình biên dịch sass không có trong môi trường, nên css/ được dựng từ bản CSS v42 cộng các thay đổi, còn scss/ được sửa song song. Hai bên phải khớp nhau. Khi build lại bằng Live Sass Compiler, nếu có lệch thì scss/ là nguồn.

Chưa kiểm chứng: chưa chạy trình duyệt. Cần xem: liquid glass trên thẻ ngân sách và thời tiết, viền sáng trên nền sáng, tiêu đề thanh trên trên màn hình hẹp, và nút bánh răng khi trang đang ở Cài đặt.

v45: khôi phục animation từ bản redesign v42 (scss/_transition.scss, _topbar.scss, _transactions.scss, _panel.scss); đưa Cài đặt ra nút bánh răng cạnh nút đổi giao diện; liquid glass cho mọi ô; tiêu đề thanh trên gọn hơn.
v44: đã viết lại Hướng dẫn, thêm mục Cài đặt và giao diện, token hóa thời lượng và gom giảm chuyển động. Mục "Cài đặt" trên thanh chuyển trang ở v44 đã được thay bằng nút bánh răng ở v45. Các thay đổi animation của v44 bị thay thế bằng bản v42.
v43-step1 (đầu vào của v44): icon Phosphor cho danh mục và làm sạch emoji cũ trong localStorage, đã có sẵn trong zip gốc.
v42: mọi ô số tiền là ô số thuần (type="number", đánh dấu data-money). Dòng xem trước bên dưới hiển thị số có dấu chấm, ví dụ 5.000.000 ₫, cập nhật ngay khi gõ. Cách này không phụ thuộc bộ gõ tiếng Việt, nên ổn trên Windows, Unikey và điện thoại. Hàm xử lý nằm trong js/utils.js (parseMoney, setMoneyValue, updateMoneyPreview).
v41 (đã thay bằng v42): thông báo chuyển bộ gõ sang tiếng Anh.
v40: mọi ô nhập số có inputmode (số nguyên là numeric, tỷ lệ là decimal), để điện thoại mở bàn phím số. Đã thêm cho ô ngân sách tháng.
v40: hoàn tác định dạng lúc gõ ở các bản thử gần đây, quay về định dạng khi soạn xong (js/utils.js).
v38: ô số tiền hiện dấu chấm khi gõ Telex trên Windows. Nguyên nhân: bộ gõ giữ các số trong một phiên soạn tới khi commit. Trang rời ô rồi quay lại để buộc commit, sau đó định dạng (js/utils.js). Chưa kiểm chứng trên bộ gõ thật.
v37: sửa lỗi khi gõ Telex bằng bộ gõ Windows (không can thiệp lúc bộ gõ đang soạn, định dạng khi soạn xong). Ô ngân sách theo danh mục cũng định dạng số tiền.
v36: ô số tiền định dạng ngay khi gõ từng chữ số (xử lý ở sự kiện phím, nên áp dụng cả với bộ gõ Telex). Backspace và Delete xóa đúng một chữ số, bỏ qua dấu chấm (js/utils.js).
v35: ô số tiền tự thêm dấu chấm khi gõ bằng bộ gõ Telex (trước đó bị bỏ qua khi bộ gõ đang bật). Thêm bắt sự kiện keyup để dự phòng (js/utils.js).
v34: kết quả vay trả góp có tên dễ hiểu hơn và phần "Các con số này nghĩa là gì?" giải thích từng dòng bằng tiếng Việt thường.
v33: ô số tiền chỉ nhận chữ số, chặn chữ cái khi gõ Telex. Không định dạng lại trong lúc bộ gõ đang soạn chữ, mà định dạng khi soạn xong (js/utils.js).
v32: sửa lỗi con trỏ nhảy về cuối khi sửa số tiền ở giữa dãy (js/utils.js). Ô vay trả góp hiện cả hai ô, ô không dùng bị khóa.
v29: mọi ô số tiền (VND) hiển thị dấu chấm ngăn cách hàng nghìn ngay khi gõ, ví dụ 1.000 và 886.802. Hàm parseMoney và setMoneyValue nằm trong js/utils.js.
v29: "Vay trả góp đều" có thêm cách tính "Tôi biết số tiền trả mỗi tháng". Từ đó tính ra lãi suất năm (dư nợ giảm dần), lãi hiệu dụng, lãi tính trên gốc ban đầu, (solveMonthlyRate trong js/calc.js). Bảng trả góp từng tháng không đưa vào vì mỗi ngân hàng hoặc công ty tài chính có bảng riêng.
v28: trang Công cụ, mục "Vay trả góp đều" có ô chọn ngân hàng hoặc công ty tài chính cho vay tiêu dùng (danh sách trong js/bank-rates.js). Chọn đơn vị có số liệu thì lãi suất tự điền. Hiện chưa có số liệu đã kiểm chứng, nên ô lãi vẫn nhập tay và có liên kết đến trang chính thức. Thêm số liệu bằng cách điền rateMin, rateMax, updated.
v28 (chưa có): tự động cập nhật lãi suất qua GitHub Actions khi dự án được đưa lên GitHub.
v27: trang Giao dịch chia ba cột: trái 28% (thanh ngân sách, bộ lọc), giữa phần còn lại (thêm giao dịch, danh sách), phải 16% tối thiểu 220 px (thời tiết và công cụ dữ liệu). Bỏ tiêu đề "Thao tác phụ". Dưới 1100 px xếp một cột.
v27: trang Công cụ bỏ "Chia thu nhập 50/30/20" (trùng với ngân sách theo danh mục), thêm "Thuế thu nhập cá nhân" (personalIncomeTax trong js/calc.js). Các hằng số giảm trừ, bảo hiểm và bậc thuế nằm đầu calc.js. Cần kiểm tra lại khi luật thay đổi.
v27: khung (panel) có hiệu ứng kính mờ thật (backdrop-filter), và độ đục nền giảm để trong suốt hơn.
v26: trang Giao dịch thêm thẻ "Thu nhập tháng này", tổng hợp từ các giao dịch thu có trạng thái "Hoàn thành" trong tháng hiện tại. Thẻ này không lấy số từ ô "Thu nhập tháng này" trong form. Thẻ "Chi tháng này" đã có sẵn, nên chỉ thêm thẻ thu.
v26: dải thẻ tổng quan chuyển thành 5 cột từ 1101 px trở lên (scss/pages/index.scss, và css/index.css được sửa tay tương ứng). Trên màn hình hẹp vẫn là 2 cột.
v26: "Tổng thu nhập" và "Tổng chi tiêu" tính trên toàn bộ giao dịch, không tính theo năm.
Cập nhật README này.
Các bước trước
Sửa biểu đồ không hiện khi chạy Live Server. Nguyên nhân: js/vendor/chart.umd.min.js không tồn tại trong zip (file này chỉ được tạo bởi npm run vendor và không có trong bản gốc). Trang tải Chart.js dự phòng từ CDN bằng thẻ defer được chèn động nên có thể chạy sau khi biểu đồ đã vẽ. Đã thay bằng thẻ CDN đồng bộ đặt trước js/chart.js trong analytics.html. Đã kiểm tra: cả ba biểu đồ vẽ đúng ở 1440 px và 390 px.
Viết README này (v25).
v24: gỡ server, đăng nhập và tính năng AI, tỷ giá/lạm phát; viết lại README.
v25: bỏ toàn bộ thư mục và file ngoài css/, scss/, js/ và các trang HTML (skills/, tests/, .vscode/, package.json, WORKFLOW.md, CLAUDE.md, .gitignore).

Hệ quả: đã mất bộ kiểm thử npm test, lệnh npm run build:css, và ghi chú dự án trong WORKFLOW.md. Bản v24 vẫn giữ đầy đủ các file này.

Việc cần làm

Lưu ý: nếu chuyển sang máy chủ, mục 1 và 2 cần làm trước khi đưa dữ liệu thật lên; xem phần bảo mật đã bàn trong ghi chú của dự án.

Đồng bộ và đăng nhập: viết lại máy chủ, tài khoản và đồng bộ dữ liệu. Phần này đã được gỡ hoàn toàn.
Phân tích AI: tìm giải pháp (có thể qua máy chủ riêng hoặc trực tiếp từ trình duyệt với khóa do người dùng nhập) rồi thêm lại vào trang Biểu đồ & Phân tích.
Tỷ giá và lạm phát: thêm lại khi có nguồn dữ liệu phù hợp. Ô "Lạm phát năm" trong máy tính lãi kép hiện là nhập tay.
Kiểm thử: chưa có bộ kiểm thử nào. Nên viết lại ít nhất các hàm tính toán trong js/calc.js và js/storage.js.
Nội dung Hướng dẫn: đã viết lại ở v44 và cập nhật ở v1.10.19 (mục lục điện thoại, mục Lưu ý khi sử dụng). Cần cập nhật lại câu trả lời "Tôi có cần tài khoản không?" khi có đăng nhập.
Bộ icon: đã chuyển danh mục sang Phosphor ở v43-step1 và v44 xác nhận lại. Còn lại: thống nhất kích thước, độ dày nét cho các nút và trạng thái, và kiểm tra trên giao diện sáng và tối.
Animation: đã token hóa thời lượng và gom giảm chuyển động ở v44. Còn lại: _nav.scss và _transactions.scss, _analytics.scss vẫn có thời lượng cứng cần chuyển sang token, và kiểm tra mượt trên trình duyệt thật.
Gợi ý

Các chức năng mới có thể làm thành trang riêng, theo đúng cấu trúc hiện có (HTML, SCSS, JS):

Báo cáo theo năm: bảng thu, chi và số dư từng tháng trong năm, chọn năm để xem.
Ngân sách theo danh mục: đặt hạn mức cho từng danh mục chi và cảnh báo khi gần vượt.
Quản lý giao dịch định kỳ: trang riêng để thêm, sửa, tạm dừng các mục lặp lại hằng tháng.
Mục tiêu tiết kiệm: đặt số tiền cần đạt, ngày hạn và theo dõi tiến độ theo thời gian.
Nhập và xuất CSV: đọc và ghi file CSV để mở bằng Excel, ngoài file JSON hiện có.
