// DANH SÁCH NGÂN HÀNG VÀ CÔNG TY TÀI CHÍNH CHO VAY TIÊU DÙNG.
// Lãi suất để null nghĩa là chưa có số liệu đã kiểm chứng: người dùng nhập tay hoặc xem trang chính thức.
// Khi có số liệu, điền rateMin, rateMax (%/năm) và updated (yyyy-mm-dd). Không tự suy đoán số liệu.
// Ghi chú: danh sách lập từ kiến thức chung, cần đối chiếu lại tên và trang web trước khi dùng.
const BANK_RATES = [
    // Ngân hàng thương mại nhà nước
    { id: 'vcb', name: 'Vietcombank', type: 'bank', url: 'https://www.vietcombank.com.vn', rateMin: null, rateMax: null, updated: null },
    { id: 'bidv', name: 'BIDV', type: 'bank', url: 'https://www.bidv.com.vn', rateMin: null, rateMax: null, updated: null },
    { id: 'ctg', name: 'VietinBank', type: 'bank', url: 'https://www.vietinbank.vn', rateMin: null, rateMax: null, updated: null },
    { id: 'vba', name: 'Agribank', type: 'bank', url: 'https://www.agribank.com.vn', rateMin: null, rateMax: null, updated: null },
    { id: 'vbsp', name: 'Ngân hàng Chính sách xã hội', type: 'bank', url: 'https://www.vbsp.org.vn', rateMin: null, rateMax: null, updated: null },
    // Ngân hàng thương mại cổ phần
    { id: 'tcb', name: 'Techcombank', type: 'bank', url: 'https://techcombank.com.vn', rateMin: null, rateMax: null, updated: null },
    { id: 'vpb', name: 'VPBank', type: 'bank', url: 'https://www.vpbank.com.vn', rateMin: null, rateMax: null, updated: null },
    { id: 'mbb', name: 'MB (Quân đội)', type: 'bank', url: 'https://www.mbbank.com.vn', rateMin: null, rateMax: null, updated: null },
    { id: 'acb', name: 'ACB', type: 'bank', url: 'https://acb.com.vn', rateMin: null, rateMax: null, updated: null },
    { id: 'tpb', name: 'TPBank', type: 'bank', url: 'https://tpb.vn', rateMin: null, rateMax: null, updated: null },
    { id: 'stb', name: 'Sacombank', type: 'bank', url: 'https://www.sacombank.com.vn', rateMin: null, rateMax: null, updated: null },
    { id: 'hdb', name: 'HDBank', type: 'bank', url: 'https://hdbank.com.vn', rateMin: null, rateMax: null, updated: null },
    { id: 'vib', name: 'VIB', type: 'bank', url: 'https://www.vib.com.vn', rateMin: null, rateMax: null, updated: null },
    { id: 'shb', name: 'SHB', type: 'bank', url: 'https://www.shb.com.vn', rateMin: null, rateMax: null, updated: null },
    { id: 'eib', name: 'Eximbank', type: 'bank', url: 'https://eximbank.com.vn', rateMin: null, rateMax: null, updated: null },
    { id: 'msb', name: 'MSB', type: 'bank', url: 'https://www.msb.com.vn', rateMin: null, rateMax: null, updated: null },
    { id: 'ocb', name: 'OCB', type: 'bank', url: 'https://ocb.com.vn', rateMin: null, rateMax: null, updated: null },
    { id: 'seab', name: 'SeABank', type: 'bank', url: 'https://www.seabank.com.vn', rateMin: null, rateMax: null, updated: null },
    { id: 'lpb', name: 'LPBank', type: 'bank', url: 'https://www.lpbank.com.vn', rateMin: null, rateMax: null, updated: null },
    { id: 'kls', name: 'Kiên Long', type: 'bank', url: 'https://www.kienlongbank.com', rateMin: null, rateMax: null, updated: null },
    { id: 'nab', name: 'Nam A Bank', type: 'bank', url: 'https://www.namabank.com.vn', rateMin: null, rateMax: null, updated: null },
    { id: 'bab', name: 'Bắc Á Bank', type: 'bank', url: 'https://www.bacabank.com.vn', rateMin: null, rateMax: null, updated: null },
    { id: 'bvb', name: 'Bảo Việt Bank', type: 'bank', url: 'https://www.baovietbank.vn', rateMin: null, rateMax: null, updated: null },
    { id: 'pvcb', name: 'PVcomBank', type: 'bank', url: 'https://www.pvcombank.com.vn', rateMin: null, rateMax: null, updated: null },
    { id: 'vab', name: 'VietABank', type: 'bank', url: 'https://www.vietabank.com.vn', rateMin: null, rateMax: null, updated: null },
    { id: 'scb', name: 'Saigonbank', type: 'bank', url: 'https://www.saigonbank.com.vn', rateMin: null, rateMax: null, updated: null },
    { id: 'abb', name: 'ABBANK', type: 'bank', url: 'https://www.abbank.vn', rateMin: null, rateMax: null, updated: null },
    { id: 'vcc', name: 'Viet Capital Bank', type: 'bank', url: 'https://www.vietcapitalbank.com.vn', rateMin: null, rateMax: null, updated: null },
    { id: 'vbk', name: 'Vietbank', type: 'bank', url: 'https://www.vietbank.com.vn', rateMin: null, rateMax: null, updated: null },
    { id: 'gpb', name: 'GPBank', type: 'bank', url: 'https://www.gpbank.com.vn', rateMin: null, rateMax: null, updated: null },
    // Ngân hàng liên doanh và nước ngoài
    { id: 'shinhan', name: 'Shinhan Bank Việt Nam', type: 'bank', url: 'https://shinhan.com.vn', rateMin: null, rateMax: null, updated: null },
    { id: 'hsbc', name: 'HSBC Việt Nam', type: 'bank', url: 'https://www.hsbc.com.vn', rateMin: null, rateMax: null, updated: null },
    { id: 'scbvn', name: 'Standard Chartered Việt Nam', type: 'bank', url: 'https://www.sc.com/vn', rateMin: null, rateMax: null, updated: null },
    { id: 'uob', name: 'UOB Việt Nam', type: 'bank', url: 'https://www.uob.com.vn', rateMin: null, rateMax: null, updated: null },
    { id: 'cimb', name: 'CIMB Việt Nam', type: 'bank', url: 'https://www.cimbbank.com.vn', rateMin: null, rateMax: null, updated: null },
    // Công ty tài chính tiêu dùng
    { id: 'fec', name: 'FE Credit', type: 'finance', url: 'https://www.fecredit.com.vn', rateMin: null, rateMax: null, updated: null },
    { id: 'hc', name: 'Home Credit', type: 'finance', url: 'https://www.homecredit.vn', rateMin: null, rateMax: null, updated: null },
    { id: 'hds', name: 'HD Saison', type: 'finance', url: 'https://www.hdsaison.com.vn', rateMin: null, rateMax: null, updated: null },
    { id: 'mcr', name: 'Mcredit', type: 'finance', url: 'https://www.mcredit.com.vn', rateMin: null, rateMax: null, updated: null },
    { id: 'shf', name: 'Shinhan Finance', type: 'finance', url: 'https://www.shinhanfinance.com.vn', rateMin: null, rateMax: null, updated: null }
];
