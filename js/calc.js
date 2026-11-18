// CÔNG CỤ TÍNH TOÁN (hàm thuần: không đọc DOM, không đọc kho dữ liệu, nên dễ kiểm thử)

// Số tháng cần để đạt mục tiêu khi mỗi tháng để dành một khoản cố định. Trả về null nếu không tiết kiệm được gì.
function monthsToGoal(target, current, monthly) {
    if (!(target > current)) return 0;
    if (!(monthly > 0)) return null;
    return Math.ceil((target - current) / monthly);
}

// Lãi kép theo tháng, có góp thêm đều đặn mỗi tháng.
// annualRatePct là lãi suất năm tính bằng phần trăm, ví dụ 7.5.
function futureValue(principal, annualRatePct, years, monthlyContribution) {
    const n = Math.round(years * 12);
    const r = annualRatePct / 100 / 12;
    const growth = Math.pow(1 + r, n);
    const fvPrincipal = principal * growth;
    const fvContrib = r === 0 ? monthlyContribution * n : monthlyContribution * (growth - 1) / r;
    const value = fvPrincipal + fvContrib;
    const invested = principal + monthlyContribution * n;
    return { value, invested, interest: value - invested, months: n };
}

// Lãi suất thực: lãi danh nghĩa đã trừ lạm phát (đơn vị phần trăm năm).
function realRate(nominalPct, inflationPct) {
    return ((1 + nominalPct / 100) / (1 + inflationPct / 100) - 1) * 100;
}

// Trả góp đều hằng tháng (gốc và lãi), theo lãi suất năm.
function loanPayment(principal, annualRatePct, months) {
    if (!(months > 0) || !(principal > 0)) return null;
    const r = annualRatePct / 100 / 12;
    const payment = r === 0 ? principal / months : principal * r / (1 - Math.pow(1 + r, -months));
    return { payment, total: payment * months, interest: payment * months - principal };
}

// Từ số tiền trả mỗi tháng, tìm lãi suất tháng (chia đôi khoảng). Trả về null nếu số tiền không đủ trả gốc.
function solveMonthlyRate(principal, payment, months) {
    if (!(principal > 0) || !(payment > 0) || !(months > 0)) return null;
    if (payment * months <= principal) return null;
    let lo = 0, hi = 1;
    for (let k = 0; k < 200; k++) {
        const mid = (lo + hi) / 2;
        const pay = principal * mid / (1 - Math.pow(1 + mid, -months));
        if (pay > payment) hi = mid; else lo = mid;
    }
    return (lo + hi) / 2;
}

// Chia đều một tổng số tiền cho n người theo đơn vị đồng, phần dư (nếu có) cộng cho những người đầu tiên.
function equalShares(total, n) {
    const base = Math.floor(total / n);
    const remainder = total - base * n;
    return Array.from({ length: n }, (_, i) => base + (i < remainder ? 1 : 0));
}

// Chia tiền nhóm: mỗi người đã trả bao nhiêu. Trả về số dư từng người và danh sách ai chuyển cho ai.
// Thuật toán: ghép người còn được nhận nhiều nhất với người còn nợ nhiều nhất, cho tới khi cân bằng.
function splitBill(people) {
    const clean = people
        .map((p) => ({ name: String(p.name || '').trim(), paid: Math.round(Number(p.paid) || 0) }))
        .filter((p) => p.name);
    const total = clean.reduce((sum, p) => sum + p.paid, 0);
    const shares = equalShares(total, clean.length);
    const balances = clean.map((p, i) => ({ name: p.name, paid: p.paid, share: shares[i], balance: p.paid - shares[i] }));

    const creditors = balances.filter((b) => b.balance > 0).map((b) => ({ name: b.name, amount: b.balance }));
    const debtors = balances.filter((b) => b.balance < 0).map((b) => ({ name: b.name, amount: -b.balance }));
    const transfers = [];
    const byAmountDesc = (a, b) => b.amount - a.amount;
    creditors.sort(byAmountDesc);
    debtors.sort(byAmountDesc);
    while (creditors.length && debtors.length) {
        const c = creditors[0];
        const d = debtors[0];
        const amount = Math.min(c.amount, d.amount);
        transfers.push({ from: d.name, to: c.name, amount });
        c.amount -= amount;
        d.amount -= amount;
        if (c.amount === 0) creditors.shift();
        if (d.amount === 0) debtors.shift();
        creditors.sort(byAmountDesc);
        debtors.sort(byAmountDesc);
    }
    return { total, balances, transfers };
}

// THUẾ THU NHẬP CÁ NHÂN (lũy tiến từng phần, tính theo tháng). Các hằng số có thể cập nhật khi luật thay đổi.
const PIT_PERSONAL_DEDUCTION = 15500000;   // giảm trừ bản thân mỗi tháng
const PIT_DEPENDENT_DEDUCTION = 6200000;   // giảm trừ mỗi người phụ thuộc mỗi tháng
const INSURANCE_RATE = 0.105;              // BHXH 8% + BHYT 1.5% + BHTN 1%, người lao động đóng
const INSURANCE_SALARY_CAP = 46800000;     // trần đóng bảo hiểm (20 lần lương cơ sở 2.340.000)
const PIT_BRACKETS = [                     // [giới hạn trên của bậc, thuế suất]
    [5000000, 0.05], [10000000, 0.10], [18000000, 0.15], [32000000, 0.20],
    [52000000, 0.25], [80000000, 0.30], [Infinity, 0.35]
];

function personalIncomeTax(grossMonthly, dependents = 0) {
    const gross = Math.max(0, Math.round(Number(grossMonthly) || 0));
    const deps = Math.max(0, Math.floor(Number(dependents) || 0));
    const insurance = Math.round(Math.min(gross, INSURANCE_SALARY_CAP) * INSURANCE_RATE);
    const deduction = PIT_PERSONAL_DEDUCTION + deps * PIT_DEPENDENT_DEDUCTION;
    const taxable = Math.max(0, gross - insurance - deduction);
    let tax = 0, lower = 0;
    for (const [upper, rate] of PIT_BRACKETS) {
        if (taxable <= lower) break;
        tax += (Math.min(taxable, upper) - lower) * rate;
        lower = upper;
    }
    tax = Math.round(tax);
    return { insurance, deduction, taxable: Math.round(taxable), tax, net: gross - insurance - tax };
}

// Dự báo chi tiêu cuối tháng dựa trên tốc độ chi trung bình các ngày đã qua.
// Chưa đủ 3 ngày thì không dự báo, vì số liệu quá ít và dễ sai lệch.
function forecastMonthEnd(spentSoFar, dayOfMonth, daysInMonth) {
    if (!(dayOfMonth >= 3) || !(daysInMonth >= dayOfMonth)) return null;
    return Math.round(spentSoFar / dayOfMonth * daysInMonth);
}
