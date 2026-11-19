// Tên ngăn nhớ trong trình duyệt dùng để cất danh sách giao dịch.
const TX_KEY = 'financial_transactions';
// Tên ngăn nhớ cất số tiền ngân sách.
const BUDGET_KEY = 'monthly_budget';
// Thu nhập từng tháng, lưu dạng { "2026-11": 12000000 }.
const INCOME_KEY = 'monthly_income';
// Ngân sách theo danh mục (đối tượng: tên danh mục -> số tiền) và các quy tắc giao dịch định kỳ.
const CATEGORY_BUDGET_KEY = 'category_budgets';
const RECURRING_KEY = 'recurring_rules';
const WALLETS_KEY = 'wallets';
const WALLET_TRANSFERS_KEY = 'wallet_transfers';
const DEBTS_KEY = 'debts';
const DEFAULT_WALLET_ID = 'W-DEFAULT';

// Các danh mục chi tiêu có thể chọn, ví dụ ăn uống, tiền nhà.
const EXPENSE_CATEGORIES = [
    'Ăn uống',
    'Tiền nhà',
    'Mua sắm',
    'Đi lại',
    'Y tế',
    'Giáo dục',
    'Giải trí',
    'Hóa đơn',
    'Chuyển khoản',
    'Chưa phân loại',
    'Khác'
];

// Các danh mục thu nhập, ví dụ lương, thưởng.
const INCOME_CATEGORIES = [
    'Lương',
    'Thưởng',
    'Đầu tư',
    'Làm thêm',
    'Nhận hàng cho gia đình',
    'Khác'
];

// Bỏ emoji và khoảng trắng ở đầu tên danh mục cũ, ví dụ 'Ăn uống' có emoji ở đầu -> 'Ăn uống'.
function stripCategoryEmoji(name) {
    return String(name ?? '').replace(/^[\s\p{Extended_Pictographic}\uFE0F\u200D]+/u, '').trim();
}

// Chuyển tên danh mục trong các khóa ngân sách theo danh mục sang tên không emoji (chạy một lần).
function migrateCategoryKeys() {
    try {
        const budgets = JSON.parse(localStorage.getItem(CATEGORY_BUDGET_KEY) || '{}');
        if (budgets && typeof budgets === 'object' && !Array.isArray(budgets)) {
            const out = {};
            let changed = false;
            Object.entries(budgets).forEach(([name, value]) => {
                const clean = stripCategoryEmoji(name);
                if (clean !== name) changed = true;
                out[clean] = value;
            });
            if (changed) localStorage.setItem(CATEGORY_BUDGET_KEY, JSON.stringify(out));
        }
        const rules = JSON.parse(localStorage.getItem(RECURRING_KEY) || '[]');
        if (Array.isArray(rules)) {
            let changed = false;
            const out = rules.map((r) => {
                const clean = stripCategoryEmoji(r && r.category);
                if (clean !== r.category) changed = true;
                return { ...r, category: clean };
            });
            if (changed) localStorage.setItem(RECURRING_KEY, JSON.stringify(out));
        }
    } catch (error) {
        console.error('Không chuyển được tên danh mục cũ:', error);
    }
}

// TRANSACTIONS – CRUD

// Kiểm tra một giao dịch đọc từ kho có đủ thông tin và đúng kiểu không. Nếu hỏng thì bỏ qua.
function isStoredTransaction(t) {
    return Boolean(
        t && typeof t === 'object' &&
        typeof t.id === 'string' &&
        typeof t.title === 'string' &&
        Number.isFinite(t.amount) &&
        ['income', 'expense'].includes(t.type) &&
        ['completed', 'pending'].includes(t.status) &&
        isValidISODate(t.date) &&
        (t.walletId === undefined || typeof t.walletId === 'string')
    );
}

// Lấy toàn bộ giao dịch từ kho, bỏ qua các dòng bị hỏng.
function getTransactions() {
    try {
        // Chỉ đọc, không ghi lại kho. Việc chuyển dữ liệu cũ đã làm một lần lúc khởi động (migrateStoredData).
        const data = JSON.parse(localStorage.getItem(TX_KEY) || '[]');
        return Array.isArray(data) ? data.filter(isStoredTransaction) : [];
    } catch (error) {
        console.error('Không đọc được dữ liệu giao dịch:', error);
        return [];
    }
}

// Chạy một lần khi mở trang: chuyển dữ liệu cũ sang định dạng mới và bỏ bản ghi hỏng (nếu có).
function migrateStoredData() {
    try {
        const data = JSON.parse(localStorage.getItem(TX_KEY) || '[]');
        if (!Array.isArray(data)) return;
        const valid = data.filter(isStoredTransaction);
        if (valid.length !== data.length) {
            console.warn(`Bỏ qua ${data.length - valid.length} bản ghi không hợp lệ.`);
        }
        migrateTransactions(valid);
    } catch (error) {
        console.error('Không chuyển được dữ liệu cũ:', error);
    }
    migrateCategoryKeys();
    ensureDefaultWallet();
}

// Chuyển dữ liệu cũ sang định dạng mới: mã GD..., và createdDate thay cho createdAt.
// Chỉ ghi lại kho khi có thay đổi, nên các lần sau không làm gì thêm.
function migrateTransactions(list) {
    let counter = maxIdNumber(list);
    let changed = false;
    const out = list.map((t) => {
        let item = { ...t };
        if (!/^GD\d+$/.test(item.id)) {
            counter++;
            item.id = 'GD' + String(counter).padStart(3, '0');
            changed = true;
        }
        if (!item.createdDate) {
            item.createdDate = nowText(new Date(item.createdAt || Date.now()));
            changed = true;
        }
        if ('createdAt' in item) {
            delete item.createdAt;
            changed = true;
        }
        if (!item.walletId) {
            item.walletId = DEFAULT_WALLET_ID;
            changed = true;
        }
        const cleanCategory = stripCategoryEmoji(item.category);
        if (cleanCategory !== item.category) {
            item.category = cleanCategory;
            changed = true;
        }
        // Tên đọc từ OCR cũ có thể còn icon rời (« Apple, q VNPT). Làm sạch một lần.
        if (typeof cleanBankDescription === 'function' && item.title) {
            const cleanTitle = cleanBankDescription(item.title);
            if (cleanTitle && cleanTitle !== item.title) {
                item.title = cleanTitle;
                changed = true;
            }
        }
        return item;
    });
    if (changed) saveTransactions(out);
    return out;
}

// Cất toàn bộ danh sách giao dịch vào kho. Nếu kho đầy thì báo không lưu được.
function saveTransactions(list) {
    try {
        // Ghi toàn bộ danh sách giao dịch xuống localStorage dưới khóa TX_KEY.
        localStorage.setItem(TX_KEY, JSON.stringify(list));
        return true;
    } catch (error) {
        console.error('Không lưu được dữ liệu:', error);
        return false;
    }
}

// Số lớn nhất trong các mã dạng GD001, GD002... (bỏ qua mã cũ).
function maxIdNumber(list) {
    let max = 0;
    list.forEach((t) => {
        const m = /^GD(\d+)$/.exec(t.id);
        if (m) max = Math.max(max, Number(m[1]));
    });
    return max;
}

// Mã giao dịch tiếp theo, ví dụ GD007.
function nextId(list) {
    return 'GD' + String(maxIdNumber(list) + 1).padStart(3, '0');
}

// Thời điểm lưu dạng "2026-11-11 14:05:33", dễ đọc và sắp xếp được theo chữ.
function nowText(date = new Date()) {
    const p = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())} ` +
           `${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`;
}

// Dọn dữ liệu cho gọn: chỉ giữ các trường cần thiết và đúng kiểu.
function normalizeTransaction(data) {
    return {
        title: String(data.title ?? '').trim(),
        amount: Math.round(Number(data.amount)),
        type: data.type,
        category: stripCategoryEmoji(data.category),
        status: data.status,
        date: data.date,
        walletId: data.walletId || DEFAULT_WALLET_ID
    };
}

// Tìm một giao dịch theo mã. Không có thì trả về rỗng.
function getTransactionById(id) {
    return getTransactions().find((t) => t.id === id) || null;
}

// Thêm một giao dịch mới vào kho.
function addTransaction(data) {
    const existing = getTransactions();
    const tx = { ...normalizeTransaction(data), id: nextId(existing), createdDate: nowText() };
    return saveTransactions([...existing, tx]) ? tx : null;
}

// Sửa một giao dịch theo mã, giữ nguyên mã và ngày tạo.
function updateTransaction(id, data) {
    const list = getTransactions().map((t) =>
        t.id === id ? { ...t, ...normalizeTransaction(data) } : t
    );
    return saveTransactions(list);
}

// Xóa một giao dịch theo mã.
function deleteTransaction(id) {
    return saveTransactions(getTransactions().filter((t) => t.id !== id));
}

// Đổi trạng thái: Hoàn thành hoặc Chưa thanh toán.
function toggleTransactionStatus(id) {
    const list = getTransactions().map((t) =>
        t.id === id ? { ...t, status: t.status === 'completed' ? 'pending' : 'completed' } : t
    );
    return saveTransactions(list);
}

// BUDGET

// Đọc số tiền ngân sách đã đặt.
function getBudget() {
    try {
        const raw = localStorage.getItem(BUDGET_KEY);
        const value = raw === null ? NaN : Number(raw);
        return Number.isFinite(value) && value > 0 ? value : null;
    } catch (error) {
        console.error('Không đọc được ngân sách:', error);
        return null;
    }
}

// Lưu số tiền ngân sách.
function setBudget(amount) {
    try {
        localStorage.setItem(BUDGET_KEY, String(Math.round(amount)));
        return true;
    } catch (error) {
        console.error('Không lưu được ngân sách:', error);
        return false;
    }
}

// Thu nhập của một tháng (đơn vị VND). Trả về null nếu chưa nhập.
function getMonthlyIncome(monthKey) {
    try {
        const map = JSON.parse(localStorage.getItem(INCOME_KEY) || '{}');
        const value = Number(map[monthKey]);
        return Number.isFinite(value) && value > 0 ? value : null;
    } catch (error) {
        console.error('Không đọc được thu nhập tháng:', error);
        return null;
    }
}

// Lưu thu nhập của một tháng. Nhập 0 hoặc để trống thì xóa số đã lưu của tháng đó.
function setMonthlyIncome(monthKey, amount) {
    try {
        const map = JSON.parse(localStorage.getItem(INCOME_KEY) || '{}');
        const value = Math.round(Number(amount));
        if (Number.isFinite(value) && value > 0) map[monthKey] = value;
        else delete map[monthKey];
        localStorage.setItem(INCOME_KEY, JSON.stringify(map));
        return true;
    } catch (error) {
        console.error('Không lưu được thu nhập tháng:', error);
        return false;
    }
}

// Xóa ngân sách.
function removeBudget() {
    try {
        localStorage.removeItem(BUDGET_KEY);
        return true;
    } catch (error) {
        console.error('Không xóa được ngân sách:', error);
        return false;
    }
}

// CATEGORIES

// Lấy danh mục đúng theo loại thu hoặc chi.
function getCategoriesFor(type) {
    return type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
}

// Gộp mọi danh mục (cả thu và chi) để đổ vào ô lọc.
function getAllCategories() {
    return [...new Set([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES])];
}

// HOÀN TÁC

// Đưa lại một giao dịch đã xóa, giữ nguyên mã và ngày tạo.
function restoreTransaction(tx) {
    if (!tx || !tx.id) return false;
    const list = getTransactions();
    if (list.some((t) => t.id === tx.id)) return true;
    return saveTransactions([...list, tx]);
}

// NGÂN SÁCH THEO DANH MỤC

// Đọc ngân sách từng danh mục. Chỉ giữ các số dương hợp lệ.
function getCategoryBudgets() {
    try {
        const data = JSON.parse(localStorage.getItem(CATEGORY_BUDGET_KEY) || '{}');
        if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
        const out = {};
        Object.entries(data).forEach(([name, value]) => {
            if (typeof name === 'string' && Number.isFinite(value) && value > 0) out[name] = Math.round(value);
        });
        return out;
    } catch (error) {
        console.error('Không đọc được ngân sách danh mục:', error);
        return {};
    }
}

// Đặt hoặc xóa (amount rỗng/0) ngân sách của một danh mục.
function setCategoryBudget(category, amount) {
    const all = getCategoryBudgets();
    const value = Math.round(Number(amount) || 0);
    if (value > 0) all[category] = value;
    else delete all[category];
    try {
        localStorage.setItem(CATEGORY_BUDGET_KEY, JSON.stringify(all));
        return true;
    } catch (error) {
        console.error('Không lưu được ngân sách danh mục:', error);
        return false;
    }
}

// GIAO DỊCH ĐỊNH KỲ

// Đọc các quy tắc định kỳ đã lưu.
function getRecurringRules() {
    try {
        const data = JSON.parse(localStorage.getItem(RECURRING_KEY) || '[]');
        return Array.isArray(data) ? data.filter(isValidRecurringRule) : [];
    } catch (error) {
        console.error('Không đọc được giao dịch định kỳ:', error);
        return [];
    }
}

function saveRecurringRules(list) {
    try {
        localStorage.setItem(RECURRING_KEY, JSON.stringify(list));
        return true;
    } catch (error) {
        console.error('Không lưu được giao dịch định kỳ:', error);
        return false;
    }
}

// Kiểm tra một quy tắc định kỳ: tên, số tiền, loại, danh mục, ngày trong tháng (1-28), tháng bắt đầu và kết thúc.
function isValidRecurringRule(r) {
    return Boolean(
        r && typeof r === 'object' &&
        typeof r.id === 'string' &&
        typeof r.title === 'string' && r.title.trim() &&
        Number.isInteger(r.amount) && r.amount > 0 &&
        ['income', 'expense'].includes(r.type) &&
        typeof r.category === 'string' && r.category &&
        Number.isInteger(r.day) && r.day >= 1 && r.day <= 28 &&
        /^\d{4}-\d{2}$/.test(r.startMonth || '') &&
        (r.endMonth === null || r.endMonth === undefined || /^\d{4}-\d{2}$/.test(r.endMonth))
    );
}

// Thêm một quy tắc mới. Trả về quy tắc đã lưu hoặc null nếu dữ liệu không hợp lệ.
function addRecurringRule(data) {
    const rule = {
        id: 'RR' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        title: String(data.title ?? '').trim().slice(0, MAX_TITLE_LENGTH),
        amount: Math.round(Number(data.amount)),
        type: data.type,
        category: stripCategoryEmoji(data.category),
        day: Number(data.day),
        startMonth: data.startMonth,
        endMonth: data.endMonth || null
    };
    if (!isValidRecurringRule(rule)) return null;
    if (rule.endMonth && rule.endMonth < rule.startMonth) return null;
    return saveRecurringRules([...getRecurringRules(), rule]) ? rule : null;
}

function removeRecurringRule(id) {
    return saveRecurringRules(getRecurringRules().filter((r) => r.id !== id));
}

// RESET

// Xóa sạch toàn bộ giao dịch, ngân sách, ngân sách danh mục và giao dịch định kỳ.
function clearAllData() {
    try {
        localStorage.removeItem(TX_KEY);
        localStorage.removeItem(BUDGET_KEY);
        localStorage.removeItem(CATEGORY_BUDGET_KEY);
        localStorage.removeItem(RECURRING_KEY);
        localStorage.removeItem(INCOME_KEY);
        localStorage.removeItem(WALLETS_KEY);
        localStorage.removeItem(DEBTS_KEY);
        return true;
    } catch (error) {
        console.error('Không xóa được dữ liệu:', error);
        return false;
    }
}

// VÍ (TÀI KHOẢN NHẬP TAY)

// Ví mặc định luôn có. Giao dịch cũ không có ví sẽ được gắn vào đây khi mở trang.
function ensureDefaultWallet() {
    const list = readWallets();
    if (list.some((w) => w.id === DEFAULT_WALLET_ID)) return;
    saveWallets([{ id: DEFAULT_WALLET_ID, name: 'Mặc định', openingBalance: 0 }, ...list]);
}

function isValidWallet(w) {
    return Boolean(
        w && typeof w === 'object' &&
        typeof w.id === 'string' && w.id.length > 0 &&
        typeof w.name === 'string' && w.name.trim().length > 0 && w.name.length <= 40 &&
        Number.isFinite(w.openingBalance)
    );
}

function readWallets() {
    try {
        const data = JSON.parse(localStorage.getItem(WALLETS_KEY) || '[]');
        return Array.isArray(data) ? data.filter(isValidWallet) : [];
    } catch (error) {
        console.error('Không đọc được danh sách ví:', error);
        return [];
    }
}

function getWallets() {
    const list = readWallets();
    if (list.some((w) => w.id === DEFAULT_WALLET_ID)) return list;
    return [{ id: DEFAULT_WALLET_ID, name: 'Mặc định', openingBalance: 0 }, ...list];
}

function saveWallets(list) {
    try {
        localStorage.setItem(WALLETS_KEY, JSON.stringify(list));
        return true;
    } catch (error) {
        console.error('Không lưu được ví:', error);
        return false;
    }
}

function walletNameOf(id) {
    const w = getWallets().find((x) => x.id === id);
    return w ? w.name : 'Mặc định';
}

// Đổi ví trong file nhập vào thành mã ví thật. Không khớp thì rơi về ví Mặc định.
function resolveWalletId(raw) {
    if (!raw) return DEFAULT_WALLET_ID;
    const wallets = getWallets();
    if (raw.walletId && wallets.some((w) => w.id === raw.walletId)) return raw.walletId;
    const name = String(raw.wallet ?? '').trim().toLowerCase();
    const byName = wallets.find((w) => w.name.trim().toLowerCase() === name);
    return byName ? byName.id : DEFAULT_WALLET_ID;
}

// Thêm ví mới với số dư đầu. Tên trùng (không phân biệt hoa thường) thì không thêm.
function addWallet(name, openingBalance = 0) {
    const clean = String(name ?? '').trim();
    if (!clean || clean.length > 40) return null;
    const list = getWallets();
    if (list.some((w) => w.name.trim().toLowerCase() === clean.toLowerCase())) return null;
    const wallet = { id: 'W' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), name: clean, openingBalance: Math.round(Number(openingBalance) || 0) };
    return saveWallets([...readWallets(), wallet]) ? wallet : null;
}

// Xóa ví. Giao dịch của ví đó được chuyển về ví Mặc định, không bị mất. Không xóa được ví Mặc định.
function removeWallet(id) {
    if (id === DEFAULT_WALLET_ID) return false;
    const txs = getTransactions();
    const moved = txs.map((t) => (t.walletId === id ? { ...t, walletId: DEFAULT_WALLET_ID } : t));
    if (!saveTransactions(moved)) return false;
    const remapped = readWalletTransfers()
        .map((t) => ({ ...t, from: t.from === id ? DEFAULT_WALLET_ID : t.from, to: t.to === id ? DEFAULT_WALLET_ID : t.to }))
        .filter((t) => t.from !== t.to);
    saveWalletTransfers(remapped);
    return saveWallets(readWallets().filter((w) => w.id !== id));
}

// KHOẢN VAY VÀ NỢ: số tiền còn nợ, lưu riêng để không lẫn vào giao dịch thu chi.
function isValidDebt(d) {
    return Boolean(
        d && typeof d === 'object' &&
        typeof d.id === 'string' && d.id.length > 0 &&
        typeof d.name === 'string' && d.name.trim().length > 0 && d.name.length <= 40 &&
        Number.isFinite(d.balance) && d.balance >= 0
    );
}

function readDebts() {
    try {
        const data = JSON.parse(localStorage.getItem(DEBTS_KEY) || '[]');
        return Array.isArray(data) ? data.filter(isValidDebt) : [];
    } catch (error) {
        console.error('Không đọc được khoản nợ:', error);
        return [];
    }
}

function saveDebts(list) {
    try {
        localStorage.setItem(DEBTS_KEY, JSON.stringify(list));
        return true;
    } catch (error) {
        console.error('Không lưu được khoản nợ:', error);
        return false;
    }
}

function addDebt(name, balance) {
    const item = { id: 'debt_' + Date.now().toString(36), name: name.trim(), balance };
    saveDebts([...readDebts(), item]);
    return item;
}

function removeDebt(id) {
    saveDebts(readDebts().filter((d) => d.id !== id));
}

// Danh sách chuyển tiền giữa ví đã lưu. Bỏ bản ghi hỏng.
function readWalletTransfers() {
    try {
        const data = JSON.parse(localStorage.getItem(WALLET_TRANSFERS_KEY) || '[]');
        return Array.isArray(data) ? data.filter(isValidWalletTransfer) : [];
    } catch (error) {
        console.error('Không đọc được chuyển tiền giữa ví:', error);
        return [];
    }
}

function saveWalletTransfers(list) {
    try {
        localStorage.setItem(WALLET_TRANSFERS_KEY, JSON.stringify(list));
        return true;
    } catch (error) {
        console.error('Không lưu được chuyển tiền:', error);
        return false;
    }
}

function isValidWalletTransfer(t) {
    return Boolean(t) && typeof t.id === 'string' && typeof t.from === 'string' && typeof t.to === 'string'
        && Number.isInteger(t.amount) && t.amount > 0 && isValidISODate(t.date);
}
