import { getTraitorDescriptionByHauntNumber } from '../data/traitorsTomeTraitorMap.js';
import { OMEN_DEFS, REFERENCE_ROWS } from '../data/traitorsTomeReferenceTableData.js';

const ROOM_NAME_EN_MAP = {
    'Căn Phòng Bỏ Hoang': 'Abandoned Room',
    'Ban Công': 'Balcony',
    'Hầm Mộ': 'Catacombs',
    'Căn Phòng Bị Cháy': 'Charred Room',
    'Phòng Ăn': 'Dining Room',
    'Lò Than': 'Furnace Room',
    'Khán Đài': 'Gallery',
    'Phòng Thể Dục': 'Gymnasium',
    'Căn Phòng Bùa Bỡn': 'Junk Room',
    'Nhà Bếp': 'Kitchen',
    'Phòng Ngủ Chính': 'Master Bedroom',
    'Căn Buồng Hình Sao': 'Pentagram Chamber',
    'Phòng Gia Nhân': 'Servants Quarters',
};

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

function renderRoomDisplayName(roomVi) {
    const roomEn = ROOM_NAME_EN_MAP[roomVi];
    if (!roomEn) return roomVi;
    return `${roomVi} <span class="room-name__en">(${roomEn})</span>`;
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
        const roomEn = ROOM_NAME_EN_MAP[r.room] || '';
        const roomKey = normalizeText(`${r.room} ${roomEn}`);
        return `
            <tr data-room="${roomKey}">
                <th scope="row">${renderRoomDisplayName(r.room)}</th>
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
            <div class="table-scroll__body" role="region" aria-label="Traitors Tome reference table">
                <table class="reference-table">
                    ${thead}
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
            <div class="table-scroll__footer">
                <button class="link-button" type="button" data-action="back">BACK</button>
            </div>
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
            <div class="welcome-content welcome-content--page welcome-content--has-bottom-gap">
                <p class="welcome-kicker">TRAITORS TOME</p>
                <h2 class="page-title">BẢNG TRA</h2>
                <p class="page-subtitle">Bảng tham chiếu để tra cứu theo phòng.</p>

                ${renderSearchControls()}

                ${renderReferenceTable()}
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
    const tableScroll = mountEl.querySelector('.table-scroll__body');

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
            const hauntNumber = Number(value);
            const traitorDesc = getTraitorDescriptionByHauntNumber(hauntNumber);

            const lines = [
                Number.isFinite(hauntNumber) ? `Chuyện ma: Trang ${hauntNumber}` : 'Chuyện ma: -',
                `KẺ PHẢN BỘI: ${traitorDesc ?? 'Không rõ'}`,
            ];

            resultEl.textContent = lines.join('\n');
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


