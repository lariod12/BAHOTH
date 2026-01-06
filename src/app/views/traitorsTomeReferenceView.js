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

const OMEN_DEFS = [
    { key: 'bite', label: 'Vết Cắn', aliases: ['vet can', 'vết cắn', 'bite'] },
    { key: 'book', label: 'Cuốn Sách', aliases: ['cuon sach', 'cuốn sách', 'book'] },
    { key: 'orb', label: 'Quả Cầu Thủy Tinh', aliases: ['qua cau thuy tinh', 'quả cầu thủy tinh', 'orb', 'crystal ball', 'qua cau'] },
    { key: 'dog', label: 'Con Chó', aliases: ['con cho', 'con chó', 'dog'] },
    { key: 'girl', label: 'Cô Gái', aliases: ['co gai', 'cô gái', 'girl'] },
    { key: 'cross', label: 'Thánh Giá', aliases: ['thanh gia', 'thánh giá', 'cross'] },
    { key: 'wood', label: 'Gỗ Điên', aliases: ['go dien', 'gỗ điên', 'wood'] },
    { key: 'mask', label: 'Mặt Nạ', aliases: ['mat na', 'mặt nạ', 'mask'] },
    { key: 'amulet', label: 'Mặt Dây Chuyền', aliases: ['mat day chuyen', 'mặt dây chuyền', 'amulet', 'necklace'] },
    { key: 'ring', label: 'Chiếc Nhẫn', aliases: ['chiec nhan', 'chiếc nhẫn', 'ring'] },
    { key: 'skull', label: 'Đầu Lâu', aliases: ['dau lau', 'đầu lâu', 'skull'] },
    { key: 'spear', label: 'Cây Giáo', aliases: ['cay giao', 'cây giáo', 'spear'] },
    { key: 'ouija', label: 'Bảng Cầu Cơ', aliases: ['bang cau co', 'bảng cầu cơ', 'ouija'] },
];

function normalizeText(text) {
    return (text || '')
        .toString()
        .trim()
        .toLowerCase()
        // Strip Vietnamese diacritics
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        // Normalize whitespace
        .replace(/\s+/g, ' ');
}

function getOmenLabel(omenKey) {
    return OMEN_DEFS.find((o) => o.key === omenKey)?.label || '';
}

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

    const rows = REFERENCE_ROWS.map((r) => {
        const roomKey = normalizeText(r.room);
        return `
            <tr data-room="${roomKey}">
                <th scope="row">${r.room}</th>
                <td data-omen="bite">${r.bite}</td>
                <td data-omen="book">${r.book}</td>
                <td data-omen="orb">${r.orb}</td>
                <td data-omen="dog">${r.dog}</td>
                <td data-omen="girl">${r.girl}</td>
                <td data-omen="cross">${r.cross}</td>
                <td data-omen="wood">${r.wood}</td>
                <td data-omen="mask">${r.mask}</td>
                <td data-omen="amulet">${r.amulet}</td>
                <td data-omen="ring">${r.ring}</td>
                <td data-omen="skull">${r.skull}</td>
                <td data-omen="spear">${r.spear}</td>
                <td data-omen="ouija">${r.ouija}</td>
            </tr>
        `.trim();
    }).join('');

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

function renderSearchControls() {
    const omenOptions = OMEN_DEFS
        .map((o) => `<option value="${o.key}">${o.label}</option>`)
        .join('');

    return `
        <div class="reference-search">
            <div class="reference-search__fields">
                <label class="field">
                    <span class="field__label">Room</span>
                    <input class="field__input" type="text" inputmode="search" placeholder="e.g. Nhà Bếp" data-field="room" autocomplete="off" />
                </label>
                <label class="field">
                    <span class="field__label">Omen</span>
                    <select class="field__input" data-field="omen">
                        <option value="">Select an omen</option>
                        ${omenOptions}
                    </select>
                </label>
            </div>
            <div class="reference-search__result" data-role="result" aria-live="polite"></div>
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

                ${renderSearchControls()}

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

    const roomInput = mountEl.querySelector('[data-field="room"]');
    const omenSelect = mountEl.querySelector('[data-field="omen"]');
    const resultEl = mountEl.querySelector('[data-role="result"]');
    const table = mountEl.querySelector('.reference-table');
    const tableScroll = mountEl.querySelector('.table-scroll');

    if (!roomInput || !omenSelect || !resultEl || !table || !tableScroll) return;
    if (!(omenSelect instanceof HTMLSelectElement)) return;

    const rows = Array.from(table.querySelectorAll('tbody tr'));
    const headerCells = Array.from(table.querySelectorAll('thead th'));

    function scrollToOmenColumn(omenKey) {
        if (!omenKey) return;

        const omenIndex = OMEN_DEFS.findIndex((o) => o.key === omenKey);
        if (omenIndex < 0) return;

        // Header: first th is "Tên phòng", so omen columns start at index 1
        const targetHeader = headerCells[omenIndex + 1];
        const stickyHeader = headerCells[0];
        if (!targetHeader || !stickyHeader) return;

        // Wait a frame so DOM/layout is updated after filtering/highlighting
        window.requestAnimationFrame(() => {
            const scrollRect = tableScroll.getBoundingClientRect();
            const targetRect = targetHeader.getBoundingClientRect();
            const stickyWidth = stickyHeader.getBoundingClientRect().width;

            // Align the start of the target column to the start of the scroll viewport,
            // right after the sticky first column.
            const desiredScrollLeft =
                tableScroll.scrollLeft + (targetRect.left - scrollRect.left) - stickyWidth;

            tableScroll.scrollTo({ left: Math.max(0, desiredScrollLeft), behavior: 'smooth' });
        });
    }

    function clearOmenHighlight() {
        table.querySelectorAll('[data-omen].is-highlight').forEach((el) => el.classList.remove('is-highlight'));
        table.querySelectorAll('thead th.is-highlight').forEach((el) => el.classList.remove('is-highlight'));
    }

    function highlightOmenColumn(omenKey) {
        clearOmenHighlight();
        if (!omenKey) return;

        // Header: first th is "Tên phòng", so omen columns start at index 1
        const omenIndex = OMEN_DEFS.findIndex((o) => o.key === omenKey);
        const th = headerCells[omenIndex + 1];
        th?.classList.add('is-highlight');

        for (const row of rows) {
            row.querySelector(`[data-omen="${omenKey}"]`)?.classList.add('is-highlight');
        }
    }

    function getVisibleRows() {
        return rows.filter((r) => r.style.display !== 'none');
    }

    function updateResult(roomQuery, omenKey) {
        const roomQ = normalizeText(roomQuery);

        highlightOmenColumn(omenKey);
        scrollToOmenColumn(omenKey);

        const visible = getVisibleRows();

        if (!roomQ && !omenKey) {
            resultEl.textContent = '';
            return;
        }

        if (!visible.length) {
            resultEl.textContent = 'No matching room found.';
            return;
        }

        if (omenKey && visible.length === 1) {
            const roomName = visible[0].querySelector('th[scope="row"]')?.textContent?.trim() || 'Room';
            const omenLabel = getOmenLabel(omenKey) || 'Omen';
            const value = visible[0].querySelector(`[data-omen="${omenKey}"]`)?.textContent?.trim() || '-';
            resultEl.textContent = `${roomName} • ${omenLabel}: ${value}`;
            return;
        }

        if (omenKey && visible.length > 1) {
            const omenLabel = getOmenLabel(omenKey) || 'Omen';
            resultEl.textContent = `${visible.length} rooms matched • column highlighted: ${omenLabel}`;
            return;
        }

        resultEl.textContent = `${visible.length} rooms matched.`;
    }

    function applyRoomFilter(roomQuery) {
        const roomQ = normalizeText(roomQuery);
        for (const row of rows) {
            if (!roomQ) {
                row.style.display = '';
                continue;
            }
            const key = row.getAttribute('data-room') || '';
            row.style.display = key.includes(roomQ) ? '' : 'none';
        }
    }

    function onSearchChanged() {
        const roomQuery = roomInput.value;
        const omenKey = omenSelect.value;

        applyRoomFilter(roomQuery);
        updateResult(roomQuery, omenKey);
    }

    roomInput.addEventListener('input', onSearchChanged);
    omenSelect.addEventListener('change', onSearchChanged);
}


