// ----------------------------------------------------------------------------
// Bộ đọc chữ dùng chung cho Ví và Lịch sử giao dịch (Tesseract.js).
// Engine của Tesseract in ra vài dòng cảnh báo nội bộ khi nạp dữ liệu tiếng Việt
// ("Parameter not found", "Estimating resolution"). Các dòng này không ảnh hưởng kết quả,
// nên chỉ lọc đúng những dòng đó trong lúc đọc chữ, các thông báo khác vẫn hiện như thường.
// ----------------------------------------------------------------------------

const OCR_NOISE_PATTERNS = [
    /Parameter not found/i,
    /Estimating resolution as/i,
];

function isOcrNoise(args) {
    const msg = args.map((a) => String(a)).join(' ');
    return OCR_NOISE_PATTERNS.some((re) => re.test(msg));
}

// Chạy một tác vụ với console đã lọc các dòng cảnh báo nội bộ của OCR. Luôn khôi phục console sau đó.
async function quietOcrConsole(task) {
    const methods = ['log', 'info', 'warn', 'error'];
    const original = {};
    methods.forEach((m) => {
        original[m] = console[m];
        console[m] = (...args) => {
            if (isOcrNoise(args)) return;
            original[m].apply(console, args);
        };
    });
    try {
        return await task();
    } finally {
        methods.forEach((m) => { console[m] = original[m]; });
    }
}

// Đọc chữ từ canvas bằng dữ liệu tiếng Việt. Trả về văn bản thô.
async function runTesseract(canvas, { psm = 6, whitelist = null } = {}) {
    return quietOcrConsole(async () => {
        const worker = await Tesseract.createWorker('vie');
        try {
            const params = { tessedit_pageseg_mode: String(psm) };
            if (whitelist) params.tessedit_char_whitelist = whitelist;
            await worker.setParameters(params);
            const { data } = await worker.recognize(canvas);
            return data.text;
        } finally {
            await worker.terminate();
        }
    });
}

// Vẽ ảnh xem trước vào canvas. Canvas không phụ thuộc src hay URL tạm nên luôn hiện đúng ảnh đã nhận.
function drawPreview(image, canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const scale = Math.min(1, 640 / image.naturalWidth);
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    canvas.hidden = false;
}

function clearPreview(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    canvas.width = 0;
    canvas.height = 0;
    canvas.hidden = true;
}

// Chuẩn bị ảnh cho OCR: phóng to vừa đủ, chuyển đen trắng và tăng tương phản.
function prepareOcrCanvas(image, { minWidth, maxScale }) {
    const scale = Math.max(1, Math.min(maxScale, minWidth / image.naturalWidth));
    const off = document.createElement('canvas');
    off.width = Math.round(image.naturalWidth * scale);
    off.height = Math.round(image.naturalHeight * scale);
    const ctx = off.getContext('2d');
    ctx.drawImage(image, 0, 0, off.width, off.height);
    const data = ctx.getImageData(0, 0, off.width, off.height);
    const px = data.data;
    let min = 255;
    let max = 0;
    for (let i = 0; i < px.length; i += 4) {
        const g = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
        px[i] = px[i + 1] = px[i + 2] = g;
        if (g < min) min = g;
        if (g > max) max = g;
    }
    const span = Math.max(1, max - min);
    for (let i = 0; i < px.length; i += 4) {
        const v = Math.round(((px[i] - min) / span) * 255);
        px[i] = px[i + 1] = px[i + 2] = v;
    }
    ctx.putImageData(data, 0, 0);
    return off;
}
