// Tính toán số liệu từ dữ liệu đã lưu: thống kê theo tháng, ngân sách, số dư ví, tổng tài sản và nợ,
// và tạo giao dịch định kỳ. Tách khỏi storage.js để storage chỉ còn lưu và đọc dữ liệu.
// Phải nạp sau storage.js và utils.js (dùng shiftMonth, toISODate từ utils.js).

// THỐNG KÊ
// Chỉ tính giao dịch đã hoàn thành; giao dịch chờ xử lý vẫn hiện trong danh sách và được đếm riêng.

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

// SỐ DƯ VÀ TÀI SẢN
// Số dư từng ví: số dư đầu + thu - chi của giao dịch đã hoàn thành (cùng quy tắc với phần số dư chung).
function getWalletBalances() {
    const txs = getTransactions();
    const transfers = readWalletTransfers();
    return getWallets().map((w) => {
        let balance = w.openingBalance;
        txs.forEach((t) => {
            if (t.walletId !== w.id || t.status !== 'completed') return;
            balance += t.type === 'income' ? t.amount : -t.amount;
        });
        // Chuyển tiền giữa ví: không tính là thu hay chi, chỉ đổi số dư giữa hai ví.
        transfers.forEach((tr) => {
            if (tr.from === w.id) balance -= tr.amount;
            if (tr.to === w.id) balance += tr.amount;
        });
        return { ...w, balance };
    });
}

// Tổng tài sản: cộng số dư của mọi ví. Chuyển tiền giữa ví không làm tổng đổi.
function getTotalAssets() {
    return getWalletBalances().reduce((sum, w) => sum + w.balance, 0);
}

function getTotalDebts() {
    return readDebts().reduce((sum, d) => sum + d.balance, 0) + getActiveLoanDebt();
}

// Tạo các giao dịch còn thiếu từ quy tắc định kỳ, từ tháng bắt đầu tới tháng hiện tại.
// Mỗi (quy tắc, tháng) chỉ tạo một lần nhờ trường ruleKey, nên chạy nhiều lần vẫn không bị trùng.
// Không tạo giao dịch cho ngày chưa tới.
// GIAO DỊCH ĐỊNH KỲ
// Tạo giao dịch cho các kỳ đến hạn, mỗi kỳ chỉ tạo một lần (theo ruleKey).
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
