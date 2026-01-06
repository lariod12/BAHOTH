const REFERENCE_ROWS = [
    {
        room: 'Căn Phòng Bỏ Hoang',
        bite: 18, book: 7, orb: 12, dog: 38, girl: 1,
        cross: 9, wood: 45, mask: 42, amulet: 49, ring: 28, skull: 34, spear: 43, ouija: 48,
    },
    {
        room: 'Ban Công',
        bite: 24, book: 7, orb: 32, dog: 5, girl: 16,
        cross: 6, wood: 11, mask: 25, amulet: 49, ring: 20, skull: 47, spear: 39, ouija: 2,
    },
    {
        room: 'Hầm Mộ',
        bite: 4, book: 7, orb: 23, dog: 46, girl: 1,
        cross: 13, wood: 10, mask: 25, amulet: 49, ring: 41, skull: 37, spear: 43, ouija: 48,
    },
    {
        room: 'Căn Phòng Bị Cháy',
        bite: 24, book: 33, orb: 23, dog: 38, girl: 30,
        cross: 13, wood: 31, mask: 48, amulet: 44, ring: 20, skull: 47, spear: 15, ouija: 8,
    },
    {
        room: 'Phòng Ăn',
        bite: 24, book: 3, orb: 27, dog: 5, girl: 16,
        cross: 6, wood: 45, mask: 42, amulet: 21, ring: 20, skull: 37, spear: 39, ouija: 40,
    },
    {
        room: 'Lò Than',
        bite: 4, book: 33, orb: 32, dog: 38, girl: 30,
        cross: 13, wood: 10, mask: 42, amulet: 36, ring: 28, skull: 34, spear: 15, ouija: 2,
    },
    {
        room: 'Khán Đài',
        bite: 18, book: 3, orb: 19, dog: 19, girl: 19,
        cross: 22, wood: 10, mask: 25, amulet: 36, ring: 41, skull: 37, spear: 15, ouija: 8,
    },
    {
        room: 'Phòng Thể Dục',
        bite: 35, book: 29, orb: 12, dog: 46, girl: 1,
        cross: 22, wood: 11, mask: 22, amulet: 21, ring: 41, skull: 47, spear: 43, ouija: 48,
    },
    {
        room: 'Căn Phòng Bùa Bỡn',
        bite: 4, book: 33, orb: 27, dog: 46, girl: 1,
        cross: 9, wood: 11, mask: 25, amulet: 44, ring: 17, skull: 17, spear: 17, ouija: 40,
    },
    {
        room: 'Nhà Bếp',
        bite: 18, book: 3, orb: 23, dog: 46, girl: 16,
        cross: 22, wood: 31, mask: 32, amulet: 36, ring: 41, skull: 37, spear: 39, ouija: 2,
    },
    {
        room: 'Phòng Ngủ Chính',
        bite: 35, book: 29, orb: 27, dog: 5, girl: 16,
        cross: 6, wood: 10, mask: 35, amulet: 44, ring: 20, skull: 47, spear: 43, ouija: 2,
    },
    {
        room: 'Căn Buồng Hình Sao',
        bite: 26, book: 50, orb: 32, dog: 50, girl: 26,
        cross: 26, wood: 45, mask: 14, amulet: 14, ring: 26, skull: 14, spear: 50, ouija: 40,
    },
    {
        room: 'Phòng Gia Nhân',
        bite: 35, book: 29, orb: 12, dog: 5, girl: 30,
        cross: 9, wood: 31, mask: 42, amulet: 21, ring: 28, skull: 34, spear: 15, ouija: 8,
    },
];

function renderReferenceTable() {
    const thead = `
        <thead>
            <tr>
                <th scope="col">Tên phòng</th>
                <th scope="col">Vết Cắn</th>
                <th scope="col">Cuốn Sách</th>
                <th scope="col">Quả Cầu Thủy Tinh</th>
                <th scope="col">Con Chó</th>
                <th scope="col">Cô Gái</th>
                <th scope="col">Thánh Giá</th>
                <th scope="col">Gỗ Điên</th>
                <th scope="col">Mặt Nạ</th>
                <th scope="col">Mặt Dây Chuyền</th>
                <th scope="col">Chiếc Nhẫn</th>
                <th scope="col">Đầu Lâu</th>
                <th scope="col">Cây Giáo</th>
                <th scope="col">Bảng Cầu Cơ</th>
            </tr>
        </thead>
    `.trim();

    const rows = REFERENCE_ROWS.map((r) => `
        <tr>
            <th scope="row">${r.room}</th>
            <td>${r.bite}</td>
            <td>${r.book}</td>
            <td>${r.orb}</td>
            <td>${r.dog}</td>
            <td>${r.girl}</td>
            <td>${r.cross}</td>
            <td>${r.wood}</td>
            <td>${r.mask}</td>
            <td>${r.amulet}</td>
            <td>${r.ring}</td>
            <td>${r.skull}</td>
            <td>${r.spear}</td>
            <td>${r.ouija}</td>
        </tr>
    `.trim()).join('');

    return `
        <div class="table-scroll">
            <table class="reference-table">
                ${thead}
                <tbody>
                    ${rows}
                </tbody>
            </table>
        </div>
    `.trim();
}

function renderTraitorsTomeReferenceMarkup() {
    return `
        <div class="welcome-container">
            <div class="welcome-content welcome-content--page">
                <p class="welcome-kicker">TRAITORS TOME</p>
                <h2 class="page-title">BẢNG TRA</h2>
                <p class="page-subtitle">Bảng tham chiếu để tra cứu theo phòng.</p>

                ${renderReferenceTable()}

                <div class="page-footer">
                    <button class="link-button" type="button" data-action="back">Back</button>
                </div>
            </div>
        </div>
    `.trim();
}

export function renderTraitorsTomeReferenceView({ mountEl, onNavigate }) {
    mountEl.innerHTML = renderTraitorsTomeReferenceMarkup();

    const backButton = mountEl.querySelector('[data-action="back"]');
    backButton?.addEventListener('click', () => onNavigate('#/tutorial'));
}


