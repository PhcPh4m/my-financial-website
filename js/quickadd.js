// NHẬP NHANH MỘT DÒNG: "cơm trưa 45k hôm qua" -> giao dịch chi 45.000 đ, danh mục Ăn uống, ngày hôm qua.
// Hàm thuần: nhận chuỗi và ngày hôm nay, trả về giao dịch hoặc thông báo lỗi.

// Từ khóa để đoán danh mục chi. Khớp đầu tiên thắng, nên các nhóm cụ thể đứng trước.
const QUICK_EXPENSE_RULES = [
    [/(chuyển khoản|chuyen khoan|chuyển tiền|chuyen tien|\bck\b|thanh toán cho)/iu, 'Chuyển khoản'],
    [/(xăng|grab|taxi|xe ôm|gửi xe|vé xe|đi lại|be\b|xe buýt)/iu, 'Đi lại'],
    [/(thuê nhà|tiền nhà|nhà trọ|phòng trọ|tiền phòng)/iu, 'Tiền nhà'],
    [/(điện|nước|internet|wifi|wi-fi|điện thoại|cước|hóa đơn|vnpt|viettel|vinaphone|mobifone)/iu, 'Hóa đơn'],
    [/(thuốc|khám|bệnh viện|nha khoa|y tế|bác sĩ)/iu, 'Y tế'],
    [/(học phí|sách|khóa học|giáo dục|lớp học|vở|bút)/iu, 'Giáo dục'],
    [/(phim|game|net|karaoke|giải trí|nhạc)/iu, 'Giải trí'],
    [/(áo|quần|giày|mua sắm|shopee|lazada|tiki|siêu thị|đồ dùng)/iu, 'Mua sắm'],
    [/(cơm|phở|bún|bánh|trà sữa|cà phê|cafe|ăn|uống|nhậu|đồ ăn|quán|buffet|lẩu)/iu, 'Ăn uống']
];

// Từ khóa để nhận diện khoản thu.
const QUICK_INCOME_RULES = [
    [/(lương|thưởng|tiền thưởng)/iu, { type: 'income', category: 'Lương' }],
    [/(thưởng|bonus)/iu, { type: 'income', category: 'Thưởng' }],
    [/(lãi|cổ tức|đầu tư)/iu, { type: 'income', category: 'Đầu tư' }],
    [/(làm thêm|freelance|dạy thêm|cộng tác)/iu, { type: 'income', category: 'Làm thêm' }],
    [/(nhận|thu nhập|bán|được cho|nhận tiền)/iu, { type: 'income', category: 'Khác' }]
];

const DAY_MS = 24 * 60 * 60 * 1000;

// Đổi chuỗi số tiền thành số: 45k, 1.5tr, 45.000, 3,5tr, 200 ngàn...
function parseAmountToken(raw, suffix) {
    const s = raw.trim();
    let value;
    if (suffix) {
        value = Number(s.replace(',', '.'));
        if (!Number.isFinite(value)) return null;
        const mult = /^(k|ngàn|nghìn|ngan|nghin)$/i.test(suffix) ? 1_000 : 1_000_000;
        return Math.round(value * mult);
    }
    // Không có đơn vị: dấu . hoặc , theo nhóm ba chữ số là phân cách hàng nghìn.
    if (/^\d{1,3}([.,]\d{3})+$/.test(s)) return Number(s.replace(/[.,]/g, ''));
    value = Number(s.replace(',', '.'));
    return Number.isFinite(value) ? value : null;
}

// Tìm tất cả số tiền trong câu. Ưu tiên số có đơn vị (45k, 2tr); nếu không có thì lấy số lớn nhất.
function findAmount(text) {
    const re = /(\d+(?:[.,]\d+)*)\s*(k|ngàn|nghìn|ngan|nghin|tr|triệu|trieu|m)?(?![\p{L}\d])/giu;
    const found = [];
    let m;
    while ((m = re.exec(text)) !== null) {
        const value = parseAmountToken(m[1], m[2]);
        if (value === null) continue;
        found.push({ value, hasSuffix: Boolean(m[2]), index: m.index, length: m[0].length, raw: m[0] });
    }
    if (found.length === 0) return null;
    const withSuffix = found.filter((f) => f.hasSuffix);
    const pool = withSuffix.length ? withSuffix : found;
    return pool.reduce((best, f) => (f.value > best.value ? f : best));
}

// Tìm ngày trong câu: hôm nay, hôm qua, hôm kia, hoặc dd/mm (dd/mm/yyyy).
function findDate(text, today) {
    const lower = text.toLowerCase();
    const shift = (days) => new Date(today.getFullYear(), today.getMonth(), today.getDate() - days);
    if (/hôm kia/.test(lower)) return { date: shift(2), phrase: /hôm kia/i };
    if (/hôm qua/.test(lower)) return { date: shift(1), phrase: /hôm qua/i };
    if (/hôm nay/.test(lower)) return { date: shift(0), phrase: /hôm nay/i };
    const m = /(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/.exec(text);
    if (m) {
        const day = Number(m[1]);
        const month = Number(m[2]) - 1;
        const year = m[3] ? Number(m[3]) : today.getFullYear();
        const d = new Date(year, month, day);
        if (d.getDate() === day && d.getMonth() === month) return { date: d, phrase: new RegExp(m[0].replace(/\//g, '\\/')) };
    }
    return null;
}

function toISO(d) {
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Hàm chính: phân tích một dòng nhập nhanh.
function parseQuickEntry(text, today = new Date()) {
    const original = String(text || '').trim();
    if (!original) return { error: 'Hãy nhập nội dung, ví dụ "cơm trưa 45k".' };

    const amountHit = findAmount(original);
    if (!amountHit) return { error: 'Không tìm thấy số tiền. Thêm số như 45k, 1.5tr hoặc 45.000.' };
    if (!Number.isInteger(amountHit.value) || amountHit.value <= 0) {
        return { error: 'Số tiền phải là số nguyên dương.' };
    }

    const dateHit = findDate(original, today);
    const date = dateHit ? dateHit.date : new Date(today.getFullYear(), today.getMonth(), today.getDate());

    // Bỏ phần số tiền và ngày khỏi câu để lấy tên giao dịch.
    let title = original.slice(0, amountHit.index) + ' ' + original.slice(amountHit.index + amountHit.length);
    if (dateHit) title = title.replace(dateHit.phrase, ' ');
    title = title.replace(/\s+/g, ' ').replace(/^[\s,.;:-]+|[\s,.;:-]+$/g, '').trim();
    if (!title) return { error: 'Hãy thêm tên khoản thu hoặc chi, ví dụ "cơm trưa 45k".' };
    title = title.charAt(0).toUpperCase() + title.slice(1);
    if (title.length > 100) title = title.slice(0, 100);

    let type = 'expense';
    let category = 'Khác';
    const incomeHit = QUICK_INCOME_RULES.find(([re]) => re.test(title));
    if (incomeHit) {
        type = incomeHit[1].type;
        category = incomeHit[1].category;
    } else {
        const expenseHit = QUICK_EXPENSE_RULES.find(([re]) => re.test(title));
        if (expenseHit) category = expenseHit[1];
    }

    return {
        title,
        amount: amountHit.value,
        type,
        category,
        date: toISO(date),
        status: 'completed'
    };
}
