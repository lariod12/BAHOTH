import { TRANSLATION_SECTIONS } from '../data/rulesBookVietnameseEnglishTableData.js';

function escapeHtml(raw) {
    return (raw ?? '')
        .toString()
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function renderMultilineText(raw) {
    return escapeHtml(raw).replaceAll('\n', '<br />');
}

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

function getSectionColumns(section) {
    const columns = Array.isArray(section.columns) ? section.columns : null;
    if (columns && columns.length >= 2) return columns;
    return ['Vietnamese', 'English'];
}

function renderSectionHeaderRow(section) {
    const columns = getSectionColumns(section);
    const ths = columns.map((c) => `<th scope="col">${escapeHtml(c)}</th>`).join('');
    return `<tr>${ths}</tr>`;
}

function renderTranslationTableRows(section) {
    const columns = getSectionColumns(section);
    const isThreeCol = columns.length >= 3;

    return (section.entries || [])
        .map((entry) => {
            if (isThreeCol) {
                return `
                    <tr>
                        <td class="translation-table__cell translation-table__cell--en" data-role="en">${escapeHtml(entry.en)}</td>
                        <td class="translation-table__cell translation-table__cell--vi" data-role="vi">${escapeHtml(entry.vi)}</td>
                        <td class="translation-table__cell translation-table__cell--desc" data-role="desc">${renderMultilineText(entry.desc)}</td>
                    </tr>
                `.trim();
            }

            return `
                <tr>
                    <td class="translation-table__cell translation-table__cell--vi" data-role="vi">${escapeHtml(entry.vi)}</td>
                    <td class="translation-table__cell translation-table__cell--en" data-role="en">${escapeHtml(entry.en)}</td>
                </tr>
            `.trim();
        })
        .join('');
}

function renderTranslationSection(section) {
    const headerRow = renderSectionHeaderRow(section);
    const rows = renderTranslationTableRows(section);

    return `
        <section class="translation-card" aria-label="${escapeHtml(section.title)}">
            <h3 class="translation-card__title">${escapeHtml(section.title)}</h3>
            <div class="translation-card__body">
                <table class="translation-table">
                    <thead>
                        ${headerRow}
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        </section>
    `.trim();
}

function renderRulesBookReferenceMarkup() {
    const sections = TRANSLATION_SECTIONS.map(renderTranslationSection).join('');

    return `
        <div class="welcome-container">
            <div class="welcome-content welcome-content--page welcome-content--has-bottom-gap">
                <p class="welcome-kicker">RULESBOOK</p>
                <h2 class="page-title">BẢNG ĐỐI CHIẾU VIỆT–ANH</h2>
                <p class="page-subtitle">Tra nhanh thuật ngữ trong game theo 2 ngôn ngữ.</p>

                <div class="reference-search">
                    <div class="reference-search__fields">
                        <label class="field">
                            <span class="field__label">Search</span>
                            <input
                                class="field__input"
                                type="text"
                                inputmode="search"
                                placeholder="Search Vietnamese or English..."
                                data-field="search"
                                autocomplete="off"
                            />
                        </label>
                    </div>
                    <div class="reference-search__result" data-role="result" aria-live="polite"></div>
                </div>

                <div class="translation-scroll">
                    <div class="translation-scroll__body">
                        <div class="translation-grid">
                            ${sections}
                        </div>
                    </div>
                    <div class="translation-scroll__footer">
                        <button class="link-button" type="button" data-action="back">BACK</button>
                    </div>
                </div>
            </div>
        </div>
    `.trim();
}

export function renderRulesBookReferenceView({ mountEl, onNavigate }) {
    mountEl.innerHTML = renderRulesBookReferenceMarkup();

    const backButton = mountEl.querySelector('[data-action="back"]');
    backButton?.addEventListener('click', () => onNavigate('#/tutorial'));

    const searchInput = mountEl.querySelector('[data-field="search"]');
    const resultEl = mountEl.querySelector('[data-role="result"]');
    if (!searchInput || !resultEl) return;
    if (!(searchInput instanceof HTMLInputElement)) return;

    const cards = Array.from(mountEl.querySelectorAll('.translation-card'));
    const rows = Array.from(mountEl.querySelectorAll('.translation-card tbody tr'));
    const rowsByCard = new Map();

    for (const card of cards) {
        rowsByCard.set(card, Array.from(card.querySelectorAll('tbody tr')));
    }

    // Precompute search text for each row: Vietnamese + English.
    for (const row of rows) {
        const vi = row.querySelector('[data-role="vi"]')?.textContent || '';
        const en = row.querySelector('[data-role="en"]')?.textContent || '';
        const desc = row.querySelector('[data-role="desc"]')?.textContent || '';
        row.dataset.search = normalizeText(`${vi} ${en} ${desc}`);
    }

    function applySearchFilter(rawQuery) {
        const query = normalizeText(rawQuery);

        if (!query) {
            for (const row of rows) row.style.display = '';
            for (const card of cards) card.style.display = '';
            resultEl.textContent = '';
            return;
        }

        let matchedRows = 0;

        for (const row of rows) {
            const haystack = row.dataset.search || '';
            const isMatch = haystack.includes(query);
            row.style.display = isMatch ? '' : 'none';
            if (isMatch) matchedRows += 1;
        }

        for (const card of cards) {
            const cardRows = rowsByCard.get(card) || [];
            const hasVisibleRow = cardRows.some((r) => r.style.display !== 'none');
            card.style.display = hasVisibleRow ? '' : 'none';
        }

        resultEl.textContent = `${matchedRows} matches.`;
    }

    searchInput.addEventListener('input', () => applySearchFilter(searchInput.value));
}


