// Số tháng hiển thị trên biểu đồ cột (6 tháng gần nhất).
const CHART_MONTHS = 6;

onAppReady(() => {
    migrateStoredData();
    materializeRecurring();
    renderCategoryBudgetInputs();
    $('saveCategoryBudgetsBtn').addEventListener('click', saveCategoryBudgetInputs);
    $('monthPicker').value = getCurrentMonth();
    $('monthPicker').addEventListener('change', render);
    $('clearPeriodBtn').addEventListener('click', () => {
        $('monthPicker').value = '';
        render();
    });

    if (!isChartJsReady()) {
        $('chartsFallback').hidden = false;
    } else {
        setupChartDefaults();
    }

    // Đổi sáng/tối: cập nhật màu mặc định của Chart.js rồi vẽ lại biểu đồ.
    document.addEventListener('themechange', () => {
        if (isChartJsReady()) setupChartDefaults();
        render();
    });

    render();
});

// Hàm chính của trang phân tích: mỗi khi đổi tháng, vẽ lại toàn bộ số liệu và biểu đồ.
function render() {
    const month = $('monthPicker').value;
    const all = getTransactions();
    const scoped = filterByMonth(all, month);

    $('periodLabel').textContent = formatMonth(month);
    renderStats(all, month);
    renderBudgetCompare(month);
    renderCategoryBreakdown(scoped, month);
    renderCharts(scoped, all, month);
    renderMonthlyTable(all);
}

// STATS

// Điền 4 ô thống kê. Khi chọn một tháng thì so với tháng trước; xem tất cả thì không có badge so sánh.
function renderStats(all, month) {
    const { current: s, previous: prev } = month
        ? compareWithPreviousMonth(all, month)
        : { current: summarize(all), previous: null };
    const note = month ? `So với ${formatMonth(shiftMonth(month, -1)).toLowerCase()}` : 'Toàn bộ thời gian';

    countTo($('statIncome'), s.income);
    setBadge($('statIncomeTrend'), prev ? trendInfo(percentChange(s.income, prev.income), true) : null);
    $('statIncomeNote').textContent = note;

    countTo($('statExpense'), s.expense);
    setBadge($('statExpenseTrend'), prev ? trendInfo(percentChange(s.expense, prev.expense), false) : null);
    $('statExpenseNote').textContent = note;

    countTo($('statBalance'), s.balance);
    setBadge($('statBalanceTrend'), month ? savingsInfo(s) : null);
    $('statBalanceNote').textContent = month ? 'Thu − chi trong tháng' : 'Thu − chi toàn thời gian';

    countTo($('statCount'), s.total, formatCount);
    $('statCountNote').textContent = `${s.completed} hoàn thành · ${s.pending} chưa thanh toán`;
}

// Hiện khung so sánh chi tiêu với ngân sách (chỉ khi đã chọn một tháng).
function renderBudgetCompare(month) {
    const box = $('budgetCompare');
    const status = month ? getBudgetStatus(month) : null;

    if (!status) {
        box.hidden = true;
        box.innerHTML = '';
        return;
    }

    box.hidden = false;
    box.innerHTML = `
        <h2 class="chart-card__title"><i data-icon="target"></i> Ngân sách ${formatMonth(month).toLowerCase()}</h2>
        ${budgetCardHTML(status)}`;
    animateBudgetGauges(box);
}

// CATEGORY BREAKDOWN

// Vẽ danh sách chi tiêu từng danh mục, có thanh màu và phần trăm.
function renderCategoryBreakdown(list, month) {
    const items = getExpenseByCategory(list);
    const total = items.reduce((sum, i) => sum + i.amount, 0);
    const container = $('categoryList');
    const budgets = getCategoryBudgets();

    if (items.length === 0) {
        container.innerHTML = '<p class="form-hint">Chưa có khoản chi hoàn thành trong kỳ này.</p>';
        return;
    }

    container.innerHTML = items.map((item) => {
        const pct = total ? (item.amount / total) * 100 : 0;
        const limit = month ? budgets[item.category] : undefined;
        let amountText = `${formatCurrency(item.amount)} · ${pct.toFixed(1)}%`;
        let over = false;
        if (limit) {
            const used = Math.round((item.amount / limit) * 100);
            over = item.amount > limit;
            amountText = `${formatCurrency(item.amount)} / ${formatCurrency(limit)} · ${used}%`;
        }
        return `
            <div class="category-item">
                <div class="category-item__head">
                    <span class="category-item__name">${escapeHtml(item.category)}</span>
                    <span class="category-item__amount${over ? ' category-item__amount--over' : ''}">${amountText}</span>
                </div>
                <div class="category-item__track">
                    <div class="category-item__fill${over ? ' category-item__fill--over' : ''}" style="transform: scaleX(${(Math.min(pct, 100) / 100).toFixed(3)});"></div>
                </div>
            </div>`;
    }).join('');
}

// Các ô nhập ngân sách cho từng danh mục chi, điền sẵn số đã lưu.
function renderCategoryBudgetInputs() {
    const budgets = getCategoryBudgets();
    $('categoryBudgetGrid').innerHTML = EXPENSE_CATEGORIES.map((c, i) => `
        <label class="cat-budget-item" for="catBudget${i}">
            <span class="form-label">${escapeHtml(c)}</span>
            <input type="number" id="catBudget${i}" class="form-input" data-money data-category="${escapeHtml(c)}" min="1" step="1" inputmode="numeric" placeholder="Không đặt" value="${budgets[c] ?? ''}">
        </label>`).join('');
}

// Lưu tất cả ô ngân sách danh mục. Ô để trống sẽ xóa hạn mức của danh mục đó.
function saveCategoryBudgetInputs() {
    let failed = false;
    document.querySelectorAll('#categoryBudgetGrid input[data-category]').forEach((input) => {
        const value = input.value.trim();
        const amount = value === '' ? 0 : parseMoney(value);
        if (value !== '' && (!Number.isInteger(amount) || amount <= 0)) {
            failed = true;
            input.classList.add('is-invalid');
            return;
        }
        input.classList.remove('is-invalid');
        if (!setCategoryBudget(input.dataset.category, amount)) failed = true;
    });
    if (failed) {
        showToast('Có ô không hợp lệ hoặc không lưu được. Số ngân sách phải là số nguyên dương.', 'danger', 5000);
        return;
    }
    showToast('Đã lưu ngân sách danh mục.');
    render();
}

// CHARTS

// Khi không có dữ liệu thì hiện dòng chữ "chưa có dữ liệu" thay cho biểu đồ trống.
function toggleChartEmpty(canvasId, isEmpty) {
    $(canvasId).hidden = isEmpty;
    $(`${canvasId}Empty`).hidden = !isEmpty;
}

// Nhờ chart.js vẽ 3 biểu đồ: tròn (theo danh mục), cột (thu chi 6 tháng), cột (chi theo ngày).
function renderCharts(scoped, all, month) {
    if (!isChartJsReady()) return;

    // Pie: expense by category for the selected period
    const byCategory = getExpenseByCategory(scoped);
    toggleChartEmpty('pieChart', byCategory.length === 0);
    if (byCategory.length) {
        drawPieChart('pieChart', byCategory.map((i) => i.category), byCategory.map((i) => i.amount));
    } else {
        destroyChart('pieChart');
    }

    // Column: income vs expense for the last N months up to the selected month
    let series = getMonthlySeries(all);
    if (month) series = series.filter((r) => r.month <= month);
    const recent = series.slice(-CHART_MONTHS);
    toggleChartEmpty('columnChart', recent.length === 0);
    if (recent.length) {
        drawColumnChart(
            'columnChart',
            recent.map((r) => formatMonth(r.month).replace('Tháng ', 'T')),
            recent.map((r) => r.income),
            recent.map((r) => r.expense)
        );
    } else {
        destroyChart('columnChart');
    }

    // Bar: daily expense of the selected month (needs a month to be selected)
    const daily = getDailyExpense(scoped, month);
    const hasDaily = daily.values.some((v) => v > 0);
    toggleChartEmpty('dailyChart', !month || !hasDaily);
    if (month && hasDaily) {
        drawDailyBarChart('dailyChart', daily.labels, daily.values);
    } else {
        destroyChart('dailyChart');
    }
}

// MONTHLY TABLE

// Điền bảng tổng hợp từng tháng: thu, chi và số dư lũy kế.
function renderMonthlyTable(all) {
    const rows = getMonthlySeries(all).reverse();
    const tbody = $('monthlyTableBody');

    if (rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="form-hint">Chưa có dữ liệu.</td></tr>';
        return;
    }

    tbody.innerHTML = rows.map((r) => `
        <tr>
            <td>${formatMonth(r.month)}</td>
            <td class="num">${formatCurrency(r.income)}</td>
            <td class="num">${formatCurrency(r.expense)}</td>
            <td class="num">${formatCurrency(r.balance)}</td>
        </tr>`).join('');
}

// TABS: chia nội dung thành ba nhóm. Chỉ đổi hiển thị, không ảnh hưởng dữ liệu hay tháng đang chọn.
function resizeChartsIn(root) {
    if (!window.Chart) return;
    root.querySelectorAll('canvas').forEach((c) => {
        const chart = Chart.getChart(c);
        if (chart) chart.resize();
    });
}

function initAnalyticsTabs() {
    const tabs = Array.from(document.querySelectorAll('.tabs__btn'));
    if (!tabs.length) return;

    // Đặt viên trượt dưới tab đang chọn. animate=false khi tải trang hoặc đổi cỡ màn hình.
    const movePill = (animate = true) => {
        const pill = document.querySelector('.tabs__pill');
        const active = document.querySelector('.tabs__btn[aria-selected="true"]');
        if (!pill || !active) return;
        if (!animate) pill.style.transition = 'none';
        pill.style.width = `${active.offsetWidth}px`;
        pill.style.transform = `translateX(${active.offsetLeft}px)`;
        pill.style.opacity = '1';
        if (!animate) {
            void pill.offsetWidth; // ép trình duyệt áp dụng vị trí ngay, rồi mới bật lại transition
            pill.style.transition = '';
        }
    };

    const show = (name, animate = true) => {
        if (animate && swapBusy()) return;
        tabs.forEach((t) => {
            const on = t.dataset.tab === name;
            t.setAttribute('aria-selected', String(on));
            t.tabIndex = on ? 0 : -1;
        });
        movePill(animate);
        // Biểu đồ vẽ lúc đang ẩn có kích thước 0, nên vẽ lại khi nhóm được hiện.
        const showPanels = () => {
            document.querySelectorAll('.tab-panel').forEach((p) => {
                p.hidden = p.id !== `panel-${name}`;
            });
            const panel = document.getElementById(`panel-${name}`);
            if (panel) resizeChartsIn(panel);
        };
        if (!animate) { showPanels(); return; }
        const outgoing = Array.from(document.querySelectorAll('.tab-panel')).filter((p) => p.id !== `panel-${name}`);
        swapBlock(outgoing, showPanels);
    };

    tabs.forEach((tab, i) => {
        tab.addEventListener('click', () => show(tab.dataset.tab));
        tab.addEventListener('keydown', (e) => {
            if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
            e.preventDefault();
            const step = e.key === 'ArrowRight' ? 1 : tabs.length - 1;
            const next = tabs[(i + step) % tabs.length];
            next.focus();
            show(next.dataset.tab);
        });
    });

    // Khi in, mọi biểu đồ cần kích thước đúng, kể cả nhóm đang ẩn.
    window.addEventListener('beforeprint', () => {
        if (window.Chart) Object.values(Chart.instances).forEach((c) => c.resize());
    });

    show('overview', false);
    window.addEventListener('resize', () => movePill(false));
    if (document.fonts) document.fonts.ready.then(() => movePill(false));
}

document.addEventListener('DOMContentLoaded', initAnalyticsTabs);

