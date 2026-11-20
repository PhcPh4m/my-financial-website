// CÀI ĐẶT: lưu tùy chọn riêng của thiết bị và áp dụng qua biến CSS trên :root.

// Tên khóa lưu tùy chọn trong localStorage. Giao diện sáng/tối vẫn dùng khóa app_theme của utils.js.
const SETTINGS_KEY = 'app_settings';

const SETTINGS_DEFAULTS = {
    glass: 50,
    palette: 'ocean',
    reduceMotion: false
};

// Các bảng màu nền. Phải khớp với html[data-palette] trong scss/_palettes.scss.
const PALETTES = ['ocean', 'forest', 'wine', 'violet', 'sand', 'hong', 'than', 'dat', 'xanh', 'cham'];

// Hệ số nhân cho độ đục của kính. Biến --glass-mul trên :root đọc giá trị này.
// Thanh trượt độ mờ: giá trị 0 (trong suốt nhất) đến 100 (đặc nhất). 50 là mặc định.
// Giá trị cũ dạng chữ (soft, medium, strong) được quy về mức tương ứng.
const GLASS_LEGACY = { soft: 25, medium: 50, strong: 80 };

function glassValue(raw) {
    const v = typeof raw === 'number' ? raw : (GLASS_LEGACY[raw] ?? 50);
    return Math.min(100, Math.max(0, v));
}

// Đặt --glass-mul (độ đục) và --glass-blur (độ mờ nền) trên :root từ giá trị thanh trượt.
function applyGlass(v) {
    const t = v / 100;
    const root = document.documentElement;
    const mul = t <= 0.5 ? 1.84 * t : 1 + 2.2 * (t - 0.5);
    const blur = 4 + 12 * t;
    root.style.setProperty('--glass-mul', String(mul));
    root.style.setProperty('--glass-blur', `${blur.toFixed(1)}px`);
    root.style.setProperty('--glass-sat', `${(100 + 120 * t).toFixed(0)}%`);
}

// Đọc tùy chọn đã lưu. Nếu lỗi hoặc chưa có thì dùng mặc định.
function loadSettings() {
    try {
        const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
        return { ...SETTINGS_DEFAULTS, ...(saved && typeof saved === 'object' ? saved : {}) };
    } catch (e) {
        return { ...SETTINGS_DEFAULTS };
    }
}

// Lưu tùy chọn. Nếu bộ nhớ bị chặn thì vẫn áp dụng trong phiên này.
function saveSettings(settings) {
    try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
        // Bộ nhớ bị chặn hoặc đầy.
    }
}

// Áp dụng tùy chọn: độ mờ kính qua biến --glass-mul trên :root.
function applySettings(settings) {
    applyGlass(glassValue(settings.glass));
    const palette = PALETTES.includes(settings.palette) ? settings.palette : 'ocean';
    document.documentElement.dataset.palette = palette;
    // Báo cho biểu đồ vẽ lại theo bảng màu mới (dùng cùng sự kiện với đổi sáng/tối).
    document.dispatchEvent(new CustomEvent('themechange', { detail: palette }));
    if (settings.reduceMotion) document.documentElement.dataset.reduceMotion = 'on';
    else delete document.documentElement.dataset.reduceMotion;
}

// Bật lớp is-switching trong một lúc để màu và kính chuyển dần khi đổi tùy chọn.
let switchTimer = null;
function flashSwitch() {
    const root = document.documentElement;
    root.classList.add('is-switching');
    clearTimeout(switchTimer);
    switchTimer = setTimeout(() => root.classList.remove('is-switching'), motionTokens.ms('slow'));
}

// Cập nhật số hiển thị và phần đã kéo của thanh trượt độ mờ.
function paintGlassSlider(slider) {
    const out = $('glassValue');
    const v = Number(slider.value);
    slider.style.setProperty('--fill', `${v}%`);
    if (out) out.textContent = String(v);
}

// Gắn sự kiện cho trang Cài đặt. Các trang khác không có #settingsSaved nên bỏ qua.
function bindSettingsPage() {
    const note = $('settingsSaved');
    if (!note) return;

    const settings = loadSettings();
    const choice = { theme: currentTheme(), glass: settings.glass, palette: settings.palette };
    const buttons = document.querySelectorAll('[data-group]');

    // Đặt viên trượt dưới nút đang chọn của mỗi nhóm. animate=false khi tải trang hoặc đổi cỡ màn hình.
    const movePills = (animate = true) => {
        document.querySelectorAll('.seg').forEach((seg) => {
            const pill = seg.querySelector('.seg__pill');
            const btn = seg.querySelector('[aria-pressed="true"]');
            if (!pill || !btn) return;
            if (!animate) pill.style.transition = 'none';
            pill.style.width = `${btn.offsetWidth}px`;
            pill.style.transform = `translateX(${btn.offsetLeft}px)`;
            pill.style.opacity = '1';
            if (!animate) {
                void pill.offsetWidth; // ép trình duyệt áp dụng vị trí ngay, rồi mới bật lại transition
                pill.style.transition = '';
            }
        });
    };

    const paint = (animate = true) => {
        buttons.forEach((b) => {
            b.setAttribute('aria-pressed', String(choice[b.dataset.group] === b.dataset.value));
        });
        movePills(animate);
    };
    paint(false);
    window.addEventListener('resize', () => movePills(false));
    if (document.fonts) document.fonts.ready.then(() => movePills(false));

    buttons.forEach((btn) => {
        btn.addEventListener('click', () => {
            const group = btn.dataset.group;
            const value = btn.dataset.value;
            choice[group] = value;
            flashSwitch();

            if (group === 'theme') {
                try {
                    localStorage.setItem(THEME_KEY, value);
                } catch (e) {
                    // Bộ nhớ bị chặn: vẫn đổi giao diện trong phiên này.
                }
                applyTheme(value);
                document.dispatchEvent(new CustomEvent('themechange', { detail: value }));
            } else {
                settings[group] = value;
                saveSettings(settings);
                applySettings(settings);
            }

            paint();
            note.textContent = 'Đã lưu.';
        });
    });

    // Thanh trượt: đổi trực tiếp khi kéo (không chuyển dần để theo kịp tay), lưu khi thả.
    bindExtraSettings(note, settings);

    const slider = $('glassSlider');
    if (slider) {
        slider.value = String(glassValue(settings.glass));
        paintGlassSlider(slider);
        slider.addEventListener('input', () => {
            document.documentElement.style.transition = 'none';
            applyGlass(Number(slider.value));
            paintGlassSlider(slider);
        });
        slider.addEventListener('change', () => {
            document.documentElement.style.transition = '';
            settings.glass = Number(slider.value);
            saveSettings(settings);
            note.textContent = 'Đã lưu.';
        });
    }
}

// Công tắc giảm chuyển động và nút khôi phục mặc định.
function bindExtraSettings(note, settings) {
    const toggle = $('reduceMotionToggle');
    if (toggle) {
        const state = $('motionState');
        const paintState = () => { if (state) state.textContent = toggle.checked ? 'Đang bật' : 'Đang tắt'; };
        toggle.checked = Boolean(settings.reduceMotion);
        paintState();
        toggle.addEventListener('change', () => {
            settings.reduceMotion = toggle.checked;
            saveSettings(settings);
            applySettings(settings);
            paintState();
            note.textContent = 'Đã lưu.';
        });
    }
    const reset = $('resetSettingsBtn');
    if (reset) {
        reset.addEventListener('click', () => {
            const theme = localStorage.getItem(THEME_KEY);
            saveSettings({ ...SETTINGS_DEFAULTS });
            applySettings({ ...SETTINGS_DEFAULTS });
            // Giữ nguyên giao diện sáng/tối đang chọn; chỉ đặt lại các tùy chọn còn lại.
            if (theme) document.documentElement.dataset.theme = theme;
            location.reload();
        });
    }
}

document.addEventListener('DOMContentLoaded', bindSettingsPage);
