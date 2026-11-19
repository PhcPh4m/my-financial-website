// Danh sách các biểu đồ đang hiện, để có thể xóa và vẽ lại khi cần.
const chartRegistry = {};

// Lấy một màu từ bảng màu của giao diện (biến CSS), để biểu đồ cùng màu với trang.
function cssVar(name, fallback) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

// Kiểm tra thư viện biểu đồ đã tải xong chưa. Nếu chưa thì không vẽ, để tránh lỗi.
function isChartJsReady() {
    return typeof window.Chart !== 'undefined';
}

// Bộ 8 màu của bảng màu đang chọn, đọc từ --chart-1 đến --chart-8 (css/palettes.css).
function chartPalette() {
    const colors = [];
    for (let i = 1; i <= 8; i++) colors.push(cssVar(`--chart-${i}`, '#8FBEDD'));
    return colors;
}

// Đặt màu chữ, màu lưới và font mặc định cho mọi biểu đồ theo chế độ sáng hoặc tối.
function setupChartDefaults() {
    Chart.defaults.color = cssVar('--text-2', '#cbd5e1');
    Chart.defaults.borderColor = cssVar('--border', '#334155');
    Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
}

// Kiểu chung cho chú thích và chú giải: chấm tròn nhỏ, chữ phụ, không khung.
function legendStyle(position) {
    return {
        position,
        align: position === 'top' ? 'end' : 'center',
        labels: {
            usePointStyle: true,
            pointStyle: 'circle',
            boxWidth: 6,
            boxHeight: 6,
            padding: 14,
            color: cssVar('--text-2', '#A9C0CF'),
            font: { size: 12 }
        }
    };
}

// Kiểu chung cho khung gợi ý khi rê chuột, đồng bộ với thanh kính của giao diện.
function tooltipStyle(extra = {}) {
    return {
        backgroundColor: cssVar('--surface-2', '#1A3448'),
        titleColor: cssVar('--text', '#E8F1F7'),
        bodyColor: cssVar('--text-2', '#A9C0CF'),
        borderColor: cssVar('--border-strong', 'rgba(170, 200, 220, 0.22)'),
        borderWidth: 1,
        cornerRadius: 10,
        padding: 10,
        boxPadding: 4,
        ...extra
    };
}

// Xóa biểu đồ cũ trên khung trước khi vẽ cái mới, để không đè lên nhau.
function destroyChart(canvasId) {
    if (chartRegistry[canvasId]) {
        chartRegistry[canvasId].destroy();
        delete chartRegistry[canvasId];
    }
}

// Vẽ biểu đồ tròn: mỗi miếng là một danh mục chi tiêu. Rê chuột vào để xem số tiền và phần trăm.
// Thiết kế: một vòng liền, các miếng ngăn bằng viền màu nền, rê chuột thì miếng nổi ra.
function drawPieChart(canvasId, labels, values) {
    destroyChart(canvasId);
    const total = values.reduce((a, b) => a + b, 0);
    const surface = cssVar('--surface', '#1E1D1A');

    chartRegistry[canvasId] = new Chart($(canvasId), {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data: values,
                backgroundColor: chartPalette(),
                borderColor: surface,
                borderWidth: 2,
                hoverOffset: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '58%',
            animation: { duration: 700, easing: 'easeOutCubic' },
            plugins: {
                legend: { ...legendStyle('right'), labels: { ...legendStyle('right').labels, padding: 12, boxWidth: 8, boxHeight: 8, font: { size: 12 } } },
                tooltip: tooltipStyle({
                    callbacks: {
                        label: (ctx) => {
                            const pct = total ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
                            return ` ${ctx.label}: ${formatCurrency(ctx.parsed)} (${pct}%)`;
                        }
                    }
                })
            }
        }
    });
}

// Vẽ biểu đồ cột: mỗi tháng có một cột thu và một cột chi để so sánh.
// Thiết kế: cột bo đỉnh, lưới mờ nét đứt, chú thích gọn ở góc trên bên phải.
// Thu nhập dùng --chart-1 và chi tiêu dùng --chart-3 của bảng màu đang chọn.
function drawColumnChart(canvasId, labels, incomes, expenses) {
    destroyChart(canvasId);
    const text = cssVar('--text-3', '#8AA3B4');
    const grid = cssVar('--border', 'rgba(170, 200, 220, 0.12)');

    chartRegistry[canvasId] = new Chart($(canvasId), {
        type: 'bar',
        data: {
            labels,
            datasets: [
                { label: 'Thu nhập', data: incomes, backgroundColor: cssVar('--chart-1', '#8FBEDD'), borderRadius: { topLeft: 6, topRight: 6 }, borderSkipped: 'bottom', maxBarThickness: 22 },
                { label: 'Chi tiêu', data: expenses, backgroundColor: cssVar('--chart-3', '#E8B04A'), borderRadius: { topLeft: 6, topRight: 6 }, borderSkipped: 'bottom', maxBarThickness: 22 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            animation: { duration: 700, easing: 'easeOutCubic' },
            plugins: {
                legend: legendStyle('top'),
                tooltip: tooltipStyle({
                    displayColors: true,
                    callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}` }
                })
            },
            scales: {
                x: { grid: { display: false }, border: { display: false }, ticks: { color: text } },
                y: {
                    beginAtZero: true,
                    border: { display: false },
                    grid: { color: grid, borderDash: [4, 4], drawTicks: false },
                    ticks: { color: text, callback: (v) => formatCompactVND(v, false) }
                }
            }
        }
    });
}

// Đổi màu hex sang rgba với độ trong suốt a. Màu không phải hex thì giữ nguyên.
function withAlpha(color, a) {
    const m = /^#([0-9a-f]{6})$/i.exec(String(color).trim());
    if (!m) return color;
    const n = parseInt(m[1], 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

// Vẽ biểu đồ cột: chi tiêu từng ngày trong tháng.
// Cột cao nhất đậm màu; các cột còn lại nhạt đi để điểm chi nhiều nổi bật.
function drawDailyBarChart(canvasId, labels, values) {
    destroyChart(canvasId);

    const base = cssVar('--chart-daily', '#3DA374');
    const peak = values.indexOf(Math.max(...values));
    const colors = values.map((v, i) => (i === peak && v > 0 ? base : withAlpha(base, 0.4)));
    const text = cssVar('--text-3', '#8AA3B4');
    const grid = cssVar('--border', 'rgba(170, 200, 220, 0.12)');

    chartRegistry[canvasId] = new Chart($(canvasId), {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Chi tiêu',
                data: values,
                backgroundColor: colors,
                borderRadius: { topLeft: 6, topRight: 6 },
                borderSkipped: 'bottom',
                maxBarThickness: 18,
                barPercentage: 0.6,
                categoryPercentage: 0.85
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 900,
                easing: 'easeOutCubic',
                delay: (ctx) => (ctx.type === 'data' ? ctx.dataIndex * 14 : 0)
            },
            plugins: {
                legend: { display: false },
                tooltip: tooltipStyle({
                    displayColors: false,
                    callbacks: {
                        title: (items) => `Ngày ${items[0].label}`,
                        label: (ctx) => ` ${formatCompactVND(ctx.parsed.y, true)}`
                    }
                })
            },
            scales: {
                x: {
                    grid: { display: false },
                    border: { display: false },
                    ticks: { color: text, maxRotation: 0, autoSkip: true, maxTicksLimit: 16 },
                    title: { display: true, text: 'Ngày trong tháng', color: text }
                },
                y: {
                    beginAtZero: true,
                    border: { display: false },
                    grid: { color: grid, borderDash: [4, 4], drawTicks: false },
                    ticks: { color: text, callback: (v) => formatCompactVND(v, false) }
                }
            }
        }
    });
}

// Bộ đếm giờ: khi bạn kéo cửa sổ liên tục, chỉ vẽ lại biểu đồ một lần sau khi kéo xong.
let zoomRefreshTimer = null;
// Khi phóng to hoặc thu nhỏ trang, vẽ lại biểu đồ để hình luôn rõ nét.
function refreshChartsForZoom() {
    Object.values(chartRegistry).forEach((chart) => {
        chart.options.devicePixelRatio = window.devicePixelRatio || 1;
        chart.resize();
    });
}

window.addEventListener('resize', () => {
    clearTimeout(zoomRefreshTimer);
    zoomRefreshTimer = setTimeout(refreshChartsForZoom, 150);
});
