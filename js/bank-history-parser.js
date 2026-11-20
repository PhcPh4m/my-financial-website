// ----------------------------------------------------------------------------
// Tách danh sách giao dịch từ văn bản OCR của ảnh lịch sử giao dịch.
// Hỗ trợ hai kiểu bố cục:
//  - Kiểu ngân hàng: ngày nằm ở đầu mỗi giao dịch (dd/mm/yyyy).
//  - Kiểu MoMo: tên và số tiền nằm trước, dòng "HH:mm - dd/mm" nằm cuối mỗi giao dịch,
//    năm lấy từ dòng tiêu đề "Tháng 11/2026".
// Hàm thuần, không đụng đến giao diện hay localStorage. Kết quả chỉ là gợi ý,
// người dùng xác nhận trước khi ghi vào danh sách.
// ----------------------------------------------------------------------------

const BANK_FULL_DATE_RE = /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4}|\d{2})\b/;
// Dòng "11:39 - 16/11" hoặc "11:39 16/11/2026" (dấu gạch có thể thiếu hoặc bị OCR đọc khác)
const BANK_TIME_DATE_RE = /(\d{1,2}:\d{2})\s*[-–—]?\s*(\d{1,2})\/(\d{1,2})(?:\/(\d{4}|\d{2}))?/;
// Dòng chỉ có ngày, ví dụ "16/11" khi OCR tách riêng khỏi giờ
const BANK_DATE_ONLY_RE = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}|\d{2}))?$/;
// Số tiền: có thể có dấu +/- (kể cả dấu gạch dài bị OCR đọc thành — hoặc –), có nhóm nghìn hoặc đ/vnd.
const BANK_AMOUNT_RE = /([+\-−–—])?\s?(\d{1,3}(?:[.,]\d{3})+|\d+)(\s?(?:đ|d|vnd))?/gi;
// Cụm "Số dư ...: 2.306.011đ" hoặc "Số dư sau giao dịch 8.000.000" cần bỏ khỏi dòng trước khi tìm số tiền.
const BANK_BALANCE_PHRASE_RE = /s[ốo]\s*d[ưu][^\d\n]*(?:\d[\d.,]*)?\s*(?:đ|d|vnd)?/gi;
const BANK_HEADER_RE = /^th[áa]ng\s+\d{1,2}\b/i;
const BANK_TIME_ONLY_RE = /^\d{1,2}:\d{2}(:\d{2})?$/;

function bankToIso(day, month, year) {
    const d = Number(day);
    const m = Number(month);
    let y = Number(year);
    if (y < 100) y += 2000;
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// Tìm số tiền hợp lệ đầu tiên trong một dòng. Số không có nhóm nghìn, không có dấu
// và không có đ/vnd (như số tài khoản hay mã giao dịch) bị bỏ qua.
function findBankAmount(line) {
    BANK_AMOUNT_RE.lastIndex = 0;
    let m;
    while ((m = BANK_AMOUNT_RE.exec(line)) !== null) {
        const rawSign = m[1];
        const sign = rawSign ? (/[+]/.test(rawSign) ? '+' : '-') : null;
        const hasGroups = m[2].includes('.') || m[2].includes(',');
        const hasSuffix = Boolean(m[3]);
        const digits = m[2].replace(/\D/g, '');
        const plausible = digits.length >= 4 && digits.length <= 12;
        if (plausible && (hasGroups || hasSuffix || sign)) {
            return { raw: m[0], sign, digits };
        }
    }
    return null;
}

// Bỏ cụm số dư khỏi dòng để không nhầm với số tiền giao dịch.
function stripBalance(line) {
    return line.replace(BANK_BALANCE_PHRASE_RE, ' ').replace(/\s+/g, ' ').trim();
}

// Làm sạch tên giao dịch sau OCR. Icon bên trái tên thường bị đọc thành ký tự rời
// (« Apple, q VNPT, 8] Nạp tiền), và chữ cái rời giữa tên (PHAM NGOC s TRUONG).
// Chỉ bỏ ký tự rời là chữ thường ASCII hoặc ký hiệu, nên chữ A viết hoa trong tên ngân hàng được giữ.
function cleanBankDescription(text) {
    const tokens = String(text || '')
        .replace(/[«»‹›|~]/g, ' ')
        .replace(/\s+([:,.;])/g, '$1')
        .split(/\s+/)
        .filter(Boolean)
        .filter((tok) => !/^\p{Ll}$/u.test(tok))               // chữ thường rời, kể cả có dấu: q, s, é
        .filter((tok) => /[\p{L}\p{N}]/u.test(tok))            // ký hiệu rời: [ ] ( ) :
        .filter((tok) => !/^\d+[\]\)\}\|]+$/.test(tok));       // số kèm ngoặc: 8]
    return tokens
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 120);
}

// Từ các dòng của một giao dịch, lấy số tiền đầu tiên và ghép phần còn lại thành tên.
function buildRow(lines, date) {
    let amount = null;
    let sign = null;
    const desc = [];
    lines.forEach((line) => {
        let rest = line;
        if (amount === null) {
            const found = findBankAmount(rest);
            if (found) {
                amount = found.digits;
                sign = found.sign;
                rest = rest.replace(found.raw, ' ');
            }
        }
        rest = rest.replace(/\s+/g, ' ').trim();
        if (rest && !BANK_TIME_ONLY_RE.test(rest)) desc.push(rest);
    });
    if (!amount || !date) return null;
    return {
        date,
        description: cleanBankDescription(desc.join(' ')),
        amount,
        type: sign === '+' ? 'income' : sign === '-' ? 'expense' : null,
    };
}

// Trả về mảng giao dịch: { date, description, amount, type }.
// type: 'income' (dấu +), 'expense' (dấu -), hoặc null nếu không có dấu.
function parseBankHistory(text) {
    const lines = String(text || '')
        .split(/\r?\n/)
        .map((s) => stripBalance(s.replace(/\s+/g, ' ').trim()))
        .filter(Boolean)
        .filter((l) => !BANK_HEADER_RE.test(l));

    // Năm mặc định: lấy từ tiêu đề "Tháng 11/2026" nếu có, nếu không thì năm hiện tại.
    let defaultYear = new Date().getFullYear();
    const headerYear = String(text || '').match(/th[áa]ng\s+\d{1,2}\s*\/\s*(\d{4})/i);
    if (headerYear) defaultYear = Number(headerYear[1]);

    const isMomoStyle = lines.some((l) => BANK_TIME_DATE_RE.test(l));
    const rows = [];

    if (isMomoStyle) {
        // Mỗi giao dịch kết thúc bằng dòng giờ-ngày, nên các dòng trước đó thuộc giao dịch đó.
        let pending = [];
        lines.forEach((line) => {
            const tm = line.match(BANK_TIME_DATE_RE);
            const dOnly = line.match(BANK_DATE_ONLY_RE);
            if (tm || dOnly) {
                const m = tm || dOnly;
                const day = tm ? m[2] : m[1];
                const month = tm ? m[3] : m[2];
                const year = (tm ? m[4] : m[3]) || defaultYear;
                const before = tm ? line.slice(0, tm.index).trim() : '';
                if (before) pending.push(before);
                const row = buildRow(pending, bankToIso(day, month, year));
                if (row) rows.push(row);
                pending = [];
            } else {
                pending.push(line);
            }
        });
    } else {
        // Kiểu ngân hàng: dòng có ngày đầy đủ bắt đầu một giao dịch mới.
        let current = null;
        lines.forEach((line) => {
            const dm = line.match(BANK_FULL_DATE_RE);
            if (dm) {
                current = { date: bankToIso(dm[1], dm[2], dm[3]), lines: [] };
                const rest = line.replace(BANK_FULL_DATE_RE, ' ').trim();
                if (rest) current.lines.push(rest);
                rows.push(current);
                return;
            }
            if (current) current.lines.push(line);
        });
        rows.forEach((r) => {
            const row = buildRow(r.lines, r.date);
            r.built = row;
        });
        return rows.map((r) => r.built).filter(Boolean);
    }

    return rows;
}
