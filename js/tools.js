// TRANG CÔNG CỤ: nối các máy tính trong calc.js với giao diện, và quản lý giao dịch định kỳ.

// Đọc ô số. Ô trống hoặc không phải số thì trả về null.
function readNumber(id) {
    if ($(id).dataset.money !== undefined) return parseMoney($(id).value);
    const value = $(id).value.trim();
    if (value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

// MỤC TIÊU TIẾT KIỆM

// Gợi ý tiết kiệm mỗi tháng: trung bình chênh lệch thu chi của tối đa 3 tháng gần nhất có dữ liệu.
function suggestedMonthlySaving() {
    const series = getMonthlySeries(getTransactions()).slice(-3);
    if (series.length === 0) return 0;
    const avg = series.reduce((sum, r) => sum + (r.income - r.expense), 0) / series.length;
    return Math.max(0, Math.round(avg));
}

function updateGoal() {
    const target = readNumber('goalTarget');
    const current = readNumber('goalCurrent') ?? 0;
    const monthly = readNumber('goalMonthly') ?? 0;
    if (target === null || target <= 0) return setMessage('goalResult', 'Nhập số tiền mục tiêu để xem kết quả.');
    const months = monthsToGoal(target, current, monthly);
    if (months === 0) return setResult('goalResult', [['Kết quả', 'Đã đạt mục tiêu', 'good']]);
    if (months === null) return setResult('goalResult', [['Kết quả', 'Cần tiết kiệm được khoản nào đó mỗi tháng', 'bad']]);
    const finish = shiftMonth(getCurrentMonth(), months);
    setResult('goalResult', [
        ['Thời gian cần', `${months} tháng`],
        ['Đạt vào khoảng', formatMonth(finish).replace('Tháng ', 'tháng ')],
        ['Còn thiếu hôm nay', formatCurrency(Math.max(0, target - current))]
    ]);
}

// LÃI KÉP

function updateCompound() {
    const principal = readNumber('compPrincipal') ?? 0;
    const monthly = readNumber('compMonthly') ?? 0;
    const rate = readNumber('compRate');
    const years = readNumber('compYears');
    if (rate === null || years === null || years <= 0 || years > 60 || rate < 0) {
        return setMessage('compResult', 'Nhập lãi suất và số năm (từ 1 đến 60).');
    }
    const r = futureValue(principal, rate, years, monthly);
    const inflation = readNumber('compInflation');
    const extra = inflation === null ? [] : [['Lãi suất thực sau lạm phát', `${realRate(rate, inflation).toFixed(2)}%`, realRate(rate, inflation) >= 0 ? 'good' : 'bad']];
    setResult('compResult', [
        ['Giá trị dự kiến', formatCurrency(Math.round(r.value)), 'good'],
        ['Tổng vốn đã góp', formatCurrency(Math.round(r.invested))],
        ['Tiền lãi', formatCurrency(Math.round(r.interest))],
        ...extra
    ]);
}

// TRẢ GÓP

// CHỌN NGÂN HÀNG CHO VAY TIÊU DÙNG

function fillLoanSources() {
    const select = $('loanSource');
    const groups = [['bank', 'Ngân hàng'], ['finance', 'Công ty tài chính']];
    select.innerHTML = '<option value="">-- Chọn đơn vị --</option>';
    groups.forEach(([type, label]) => {
        const group = document.createElement('optgroup');
        group.label = label;
        BANK_RATES.filter((b) => b.type === type).forEach((b) => {
            const opt = document.createElement('option');
            opt.value = b.id;
            opt.textContent = b.name;
            group.appendChild(opt);
        });
        select.appendChild(group);
    });
}

function updateLoanSource() {
    const info = $('loanSourceInfo');
    const bank = BANK_RATES.find((b) => b.id === $('loanSource').value);
    if (!bank) { info.textContent = ''; return; }
    if (bank.rateMin === null || bank.rateMax === null) {
        info.innerHTML = '';
        info.append('Chưa có số liệu lãi suất đã kiểm chứng. Nhập tay hoặc xem ');
        const a = document.createElement('a');
        a.href = bank.url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'trang chính thức';
        info.append(a, '.');
        return;
    }
    $('loanRate').value = ((bank.rateMin + bank.rateMax) / 2).toFixed(1);
    info.textContent = `Lãi suất tham khảo ${bank.rateMin}% – ${bank.rateMax}%/năm, cập nhật ${bank.updated}. Giá trị giữa khoảng đã được điền, bạn có thể sửa.`;
    updateLoan();
}

function updateLoan() {
    const mode = $('loanMode').value;
    const principal = readNumber('loanPrincipal');
    const months = readNumber('loanMonths');

    if (mode === 'payment') {
        const payment = readNumber('loanPayment');
        if (principal === null || months === null || payment === null) {
            return setMessage('loanResult', 'Nhập số tiền vay, số tiền trả mỗi tháng và số tháng trả.');
        }
        const n = Math.round(months);
        const rate = solveMonthlyRate(principal, payment, n);
        if (rate === null) {
            return setMessage('loanResult', 'Số tiền trả mỗi tháng phải đủ để trả hết gốc trong số tháng đã chọn.');
        }
        const total = payment * n;
        const interest = total - principal;
        setResult('loanResult', [
            ['Trả mỗi tháng', formatCurrency(Math.round(payment)), 'good'],
            ['Tổng phải trả', formatCurrency(Math.round(total))],
            ['Tổng tiền lãi', formatCurrency(Math.round(interest)), 'bad'],
            ['Lãi suất thực tế mỗi năm', `${(rate * 1200).toFixed(2)}%`, 'bad'],
            ['Lãi suất kép tương đương mỗi năm', `${((Math.pow(1 + rate, 12) - 1) * 100).toFixed(2)}%`],
            ['Lãi suất “tính trên gốc” mỗi năm', `${(interest / principal / (n / 12) * 100).toFixed(2)}%`]
        ]);
        return;
    }

    const rate = readNumber('loanRate');
    const r = principal === null || rate === null || months === null || rate < 0 ? null : loanPayment(principal, rate, Math.round(months));
    if (!r) {
        return setMessage('loanResult', 'Nhập số tiền vay, lãi suất và số tháng trả.');
    }
    setResult('loanResult', [
        ['Trả mỗi tháng', formatCurrency(Math.round(r.payment)), 'good'],
        ['Tổng phải trả', formatCurrency(Math.round(r.total))],
        ['Tổng tiền lãi', formatCurrency(Math.round(r.interest)), 'bad']
    ]);
}

// Hiện cả hai ô. Ô không dùng trong cách tính đang chọn sẽ bị khóa.
function updateLoanMode() {
    const payMode = $('loanMode').value === 'payment';
    $('loanRate').disabled = payMode;
    $('loanPayment').disabled = !payMode;
    $('loanRateGroup').classList.toggle('is-disabled', payMode);
    $('loanPaymentGroup').classList.toggle('is-disabled', !payMode);
    updateLoan();
}

// THUẾ THU NHẬP CÁ NHÂN

function updateTax() {
    const gross = readNumber('taxGross');
    const deps = readNumber('taxDeps') ?? 0;
    if (gross === null || gross <= 0) return setMessage('taxResult', 'Nhập lương gross mỗi tháng.');
    const t = personalIncomeTax(gross, deps);
    setResult('taxResult', [
        ['Bảo hiểm bắt buộc', formatCurrency(t.insurance)],
        ['Giảm trừ gia cảnh', formatCurrency(t.deduction)],
        ['Thu nhập tính thuế', formatCurrency(t.taxable)],
        ['Thuế TNCN phải nộp', formatCurrency(t.tax), t.tax > 0 ? 'bad' : 'good'],
        ['Thực nhận mỗi tháng', formatCurrency(t.net), 'good']
    ]);
}

// CHIA TIỀN NHÓM


// GIẢI THÍCH CÔNG THỨC: mở/đóng có animation, tắt animation nếu người dùng bật "giảm chuyển động".
function bindHelpToggles() {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.querySelectorAll('details.loan-help').forEach((details) => {
        const summary = details.querySelector('summary');
        const body = details.querySelector('.loan-help__body');
        let anim = null;
        let closing = false;
        summary.addEventListener('click', (e) => {
            e.preventDefault();
            const opening = closing || !details.open;
            if (anim) anim.cancel();
            anim = null;
            closing = !opening;
            if (opening) details.open = true;
            if (reduce) {
                if (!opening) details.open = false;
                closing = false;
                return;
            }
            const from = opening ? 0 : body.offsetHeight;
            const to = opening ? body.scrollHeight : 0;
            anim = body.animate([
                { height: from + 'px', opacity: opening ? 0 : 1, transform: `translateY(${opening ? -6 : 0}px)` },
                { height: to + 'px', opacity: opening ? 1 : 0, transform: `translateY(${opening ? 0 : -6}px)` }
            ], { duration: motionTokens.ms('mid'), easing: motionTokens.ease() });
            anim.onfinish = () => {
                if (!opening) details.open = false;
                closing = false;
                anim = null;
            };
        });
    });
}

// KHỞI TẠO

onAppReady(() => {
    bindModalDismissal();
    $('goalTarget').value = '';
    $('goalCurrent').value = Math.max(0, Math.round(summarize(getTransactions()).balance));
    $('goalMonthly').value = suggestedMonthlySaving();
    ['goalTarget', 'goalCurrent', 'goalMonthly'].forEach((id) => $(id).addEventListener('input', updateGoal));
    ['compPrincipal', 'compMonthly', 'compRate', 'compYears', 'compInflation'].forEach((id) => $(id).addEventListener('input', updateCompound));
    ['loanPrincipal', 'loanRate', 'loanMonths'].forEach((id) => $(id).addEventListener('input', updateLoan));
    fillLoanSources();
    fillLoanPick();
    $('loanPick').addEventListener('change', applyLoanPick);
    ['loanPrincipal', 'loanPayment', 'loanMonths', 'loanRate', 'loanMode'].forEach((id) => $(id).addEventListener('input', clearLoanPick));
    $('loanMode').addEventListener('change', clearLoanPick);
    $('loanSource').addEventListener('change', updateLoanSource);
    $('loanMode').addEventListener('change', updateLoanMode);
    $('loanPayment').addEventListener('input', updateLoan);
    updateLoanMode();

    updateGoal();
    updateCompound();
    updateLoan();
    ['taxGross', 'taxDeps'].forEach((id) => $(id).addEventListener('input', updateTax));
    updateTax();
    bindHelpToggles();
});

// VAY TRẢ GÓP ĐỀU: đọc khoản đã thêm ở trang Giao dịch, điền sẵn số liệu và vẽ bảng từng kỳ.
function fillLoanPick() {
    const select = $('loanPick');
    select.innerHTML = '<option value="">-- Nhập tay --</option>';
    readLoans().forEach((loan) => {
        const opt = document.createElement('option');
        opt.value = loan.id;
        opt.textContent = `${loan.lenderName} · ${formatCurrency(loan.principal)} · ${loan.months} kỳ`;
        select.appendChild(opt);
    });
}

function applyLoanPick() {
    const loan = readLoans().find((l) => l.id === $('loanPick').value);
    if (loan) {
        $('loanPrincipal').value = loan.principal;
        $('loanPayment').value = loan.payment;
        $('loanMonths').value = loan.months;
        $('loanMode').value = 'payment';
        updateLoanMode();
    }
    renderLoanSchedule();
}

// Khi người dùng tự sửa số liệu thì bỏ chọn khoản đã thêm, vì bảng không còn khớp.
function clearLoanPick() {
    $('loanPick').value = '';
    renderLoanSchedule();
}

function renderLoanSchedule() {
    const box = $('loanSchedule');
    const loan = readLoans().find((l) => l.id === $('loanPick').value);
    const rate = loan ? solveMonthlyRate(loan.principal, loan.payment, loan.months) : null;
    if (!loan || rate === null) {
        box.hidden = true;
        box.innerHTML = '';
        return;
    }
    const paidCount = loanProgress(loan, getTransactions()).paidCount;
    let balance = loan.principal;
    const rows = [];
    for (let k = 0; k < loan.months; k++) {
        const interest = balance * rate;
        const principalPart = loan.payment - interest;
        balance = Math.max(0, balance - principalPart);
        const paid = k < paidCount;
        rows.push(`<tr class="${paid ? 'is-paid' : ''}">
            <td>${k + 1}</td>
            <td>${formatDate(loanDueDate(loan.firstDue, k))}</td>
            <td>${formatCurrency(Math.round(loan.payment))}</td>
            <td>${formatCurrency(Math.round(interest))}</td>
            <td>${formatCurrency(Math.round(principalPart))}</td>
            <td>${formatCurrency(Math.round(balance))}</td>
            <td>${paid ? 'Đã tick' : 'Chưa tick'}</td>
        </tr>`);
    }
    box.hidden = false;
    box.innerHTML = `
        <table class="loan-schedule">
            <thead><tr><th>Kỳ</th><th>Ngày</th><th>Tiền trả</th><th>Lãi</th><th>Gốc</th><th>Còn lại sau kỳ</th><th>Trạng thái</th></tr></thead>
            <tbody>${rows.join('')}</tbody>
        </table>
        <p class="form-hint">Lãi suất ước tính ${(rate * 1200).toFixed(2)}%/năm, suy từ số tiền trả mỗi kỳ. Đây không phải lãi thật của công ty.</p>`;
}
