// Tên ngăn nhớ trong trình duyệt dùng để cất danh sách giao dịch.
const TX_KEY = 'financial_transactions';
// Tên ngăn nhớ cất số tiền ngân sách.
const BUDGET_KEY = 'monthly_budget';
// Thu nhập từng tháng, lưu dạng { "2026-11": 12000000 }.
const INCOME_KEY = 'monthly_income';
// Ngân sách theo danh mục (đối tượng: tên danh mục -> số tiền) và các quy tắc giao dịch định kỳ.
const CATEGORY_BUDGET_KEY = 'category_budgets';
const RECURRING_KEY = 'recurring_rules';

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
    'Khác'
];

// Các danh mục thu nhập, ví dụ lương, thưởng.
const INCOME_CATEGORIES = [
    'Lương',
    'Thưởng',
    'Đầu tư',
    'Làm thêm',
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

// Tên các cột trong file CSV, giống hàng tiêu đề của bảng tính Excel.
const CSV_HEADERS = ['title', 'amount', 'type', 'category', 'status', 'date'];

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
        isValidISODate(t.date)
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
        const cleanCategory = stripCategoryEmoji(item.category);
        if (cleanCategory !== item.category) {
            item.category = cleanCategory;
            changed = true;
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
        date: data.date
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

// STATISTICS
// Only "completed" transactions count toward totals; "pending" ones are shown
// in lists and counted separately.

// Chỉ giữ lại các giao dịch thuộc một tháng.
function filterByMonth(list, monthKey) {
    return monthKey ? list.filter((t) => t.date.startsWith(monthKey)) : list;
}

// Tính tổng thu, tổng chi và số dư. Chỉ tính giao dịch đã hoàn thành.
function summarize(list) {
    let income = 0;
    let expense = 0;
    let completed = 0;
    let pending = 0;

    list.forEach((t) => {
        if (t.status === 'completed') {
            completed++;
            if (t.type === 'income') income += t.amount;
            else expense += t.amount;
        } else {
            pending++;
        }
    });

    return { income, expense, balance: income - expense, total: list.length, completed, pending };
}

// So sánh một tháng với tháng ngay trước đó. Dùng cho badge % thay đổi trên các ô số liệu.
function compareWithPreviousMonth(list, monthKey) {
    return {
        current: summarize(filterByMonth(list, monthKey)),
        previous: summarize(filterByMonth(list, shiftMonth(monthKey, -1)))
    };
}

// Cộng chi tiêu theo từng danh mục, xếp từ nhiều đến ít. Dùng cho biểu đồ tròn.
function getExpenseByCategory(list) {
    const map = new Map();
    list.forEach((t) => {
        if (t.type === 'expense' && t.status === 'completed') {
            map.set(t.category, (map.get(t.category) || 0) + t.amount);
        }
    });
    return [...map.entries()]
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount);
}

// Cộng chi tiêu theo từng ngày trong tháng. Dùng cho biểu đồ cột theo ngày.
function getDailyExpense(list, monthKey) {
    if (!/^\d{4}-\d{2}$/.test(monthKey || '')) return { labels: [], values: [] };

    const [year, month] = monthKey.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const totals = new Array(daysInMonth).fill(0);

    list.forEach((t) => {
        if (t.type === 'expense' && t.status === 'completed' && t.date.startsWith(monthKey)) {
            totals[Number(t.date.slice(8, 10)) - 1] += t.amount;
        }
    });

    return {
        labels: totals.map((_, i) => String(i + 1).padStart(2, '0')),
        values: totals
    };
}

// Tính thu, chi và số dư từng tháng theo thứ tự thời gian. Dùng cho biểu đồ cột và bảng.
function getMonthlySeries(list) {
    const map = new Map();
    list.forEach((t) => {
        if (t.status !== 'completed') return;
        const key = t.date.slice(0, 7);
        const row = map.get(key) || { month: key, income: 0, expense: 0 };
        if (t.type === 'income') row.income += t.amount;
        else row.expense += t.amount;
        map.set(key, row);
    });

    let running = 0;
    return [...map.values()]
        .sort((a, b) => a.month.localeCompare(b.month))
        .map((row) => {
            running += row.income - row.expense;
            return { ...row, balance: running };
        });
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

// Tính đã tiêu bao nhiêu phần trăm ngân sách tháng và đang ở mức nào.
function getBudgetStatus(monthKey) {
    const budget = getBudget();
    if (!budget) return null;

    const spent = summarize(filterByMonth(getTransactions(), monthKey)).expense;
    const percent = (spent / budget) * 100;
    let level = 'ok';
    if (percent >= 100) level = 'danger';
    else if (percent >= 80) level = 'warning';

    return { budget, spent, percent, level };
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

// EXPORT

// Xuất toàn bộ dữ liệu thành file JSON để sao lưu.
function exportAsJSON() {
    return JSON.stringify(
        {
            app: 'web-quan-ly-tai-chinh-ca-nhan',
            version: 3,
            exportedAt: new Date().toISOString(),
            budget: getBudget(),
            categoryBudgets: getCategoryBudgets(),
            recurringRules: getRecurringRules(),
            transactions: getTransactions()
        },
        null,
        2
    );
}

// Bọc một ô trong dấu ngoặc kép nếu nội dung có dấu phẩy, để file CSV không bị lệch cột.
function csvEscape(value) {
    let s = String(value ?? '');
    // Ô bắt đầu bằng = + - @ sẽ thành công thức khi mở bằng Excel. Thêm dấu ' phía trước để Excel coi là chữ.
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Gỡ dấu ' mà exportAsCSV đã thêm, để dữ liệu nhập lại đúng như ban đầu.
function unescapeCsvFormula(value) {
    const s = String(value ?? '');
    return /^'[=+\-@\t\r]/.test(s) ? s.slice(1) : s;
}

// Xuất dữ liệu thành file CSV, mở được bằng Excel.
function exportAsCSV() {
    const rows = [CSV_HEADERS.join(',')];
    getTransactions().forEach((t) => {
        rows.push(CSV_HEADERS.map((h) => csvEscape(t[h])).join(','));
    });
    return '\uFEFF' + rows.join('\r\n');
}

// IMPORT

// Đọc file CSV, tách từng dòng và từng ô.
function parseCSV(text) {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (inQuotes) {
            if (c === '"') {
                if (text[i + 1] === '"') { field += '"'; i++; }
                else inQuotes = false;
            } else {
                field += c;
            }
        } else if (c === '"') {
            inQuotes = true;
        } else if (c === ',') {
            row.push(field);
            field = '';
        } else if (c === '\n' || c === '\r') {
            if (c === '\r' && text[i + 1] === '\n') i++;
            row.push(field);
            rows.push(row);
            row = [];
            field = '';
        } else {
            field += c;
        }
    }
    if (field.length || row.length) {
        row.push(field);
        rows.push(row);
    }
    return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

// Đổi các dòng CSV đã đọc thành danh sách giao dịch.
function rowsToTransactions(rows) {
    if (rows.length < 2) return [];
    const headers = rows[0].map((h) => h.trim().toLowerCase());
    const indexOf = (name) => headers.indexOf(name);

    return rows.slice(1).map((cells) => {
        const get = (name) => (indexOf(name) >= 0 ? cells[indexOf(name)] ?? '' : '');
        return {
            title: unescapeCsvFormula(get('title')),
            amount: get('amount'),
            type: get('type').trim().toLowerCase(),
            category: unescapeCsvFormula(get('category')),
            status: get('status').trim().toLowerCase(),
            date: get('date').trim()
        };
    });
}

// Nhập dữ liệu từ file JSON hoặc CSV: thêm dòng đúng, bỏ dòng sai và báo số dòng đã bỏ.
function importTransactions(text, format) {
    const clean = text.replace(/^\uFEFF/, '');
    let candidates;

    if (format === 'json') {
        const data = JSON.parse(clean);
        if (!data || !Array.isArray(data.transactions)) {
            throw new Error('File JSON không đúng định dạng (thiếu mảng "transactions").');
        }
        candidates = data.transactions;
    } else {
        // Phân tích nội dung CSV thành các dòng, rồi đổi mỗi dòng thành giao dịch.
        candidates = rowsToTransactions(parseCSV(clean));
        if (candidates.length === 0) {
            throw new Error('File CSV trống hoặc thiếu dòng tiêu đề.');
        }
    }

    const existing = getTransactions();
    const all = existing.slice();
    const valid = [];
    let skipped = 0;
    candidates.forEach((raw) => {
        // Kiểm tra số gốc trước khi làm tròn: số lẻ như 45000,4 phải bị bỏ, không được đổi thành 45000 âm thầm.
        const hasAmount = raw && raw.amount !== '' && raw.amount !== undefined && raw.amount !== null;
        if (hasAmount && !Number.isInteger(Number(raw.amount))) {
            skipped++;
            return;
        }
        const normalized = normalizeTransaction(raw || {});
        if (validateTransaction(normalized).isValid) {
            const tx = { ...normalized, id: nextId(all), createdDate: nowText() };
            all.push(tx);
            valid.push(tx);
        } else {
            skipped++;
        }
    });

    if (!saveTransactions([...existing, ...valid])) {
        throw new Error('Không lưu được dữ liệu nhập vào trình duyệt (bộ nhớ có thể đã đầy).');
    }

    // Bản sao lưu v3 có thêm ngân sách danh mục và giao dịch định kỳ. Khôi phục theo kiểu thêm vào, không ghi đè.
    if (format === 'json') {
        const data = JSON.parse(clean);
        if (data.categoryBudgets && typeof data.categoryBudgets === 'object') {
            Object.entries(data.categoryBudgets).forEach(([name, value]) => {
                if (EXPENSE_CATEGORIES.includes(name) || INCOME_CATEGORIES.includes(name)) setCategoryBudget(name, value);
            });
        }
        if (Array.isArray(data.recurringRules)) {
            const have = new Set(getRecurringRules().map((r) => r.id));
            const extra = data.recurringRules.filter((r) => isValidRecurringRule(r) && !have.has(r.id));
            if (extra.length) saveRecurringRules([...getRecurringRules(), ...extra]);
        }
    }
    return { imported: valid.length, skipped };
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

// Tạo các giao dịch còn thiếu từ quy tắc định kỳ, từ tháng bắt đầu tới tháng hiện tại.
// Mỗi (quy tắc, tháng) chỉ tạo một lần nhờ trường ruleKey, nên chạy nhiều lần vẫn không bị trùng.
// Không tạo giao dịch cho ngày chưa tới.
function materializeRecurring(now = new Date()) {
    const rules = getRecurringRules();
    if (rules.length === 0) return 0;

    const todayISO = toISODate(now);
    const currentMonth = todayISO.slice(0, 7);
    const existing = getTransactions();
    const done = new Set(existing.map((t) => t.ruleKey).filter(Boolean));
    let counter = maxIdNumber(existing);
    const created = [];

    rules.forEach((rule) => {
        let month = rule.startMonth;
        const last = rule.endMonth && rule.endMonth < currentMonth ? rule.endMonth : currentMonth;
        while (month <= last) {
            const key = `${rule.id}|${month}`;
            const date = `${month}-${String(rule.day).padStart(2, '0')}`;
            if (!done.has(key) && date <= todayISO) {
                counter++;
                created.push({
                    id: 'GD' + String(counter).padStart(3, '0'),
                    title: rule.title,
                    amount: rule.amount,
                    type: rule.type,
                    category: rule.category,
                    status: 'completed',
                    date,
                    createdDate: nowText(now),
                    ruleKey: key
                });
                done.add(key);
            }
            month = shiftMonth(month, 1);
        }
    });

    if (created.length && !saveTransactions([...existing, ...created])) return 0;
    return created.length;
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
        return true;
    } catch (error) {
        console.error('Không xóa được dữ liệu:', error);
        return false;
    }
}
