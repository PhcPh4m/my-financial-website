// KHOẢN VAY TRẢ GÓP
// Mỗi khoản lưu: công ty, số tiền vay, số tiền trả mỗi kỳ, số kỳ, ngày kỳ đầu, và các giao dịch đã được người dùng tick là kỳ đã trả.
// Giao dịch không lưu gì thêm, nên form thêm giao dịch không đổi. Phải nạp sau calc.js (dùng solveMonthlyRate).

const LOANS_KEY = 'installment_loans';
const LOAN_TOLERANCE = 1000; // sai lệch tối đa giữa số tiền giao dịch và số tiền trả mỗi kỳ (làm tròn)
const LOAN_EARLY_DAYS = 10; // được trả sớm tối đa bao nhiêu ngày so với ngày kỳ đầu

// Ngày sớm nhất có thể tính là kỳ trả của khoản này.
function earliestLoanDate(loan) {
    const [y, m, d] = loan.firstDue.split('-').map(Number);
    const t = new Date(Date.UTC(y, m - 1, d - LOAN_EARLY_DAYS));
    return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}

// Chuẩn hóa để so khớp: bỏ dấu, chữ thường, gom khoảng trắng. "HD Saison" và "hd saison" thành một.
function normalizeMatch(text) {
    return String(text ?? '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd').replace(/Đ/g, 'd')
        .toLowerCase().replace(/\s+/g, ' ').trim();
}

// Tên công ty trong tiêu đề phải khớp nguyên cụm từ, để "F88" không khớp với "F880".
function titleMentions(title, keyword) {
    if (!keyword) return false;
    return (' ' + normalizeMatch(title) + ' ').includes(' ' + keyword + ' ');
}

function isValidLoan(l) {
    return l && typeof l.id === 'string' && typeof l.lenderName === 'string' && typeof l.keyword === 'string'
        && Number(l.principal) > 0 && Number(l.payment) > 0 && Number.isInteger(l.months) && l.months > 0
        && typeof l.firstDue === 'string' && Array.isArray(l.paidIds);
}

function readLoans() {
    try {
        const data = JSON.parse(localStorage.getItem(LOANS_KEY) || '[]');
        return Array.isArray(data) ? data.filter(isValidLoan) : [];
    } catch (e) {
        return [];
    }
}

function saveLoans(list) {
    try {
        localStorage.setItem(LOANS_KEY, JSON.stringify(list));
        return true;
    } catch (e) {
        return false;
    }
}

function addLoan({ lenderId, lenderName, principal, payment, months, firstDue }) {
    const name = String(lenderName ?? '').trim().slice(0, 60);
    const loan = {
        id: 'loan_' + Date.now().toString(36),
        lenderId: lenderId || 'other',
        lenderName: name,
        keyword: normalizeMatch(name),
        principal: Math.round(Number(principal)),
        payment: Math.round(Number(payment)),
        months: Math.round(Number(months)),
        firstDue,
        paidIds: [],
        createdAt: new Date().toISOString()
    };
    if (!isValidLoan(loan)) return null;
    const list = readLoans();
    list.push(loan);
    return saveLoans(list) ? loan : null;
}

function removeLoan(id) {
    return saveLoans(readLoans().filter((l) => l.id !== id));
}

// Đánh dấu khoản đã tất toán bằng một giao dịch chi. txId null thì bỏ đánh dấu.
function setLoanSettled(loanId, txId) {
    const list = readLoans();
    const loan = list.find((l) => l.id === loanId);
    if (!loan) return false;
    if (txId) loan.settledTxId = txId;
    else delete loan.settledTxId;
    return saveLoans(list);
}

// Giao dịch chi hoàn thành, từ ngày sớm nhất của khoản trở đi, chưa được tick kỳ cho khoản nào.
function loanSettleCandidates(loan, txs, loans) {
    const usedAsPayment = new Set();
    loans.forEach((l) => l.paidIds.forEach((id) => usedAsPayment.add(id)));
    const from = earliestLoanDate(loan);
    return txs
        .filter((t) => t.type === 'expense' && t.status === 'completed' && t.date >= from && !usedAsPayment.has(t.id))
        .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

// Tick hoặc bỏ tick một giao dịch là kỳ đã trả của khoản này.
function setLoanPayment(loanId, txId, paid) {
    const list = readLoans();
    const loan = list.find((l) => l.id === loanId);
    if (!loan) return false;
    const set = new Set(loan.paidIds);
    if (paid) set.add(txId); else set.delete(txId);
    loan.paidIds = Array.from(set);
    return saveLoans(list);
}

// Ngày kỳ thứ k (0 là kỳ đầu), giữ nguyên ngày trong tháng, yyyy-mm-dd.
function loanDueDate(firstDue, k) {
    const [y, m, d] = firstDue.split('-').map(Number);
    const total = (m - 1) + k;
    const year = y + Math.floor(total / 12);
    const month = total % 12;
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const day = Math.min(d, lastDay);
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Giao dịch chi, hoàn thành, đúng số tiền kỳ (sai lệch nhỏ), tiêu đề có tên công ty, từ ngày kỳ đầu trở đi.
function matchesLoanShape(tx, loan) {
    return tx.type === 'expense' && tx.status === 'completed'
        && tx.date >= earliestLoanDate(loan)
        && Math.abs(Number(tx.amount) - loan.payment) <= LOAN_TOLERANCE
        && titleMentions(tx.title, loan.keyword);
}

// Với một giao dịch, chọn khoản vay sẽ nhận nó: cùng công ty, khoản có ngày kỳ đầu gần nhất trước ngày giao dịch.
function ownerLoanFor(tx, loans) {
    let owner = null;
    loans.forEach((l) => {
        if (!matchesLoanShape(tx, l)) return;
        if (!owner || l.firstDue > owner.firstDue) owner = l;
    });
    return owner;
}

// Các giao dịch gợi ý cho một khoản: thuộc khoản này và chưa được tick cho khoản nào khác.
function loanCandidates(loan, txs, loans) {
    const usedElsewhere = new Set();
    loans.forEach((l) => { if (l.id !== loan.id) l.paidIds.forEach((id) => usedElsewhere.add(id)); });
    return txs
        .filter((t) => !usedElsewhere.has(t.id))
        .filter((t) => ownerLoanFor(t, loans)?.id === loan.id || loan.paidIds.includes(t.id))
        .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

// Tiến độ của một khoản. Chỉ tính các kỳ đã tick mà giao dịch vẫn còn tồn tại.
function loanProgress(loan, txs) {
    const existing = new Set(txs.map((t) => t.id));
    const paidCount = Math.min(loan.paidIds.filter((id) => existing.has(id)).length, loan.months);
    const rate = solveMonthlyRate(loan.principal, loan.payment, loan.months) ?? 0;
    let balance = loan.principal;
    for (let k = 0; k < paidCount; k++) balance = balance * (1 + rate) - loan.payment;
    const remainingPayments = loan.months - paidCount;
    return {
        paidCount,
        remainingPayments,
        remainingTotal: remainingPayments * loan.payment,
        principalRemaining: Math.max(0, Math.round(balance)),
        nextDue: remainingPayments > 0 ? loanDueDate(loan.firstDue, paidCount) : null,
        done: remainingPayments === 0
    };
}

// Tổng còn phải trả của các khoản chưa hoàn tất. Dùng cho mục Tiền thực có.
function getActiveLoanDebt() {
    const txs = getTransactions();
    return readLoans().reduce((sum, l) => {
        // Khoản đã tất toán (có giao dịch tất toán còn tồn tại) không còn nợ, kể cả khi chưa tick đủ kỳ.
        if (l.settledTxId && txs.some((t) => t.id === l.settledTxId)) return sum;
        const p = loanProgress(l, txs);
        return p.done ? sum : sum + p.remainingTotal;
    }, 0);
}
