import { TRANSLATION_SECTIONS } from '../data/rulesBookVietnameseEnglishTableData.js';
import { marked } from 'marked';
import rulesContent from '../../../rules.md?raw';

let activeTab = 'rules'; // 'rules' | 'reference'

export function renderRulesBookReferenceView({ mountEl, onNavigate }) {
    const render = () => {
        mountEl.innerHTML = renderRulesBookReferenceMarkup(activeTab);
        attachEventListeners({ mountEl, onNavigate, render });
    };

    render();
}

function attachEventListeners({ mountEl, onNavigate, render }) {
    const backButton = mountEl.querySelector('[data-action="back"]');
    backButton?.addEventListener('click', () => onNavigate('#/tutorial'));

    // Tab Interface
    const tabButtons = mountEl.querySelectorAll('.tab-button');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const newTab = e.target.dataset.tab;
            if (activeTab !== newTab) {
                activeTab = newTab;
                render();
            }
        });
    });

    // Detailed search functionality for Reference Table
    if (activeTab === 'reference') {
        const searchInput = mountEl.querySelector('[data-field="search"]');
        const resultsContainer = mountEl.querySelector('[data-role="result"]');

        if (searchInput) {
            searchInput.focus();

            searchInput.addEventListener('input', (event) => {
                const query = normalizeText(event.target.value);
                if (!query) {
                    resultsContainer.innerHTML = '';
                    // Show all sections again
                    mountEl.querySelectorAll('.translation-section').forEach(el => el.style.display = 'block');
                    return;
                }

                const matches = [];
                mountEl.querySelectorAll('.translation-section').forEach(section => {
                    section.style.display = 'none'; // Hide all initially
                });

                // Simple search logic - could be optimized
                TRANSLATION_SECTIONS.forEach(section => {
                    const matchedEntries = section.entries.filter(entry => {
                        return normalizeText(entry.vi).includes(query) || normalizeText(entry.en).includes(query);
                    });

                    if (matchedEntries.length > 0) {
                        matches.push({ ...section, entries: matchedEntries });
                    }
                });

                // Note: For a simpler implementation, we might just filter visually if the lists are small,
                // but re-rendering the filtered list is cleaner for the results container.
                // However, the original code might have had a specific way.
                // Let's stick to a simple visual filter of the existing DOM if possible, or re-render sections.

                // Re-rendering filtered sections into the result container or main grid:
                // Actually, let's just show/hide the sections in the main grid and filter rows.

                // Reset display
                mountEl.querySelectorAll('.translation-section').forEach(el => el.style.display = 'none');
                mountEl.querySelectorAll('.translation-row').forEach(el => el.style.display = 'none');

                let hasResult = false;
                // Loop through DOM for filtering
                mountEl.querySelectorAll('.translation-section').forEach(sectionEl => {
                    const rows = sectionEl.querySelectorAll('.translation-row');
                    let sectionHasMatch = false;
                    rows.forEach(row => {
                        const vi = normalizeText(row.querySelector('td:nth-child(1)').textContent);
                        const en = normalizeText(row.querySelector('td:nth-child(2)').textContent);
                        if (vi.includes(query) || en.includes(query)) {
                            row.style.display = 'table-row';
                            sectionHasMatch = true;
                            hasResult = true;
                        }
                    });
                    if (sectionHasMatch) {
                        sectionEl.style.display = 'block';
                    }
                });

                resultsContainer.textContent = hasResult ? '' : 'No matches found';
            });
        }
    }
}

function renderRulesBookReferenceMarkup(currentTab) {
    let content = '';

    if (currentTab === 'rules') {
        content = `
            <div class="rules-markdown-container">
                ${marked.parse(rulesContent)}
            </div>
        `;
    } else {
        const sections = TRANSLATION_SECTIONS.map(renderTranslationSection).join('');
        content = `
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
            </div>
        `;
    }

    return `
        <div class="welcome-container">
            <div class="welcome-content welcome-content--page welcome-content--has-bottom-gap">
                <p class="welcome-kicker">RULESBOOK</p>
                <div class="tabs-header">
                    <button class="tab-button ${currentTab === 'rules' ? 'active' : ''}" data-tab="rules">Rules</button>
                    <button class="tab-button ${currentTab === 'reference' ? 'active' : ''}" data-tab="reference">Reference Table</button>
                </div>
                
                <div class="tab-content">
                    ${content}
                </div>

                <div class="translation-scroll__footer">
                    <button class="link-button" type="button" data-action="back">BACK</button>
                </div>
            </div>
        </div>
        <style>
            .tabs-header {
                display: flex;
                gap: 1rem;
                margin-bottom: 1.5rem;
                border-bottom: 2px solid rgba(255,255,255,0.1);
            }
            .tab-button {
                background: none;
                border: none;
                color: rgba(255,255,255,0.6);
                padding: 0.5rem 1rem;
                font-size: 1.2rem;
                cursor: pointer;
                border-bottom: 2px solid transparent;
                margin-bottom: -2px;
                font-family: inherit;
            }
            .tab-button.active {
                color: #fff;
                border-bottom-color: #fff;
            }
            .tab-button:hover {
                color: #fff;
            }
            .rules-markdown-container {
                text-align: left;
                padding: 1rem;
                background: rgba(0,0,0,0.2);
                border-radius: 8px;
                max-height: 60vh;
                overflow-y: auto;
                color: #ddd;
            }
            .rules-markdown-container h1, .rules-markdown-container h2, .rules-markdown-container h3 {
                color: #fff;
                margin-top: 1.5em;
            }
            .rules-markdown-container h1:first-child {
                margin-top: 0;
            }
            .rules-markdown-container ul, .rules-markdown-container ol {
                padding-left: 1.5em;
            }
            .rules-markdown-container li {
                margin-bottom: 0.5em;
            }
            .rules-markdown-container strong {
                color: #fff;
            }
            .rules-markdown-container p {
                line-height: 1.6;
                margin-bottom: 1em;
            }
        </style>
    `.trim();
}

function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function renderMultilineText(text) {
    if (!text) return '';
    return escapeHtml(text).replace(/\n/g, '<br/>');
}

function normalizeText(text) {
    return text.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function getSectionColumns(section) {
    // Determine number of functional columns based on first entry
    // All entries in a section usually have the same structure
    const firstEntry = section.entries[0];
    let cols = 0;
    if (firstEntry.vi) cols++;
    if (firstEntry.en) cols++;
    if (firstEntry.desc) cols++;
    if (firstEntry.effect) cols++; // For room-functions
    return cols;
}

function renderSectionHeaderRow(section) {
    // Custom header logic based on known section types if needed, 
    // or generic based on keys.
    // For now, let's hardcode based on section ID for better presentation or infer.

    let headers = '';
    if (section.id === 'room-functions') {
        headers = `
            <th>Phòng (Vietnamese)</th>
            <th>Room (English)</th>
            <th>Effect</th>
        `;
    } else {
        headers = `
            <th>Vietnamese</th>
            <th>English</th>
            ${section.entries[0]?.desc ? '<th>Description</th>' : ''}
        `;
    }

    return `
        <thead>
            <tr>
                ${headers}
            </tr>
        </thead>
    `;
}

function renderTranslationTableRows(section) {
    return section.entries.map(entry => {
        let cells = `
            <td>${renderMultilineText(entry.vi)}</td>
            <td>${renderMultilineText(entry.en)}</td>
        `;

        if (entry.desc) {
            cells += `<td>${renderMultilineText(entry.desc)}</td>`;
        }

        // Specific case for room-functions or if we want to handle 'effect' generally
        if (entry.effect) {
            cells += `<td>${renderMultilineText(entry.effect)}</td>`;
        }

        return `<tr class="translation-row">${cells}</tr>`;
    }).join('');
}

function renderTranslationSection(section) {
    return `
        <div class="translation-section" data-section-id="${section.id}">
            <h3 class="translation-section__title">${escapeHtml(section.title)}</h3>
            <div class="translation-table-wrapper">
                <table class="translation-table">
                    ${renderSectionHeaderRow(section)}
                    <tbody>
                        ${renderTranslationTableRows(section)}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}
