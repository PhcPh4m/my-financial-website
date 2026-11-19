// ----------------------------------------------------------------------------
// Đọc số dư ví từ ảnh chụp bằng Tesseract.js (chạy trên trình duyệt).
// Đọc cả ảnh, không khoanh vùng. Mỗi số đọc được là một dòng để bỏ tick, sửa tên,
// sửa số. Tổng được cộng lại kèm ghi chú nguồn. Ảnh chỉ nằm trong bộ nhớ tạm.
// ----------------------------------------------------------------------------

const WALLET_OCR_MIN_WIDTH = 1000;
const WALLET_OCR_MAX_DIGITS = 15;
const WALLET_OCR_MIN_AMOUNT = 1000; // bỏ số quá nhỏ như giờ (9:41) hoặc phần trăm

// Tách các số trong kết quả OCR. Mỗi số là một cụm chữ số (có thể có dấu chấm
// hoặc phẩy phân nhóm hàng nghìn). Các cụm cách nhau bằng chữ hoặc khoảng trắng
// không bị nối lại với nhau.
function parseWalletAmounts(text) {
    const groups = String(text || '').match(/\d+(?:[.,]\d{3})+|\d+/g) || [];
    return groups
        .map((g) => g.replace(/\D/g, ''))
        .filter((d) => d.length > 0 && d.length <= WALLET_OCR_MAX_DIGITS)
        .filter((d) => Number(d) >= WALLET_OCR_MIN_AMOUNT);
}

(function initWalletOcr() {
    let img = null;
    let busy = false;
    let items = []; // { name, amount, checked }

    function setError(msg) {
        $('walletOcrError').textContent = msg || '';
    }

    // Đưa cửa sổ về trạng thái ban đầu và xóa ảnh khỏi bộ nhớ.
    function resetPanel() {
        img = null;
        clearPreview('walletOcrPreview');
        $('walletOcrStatus').textContent = '';
        items = [];
        $('walletOcrList').innerHTML = '';
        $('walletOcrResult').hidden = true;
        $('walletOcrFile').value = '';
        $('walletOcrApp').value = '';
        setError('');
        $('walletOcrPanel').hidden = true;
        $('walletOcrDrop').hidden = false;
    }

    function loadFile(file) {
        setError('');
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            setError('Hãy chọn một file ảnh.');
            return;
        }
        const url = URL.createObjectURL(file);
        const image = new Image();
        image.onload = () => {
            img = image;
            drawPreview(image, 'walletOcrPreview');
            URL.revokeObjectURL(url);
            $('walletOcrStatus').textContent = 'Đã nhận ảnh. Đối chiếu ảnh với các số bên dưới, rồi bấm Đọc số.';
            $('walletOcrResult').hidden = true;
            $('walletOcrDrop').hidden = true;
            $('walletOcrPanel').hidden = false;
        };
        image.onerror = () => {
            URL.revokeObjectURL(url);
            setError('Không mở được ảnh này. Thử ảnh khác.');
        };
        image.src = url;
    }

    function prepareImage() {
        return prepareOcrCanvas(img, { minWidth: WALLET_OCR_MIN_WIDTH, maxScale: 3 });
    }

    // Vẽ danh sách số đọc được. Tên mặc định là Ví 1, Ví 2...
    function renderList() {
        $('walletOcrList').innerHTML = items.map((it, i) => `
            <li class="wallet-ocr__item">
                <input type="checkbox" class="wallet-ocr__check" data-i="${i}" data-field="checked" ${it.checked ? 'checked' : ''} aria-label="Tính vào tổng">
                <input type="text" class="form-input wallet-ocr__name" data-i="${i}" data-field="name" maxlength="40" value="${escapeHtml(it.name)}" placeholder="Tên ví">
                <input type="text" inputmode="numeric" class="form-input wallet-ocr__amount" data-i="${i}" data-field="amount" value="${it.amount}" aria-label="Số dư">
            </li>`).join('');
        updateSummary();
    }

    // Cộng các dòng được tick và viết ghi chú nguồn bên dưới tổng.
    function updateSummary() {
        const checked = items.filter((it) => it.checked && Number(it.amount) > 0);
        const total = checked.reduce((sum, it) => sum + Number(it.amount), 0);
        const app = $('walletOcrApp').value.trim() || 'app này';
        $('walletOcrTotal').textContent = formatCurrency(total);
        const parts = checked.map((it) => `${it.name || 'Ví'} ${formatCurrency(Number(it.amount))}`);
        $('walletOcrNote').textContent = checked.length
            ? `Tổng số dư của bạn trong ${app}: ${parts.join(' + ')}.`
            : '';
        $('walletOcrUse').disabled = checked.length === 0;
    }

    async function readBalance() {
        if (busy) return;
        if (!img) { setError('Hãy dán hoặc chọn ảnh trước.'); return; }
        if (typeof Tesseract === 'undefined') {
            setError('Chưa tải được bộ đọc chữ. Kiểm tra kết nối mạng và thử lại.');
            return;
        }
        busy = true;
        const readBtn = $('walletOcrRead');
        readBtn.disabled = true;
        readBtn.textContent = 'Đang đọc...';
        setError('');
        try {
            const text = await runTesseract(prepareImage(), { psm: 11, whitelist: '0123456789.,' });
            const amounts = parseWalletAmounts(text);
            if (amounts.length === 0) {
                setError('Không đọc được số. Thử ảnh rõ hơn hoặc nhập tay.');
                $('walletOcrResult').hidden = true;
            } else {
                items = amounts.map((a, i) => ({ name: `Ví ${i + 1}`, amount: a, checked: true }));
                renderList();
                $('walletOcrResult').hidden = false;
            }
        } catch (err) {
            setError('Đọc ảnh bị lỗi. Thử lại hoặc nhập tay.');
        } finally {
            busy = false;
            readBtn.disabled = false;
            readBtn.textContent = 'Đọc số';
        }
    }

    // Điền tổng vào ô Số dư đầu. Nếu chưa có tên ví thì lấy tên app làm tên ví.
    function useTotal() {
        const total = items
            .filter((it) => it.checked)
            .reduce((sum, it) => sum + (Number(it.amount) || 0), 0);
        if (total <= 0) { setError('Chưa có khoản nào được tick.'); return; }
        const app = $('walletOcrApp').value.trim();
        setMoneyValue($('walletOpening'), total);
        if (app && !$('walletName').value.trim()) $('walletName').value = app;
        resetPanel();
        showToast('Đã điền tổng số dư', 'success');
    }

    document.addEventListener('DOMContentLoaded', () => {
        if (!$('walletOcrDrop')) return;
        $('walletOcrBtn').addEventListener('click', (e) => {
            e.stopPropagation();
            $('walletOcrFile').click();
        });
        $('walletOcrFile').addEventListener('change', (e) => loadFile(e.target.files[0]));
        $('walletOcrRead').addEventListener('click', readBalance);
        $('walletOcrUse').addEventListener('click', useTotal);
        $('walletOcrCancel').addEventListener('click', resetPanel);
        $('walletOcrApp').addEventListener('input', updateSummary);

        // Sửa tên, số, tick ngay trong danh sách.
        const onEdit = (e) => {
            const i = Number(e.target.dataset.i);
            if (Number.isNaN(i) || !items[i]) return;
            const field = e.target.dataset.field;
            if (field === 'checked') items[i].checked = e.target.checked;
            if (field === 'name') items[i].name = e.target.value;
            if (field === 'amount') {
                items[i].amount = e.target.value.replace(/\D/g, '').slice(0, WALLET_OCR_MAX_DIGITS);
                e.target.value = items[i].amount;
            }
            updateSummary();
        };
        $('walletOcrList').addEventListener('input', onEdit);
        $('walletOcrList').addEventListener('change', onEdit);

        // Kéo thả ảnh vào vùng dán. Nhấn vào vùng chỉ lấy tiêu điểm.
        const drop = $('walletOcrDrop');
        drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('is-over'); });
        drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
        drop.addEventListener('drop', (e) => {
            e.preventDefault();
            drop.classList.remove('is-over');
            loadFile(e.dataTransfer.files[0]);
        });

        // Ctrl+V khi cửa sổ Ví đang mở.
        document.addEventListener('paste', (e) => {
            if (!$('walletModal').classList.contains('active')) return;
            const dataItems = e.clipboardData && e.clipboardData.items;
            if (!dataItems) return;
            for (const item of dataItems) {
                if (item.type.startsWith('image/')) {
                    e.preventDefault();
                    resetPanel();
                    loadFile(item.getAsFile());
                    return;
                }
            }
        });

        // Đóng cửa sổ Ví thì bỏ ảnh tạm.
        ['closeWalletModal', 'closeWalletModalFooter'].forEach((id) => {
            $(id).addEventListener('click', resetPanel);
        });
    });
})();
