// API MODULE
// Lấy dự báo thời tiết từ Open-Meteo (public API, không cần API key, hỗ trợ CORS).
// Mặc định: TP. Hồ Chí Minh
// Tên thành phố hiển thị trên khối thời tiết.
const WEATHER_CITY = 'TP. Hồ Chí Minh';

// Địa chỉ của dịch vụ thời tiết. Chỉ cần đổi nếu đổi nguồn dữ liệu.
const WEATHER_API_URL = 'https://api.open-meteo.com/v1/forecast'
    + '?latitude=10.7769&longitude=106.7009'
    + '&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code'
    + '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max'
    + '&timezone=Asia%2FHo_Chi_Minh&forecast_days=3';
// Tên ngăn nhớ tạm trong trình duyệt để lưu kết quả thời tiết.
const WEATHER_CACHE_KEY = 'weather_cache_v2';
// Giữ kết quả thời tiết trong 30 phút (đơn vị mili-giây).
const WEATHER_CACHE_MS = 30 * 60 * 1000;   // 30 phút
// Chờ dịch vụ tối đa 6 giây. Quá lâu thì bỏ qua để trang không bị treo.
const WEATHER_TIMEOUT_MS = 6000;

// Bảng đổi mã thời tiết của dịch vụ sang chữ tiếng Việt và hình tương ứng. Ví dụ mã 0 là trời quang.
const WMO_CODES = {
    0: ['Trời quang', 'sun'],
    1: ['Ít mây', 'cloud-sun'],
    2: ['Có mây', 'cloud-sun'],
    3: ['Nhiều mây', 'cloud'],
    45: ['Sương mù', 'fog'],
    48: ['Sương mù đóng băng', 'fog'],
    51: ['Mưa phùn nhẹ', 'cloud-rain'],
    53: ['Mưa phùn', 'cloud-rain'],
    55: ['Mưa phùn dày', 'cloud-rain'],
    61: ['Mưa nhẹ', 'cloud-rain'],
    63: ['Mưa vừa', 'cloud-rain'],
    65: ['Mưa to', 'cloud-rain'],
    80: ['Mưa rào nhẹ', 'cloud-rain'],
    81: ['Mưa rào', 'cloud-rain'],
    82: ['Mưa rào to', 'cloud-lightning'],
    95: ['Dông', 'cloud-lightning'],
    96: ['Dông có mưa đá', 'cloud-lightning'],
    99: ['Dông có mưa đá lớn', 'cloud-lightning']
};


// Tra bảng trên để biết mã thời tiết nghĩa là gì và dùng hình nào.
function describeWeatherCode(code) {
    const [text, icon] = WMO_CODES[code] || ['Không xác định', 'thermometer'];
    return { text, icon };
}

// Lấy các số cần dùng (nhiệt độ, độ ẩm, dự báo) từ dữ liệu dịch vụ gửi về. Nếu thiếu thì báo lỗi.
function parseWeatherResponse(data) {
    const current = data && data.current;
    const daily = data && data.daily;

    const hasCurrent = current
        && Number.isFinite(current.temperature_2m)
        && Number.isFinite(current.relative_humidity_2m)
        && Number.isFinite(current.wind_speed_10m);
    const hasDaily = daily
        && Array.isArray(daily.time)
        && daily.time.length > 0
        && Array.isArray(daily.temperature_2m_max)
        && Array.isArray(daily.temperature_2m_min);

    if (!hasCurrent || !hasDaily) {
        throw new Error('Dữ liệu thời tiết từ máy chủ không hợp lệ.');
    }

    const now = describeWeatherCode(current.weather_code);
    return {
        city: WEATHER_CITY,
        updatedAt: current.time || '',
        current: {
            temperature: Math.round(current.temperature_2m),
            feelsLike: Math.round(current.apparent_temperature),
            humidity: Math.round(current.relative_humidity_2m),
            windKmh: Math.round(current.wind_speed_10m),
            text: now.text,
            icon: now.icon
        },
        days: daily.time.map((date, i) => {
            const day = describeWeatherCode(daily.weather_code[i]);
            return {
                date,
                max: Math.round(daily.temperature_2m_max[i]),
                min: Math.round(daily.temperature_2m_min[i]),
                rainChance: Number.isFinite(daily.precipitation_probability_max?.[i])
                    ? Math.round(daily.precipitation_probability_max[i])
                    : null,
                text: day.text,
                icon: day.icon
            };
        })
    };
}

// Gửi yêu cầu lên Internet, chờ tối đa 6 giây, rồi đổi kết quả sang dạng dữ liệu đọc được.
async function fetchJsonWithTimeout(url, timeoutMs) {
    // Bộ hủy yêu cầu: nếu quá thời gian chờ, signal sẽ hủy fetch.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        // Gửi yêu cầu HTTP đến Open-Meteo; await đợi phản hồi trước khi đi tiếp.
        const response = await fetch(url, {
            method: 'GET',
            headers: { Accept: 'application/json' },
            signal: controller.signal
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        return await response.json();
    } finally {
        clearTimeout(timer);
    }
}


// Đọc kết quả thời tiết đã nhớ tạm. Nếu hết hạn hoặc không có thì trả về rỗng.
function readWeatherCache() {
    try {
        const cached = JSON.parse(localStorage.getItem(WEATHER_CACHE_KEY) || 'null');
        // Dữ liệu còn hạn trong cache thì dùng lại, không gọi API.
        if (cached && Date.now() - cached.savedAt < WEATHER_CACHE_MS && cached.data) {
            return cached.data;
        }
    } catch (error) {
        console.warn('Không đọc được cache thời tiết:', error);
    }
    return null;
}

// Lưu kết quả thời tiết vào ngăn nhớ tạm, kèm giờ lưu để biết khi nào đã cũ.
function writeWeatherCache(data) {
    try {
        localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data }));
    } catch (error) {
        console.warn('Không lưu được cache thời tiết:', error);
    }
}


// Hàm chính về thời tiết: nếu kết quả nhớ tạm còn mới thì dùng lại, không thì hỏi dịch vụ rồi lưu lại.
async function getWeather({ forceRefresh = false } = {}) {
    if (!forceRefresh) {
        const cached = readWeatherCache();
        if (cached) return { ...cached, fromCache: true };
    }
    try {
        const data = await fetchJsonWithTimeout(WEATHER_API_URL, WEATHER_TIMEOUT_MS);
        const result = parseWeatherResponse(data);
        writeWeatherCache(result);
        return { ...result, fromCache: false };
    } catch (error) {
        console.error('Lỗi gọi API thời tiết:', error);
        if (error.name === 'AbortError') {
            throw new Error('Máy chủ thời tiết phản hồi quá chậm. Vui lòng thử lại.');
        }
        if (error instanceof TypeError) {
            throw new Error('Không có kết nối Internet. Kiểm tra mạng rồi thử lại.');
        }
        if (error.message.includes('không hợp lệ')) {
            throw error;
        }
        throw new Error('Không tải được dự báo thời tiết. Vui lòng thử lại sau.');
    }
}
