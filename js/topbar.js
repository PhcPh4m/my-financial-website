// THANH TRÊN THU GỌN: máy tính mở bằng rê chuột (CSS), điện thoại mở bằng cách chạm vào vùng thanh.

document.addEventListener('DOMContentLoaded', () => {
    const bar = document.querySelector('.topbar');
    if (!bar) return;

    // Thanh chọn tab bám theo mỗi khi nhãn đổi độ rộng (rê chuột, chạm, hoặc khi trang vừa tải xong).
    if ('ResizeObserver' in window) {
        const ro = new ResizeObserver(() => moveNavPill(currentNavLink(), false));
        document.querySelectorAll('.nav-tabs .nav-link').forEach((link) => ro.observe(link));
    }

    const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    if (!canHover) {
        // Chạm vào vùng thanh (không phải liên kết hay nút) để bật tắt nhãn.
        bar.addEventListener('click', (e) => {
            if (e.target.closest('a, button')) return;
            bar.classList.toggle('is-expanded');
            followNavPill();
        });

        // Chạm ra ngoài thanh thì thu gọn lại.
        document.addEventListener('click', (e) => {
            if (!bar.contains(e.target) && bar.classList.contains('is-expanded')) {
                bar.classList.remove('is-expanded');
                followNavPill();
            }
        });
    } else {
        // Rê chuột vào hoặc ra khỏi thanh: thanh kính đo lại theo nhãn đang mở rộng.
        bar.addEventListener('mouseenter', () => followNavPill());
        bar.addEventListener('mouseleave', () => followNavPill());
    }
});
