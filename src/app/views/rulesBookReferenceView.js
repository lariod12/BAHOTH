import { TRANSLATION_SECTIONS } from '../data/rulesBookVietnameseEnglishTableData.js';
import { marked } from 'marked';
import rulesContent from '../../../boardgame_rules.md?raw';

// Custom renderer to add IDs to headings for TOC navigation
const renderer = {
    heading(token) {
        const text = token.text || '';
        const lower = text.toLowerCase();
        // Custom slugify to match the TOC links in rules.md
        const id = lower
            .replace(/[^\w\s\u00C0-\u1EF9]/g, '')
            .replace(/\s+/g, '-');

        // Add header to search index
        searchIndex.push({ id, text: text });

        return `
            <h${token.depth} id="${id}">
                ${text}
            </h${token.depth}>`;
    },
    paragraph(token) {
        const text = token.text || '';
        const id = `rule-p-${ruleParagraphIndex++}`;
        // Strip HTML tags for clean search text
        const cleanText = text.replace(/<[^>]*>/g, '');
        searchIndex.push({ id, text: cleanText });

        // IMPORTANT: We must parse the inline tokens to ensure bold/italic/links work
        // marked's renderer context has access to the parser
        const inlineHtml = this.parser.parseInline(token.tokens);

        return `<p id="${id}">${inlineHtml}</p>`;
    }
};

marked.use({ renderer });

let activeTab = 'rules'; // 'rules' | 'reference'
let searchIndex = [];
let ruleParagraphIndex = 0;

export function renderRulesBookReferenceView({ mountEl, onNavigate }) {
    // Reset index on each render to avoid duplicates if re-rendering purely
    // Note: If we caching the parsed HTML, we should also cache the index.
    // For now, we rebuild it.
    searchIndex = [];
    ruleParagraphIndex = 0;

    // We need to parse ONLY if we are re-rendering the HTML content, 
    // but the function `renderRulesBookReferenceMarkup` is called every render.
    // So we just let it rebuild. It's fast enough.

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

    // TOC Navigation and Container Click Handling for Rules Tab
    if (activeTab === 'rules') {
        const rulesContainer = mountEl.querySelector('.rules-markdown-container');
        const searchInput = mountEl.querySelector('[data-field="rules-search"]');
        const searchResults = mountEl.querySelector('[data-role="rules-search-result"]');

        if (rulesContainer) {
            rulesContainer.addEventListener('click', (event) => {
                const link = event.target.closest('a');
                if (link) {
                    const href = link.getAttribute('href');
                    if (href && href.startsWith('#')) {
                        event.preventDefault();
                        const targetId = decodeURIComponent(href.substring(1));
                        const targetElement = document.getElementById(targetId);

                        if (targetElement) {
                            const containerRect = rulesContainer.getBoundingClientRect();
                            const targetRect = targetElement.getBoundingClientRect();
                            const offset = targetRect.top - containerRect.top + rulesContainer.scrollTop - 20;

                            rulesContainer.scrollTo({
                                top: offset,
                                behavior: 'smooth'
                            });
                        }
                    }
                }
            });
        }

        // Rules Search Logic
        if (searchInput && searchResults) {
            searchInput.addEventListener('input', (e) => {
                const query = normalizeText(e.target.value);
                if (!query || query.length < 2) {
                    searchResults.innerHTML = '';
                    searchResults.style.display = 'none';
                    return;
                }

                const matches = searchIndex.filter(item => normalizeText(item.text).includes(query));

                if (matches.length === 0) {
                    searchResults.innerHTML = '<div class="search-item">No results found</div>';
                    searchResults.style.display = 'block';
                    return;
                }

                const resultsHtml = matches.slice(0, 10).map(item => {
                    const text = item.text;
                    const normalizedText = normalizeText(text);
                    const matchIndex = normalizedText.indexOf(query);

                    // Create a snippet around the match
                    let snippet = text;
                    if (text.length > 60) {
                        const start = Math.max(0, matchIndex - 20);
                        const end = Math.min(text.length, matchIndex + 40);
                        snippet = (start > 0 ? '...' : '') + text.substring(start, end) + (end < text.length ? '...' : '');
                    }

                    // Highlight the query in the snippet
                    // Escape special regex chars in query
                    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    // We need to match roughly based on the TOC links in rules.md
                    // This is tricky with normalization (e.g. accents). 
                    // Simplest approach: simple regex match if possible, or just highlight the exact string if accents match.
                    // Given 'normalizeText' removes accents, exact regex match on original text might fail if user typed sans-accent.
                    // For now, let's do a case-insensitive regex match on the original text snippet using the user's raw input if it matches,
                    // or fallback to just bolding the matching section if we can identify it.

                    // Better approach for VN text: 
                    // 1. Find the index again in the snippet (re-calculating relative to snippet start)
                    // 2. Wrap that range. 
                    // However, 'normalizeText' removes accents, so indices might shift if characters are composed/decomposed, 
                    // though usually it just strips marks.

                    // ALTERNATIVE: Use the input value directly for highlighting if checking against original text?
                    // But we filtered based on normalized text.

                    // Workaround: We will just bold/highlight the snippet without exact query matching styling 
                    // OR we try to match the visible text. 
                    // Let's rely on the fact that usually users type mostly matching accents or we accept imperfect highlighting.
                    // But specific request is "highlight word being searched".

                    // Let's try to construct a Regex that matches the characters roughly.
                    // Or simply: just highlight the snippet part since we trimmed it around the match.

                    // Let's try to find the match index in the snippet using normalized version of snippet.
                    const normSnippet = normalizeText(snippet);
                    const matchStartInSnippet = normSnippet.indexOf(query);

                    let finalHtml = escapeHtml(snippet); // Default escaped

                    if (matchStartInSnippet !== -1) {
                        const originalMatchStr = snippet.substr(matchStartInSnippet, query.length);
                        // Note: This substring length assumes normalized length == original length. 
                        // This is mostly true for VN (removing accents doesn't change char count usually, e.g. 'á' -> 'a').

                        const before = snippet.substring(0, matchStartInSnippet);
                        const match = snippet.substring(matchStartInSnippet, matchStartInSnippet + query.length);
                        const after = snippet.substring(matchStartInSnippet + query.length);

                        finalHtml = `${escapeHtml(before)}<span class="highlight">${escapeHtml(match)}</span>${escapeHtml(after)}`;
                    }

                    return `
                        <div class="search-item" data-target-id="${item.id}">
                            ${finalHtml}
                        </div>
                    `;
                }).join('');

                searchResults.innerHTML = resultsHtml;
                searchResults.style.display = 'block';
            });

            // Handle clicking on search results
            searchResults.addEventListener('click', (e) => {
                const item = e.target.closest('.search-item');
                if (item && item.dataset.targetId) {
                    const targetId = item.dataset.targetId;
                    const targetElement = document.getElementById(targetId);

                    if (targetElement && rulesContainer) {
                        const containerRect = rulesContainer.getBoundingClientRect();
                        const targetRect = targetElement.getBoundingClientRect();
                        const offset = targetRect.top - containerRect.top + rulesContainer.scrollTop - 50; // More padding for header

                        rulesContainer.scrollTo({
                            top: offset,
                            behavior: 'smooth'
                        });

                        // Visual feedback
                        targetElement.style.transition = 'background 0.5s';
                        targetElement.style.backgroundColor = 'rgba(255, 255, 0, 0.3)';
                        setTimeout(() => {
                            targetElement.style.backgroundColor = 'transparent';
                        }, 2000);

                        // Clear search
                        searchResults.style.display = 'none';
                        searchInput.value = '';
                    }
                }
            });

            // Hide search results when clicking outside
            document.addEventListener('click', (e) => {
                if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
                    searchResults.style.display = 'none';
                }
            });
        }
    }

    // Reference Table Search
    if (activeTab === 'reference') {
        const searchInput = mountEl.querySelector('[data-field="search"]');
        const resultsContainer = mountEl.querySelector('[data-role="result"]');

        if (searchInput) {
            searchInput.focus();
            searchInput.addEventListener('input', (event) => {
                const query = normalizeText(event.target.value);
                const translationGrid = mountEl.querySelector('.translation-grid');

                if (!query) {
                    resultsContainer.innerHTML = '';
                    translationGrid.querySelectorAll('.translation-section').forEach(el => el.style.display = 'block');
                    translationGrid.querySelectorAll('.translation-row').forEach(el => el.style.display = 'table-row');
                    return;
                }

                let hasResult = false;
                translationGrid.querySelectorAll('.translation-section').forEach(sectionEl => {
                    const rows = sectionEl.querySelectorAll('.translation-row');
                    let sectionHasMatch = false;
                    rows.forEach(row => {
                        const vi = normalizeText(row.querySelector('td:nth-child(1)').textContent);
                        const en = normalizeText(row.querySelector('td:nth-child(2)').textContent);
                        if (vi.includes(query) || en.includes(query)) {
                            row.style.display = 'table-row';
                            sectionHasMatch = true;
                            hasResult = true;
                        } else {
                            row.style.display = 'none';
                        }
                    });

                    if (sectionHasMatch) {
                        sectionEl.style.display = 'block';
                    } else {
                        sectionEl.style.display = 'none';
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
        const parsedRules = marked.parse(rulesContent);
        content = `
            <div class="rules-search-container">
                <input 
                    type="text" 
                    class="rules-search-input" 
                    placeholder="Search in rules..." 
                    data-field="rules-search"
                />
                <div class="rules-search-results" data-role="rules-search-result" style="display: none;"></div>
            </div>
            <div class="rules-markdown-container">
                ${parsedRules}
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
                
                <div class="tab-content" style="position: relative;">
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
                margin-bottom: 1rem;
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
            .rules-search-container {
                margin-bottom: 1rem;
                position: relative;
            }
            .rules-search-input {
                width: 100%;
                padding: 0.8rem;
                background: rgba(0,0,0,0.3);
                border: 1px solid rgba(255,255,255,0.2);
                border-radius: 4px;
                color: white;
                font-family: inherit;
            }
            .rules-search-results {
                position: absolute;
                top: 100%;
                left: 0;
                right: 0;
                background: #1a1a1a;
                border: 1px solid #333;
                max-height: 300px;
                overflow-y: auto;
                z-index: 10;
                box-shadow: 0 4px 6px rgba(0,0,0,0.3);
            }
            .search-item {
                padding: 0.8rem;
                cursor: pointer;
                border-bottom: 1px solid #333;
                color: #ddd;
                font-size: 0.9em;
            }
            .search-item:hover {
                background: #333;
            }
            .highlight {
                background-color: #ffd700;
                color: #000;
                font-weight: bold;
                border-radius: 2px;
                padding: 0 2px;
            }
            .rules-markdown-container {
                text-align: left;
                padding: 1rem;
                background: rgba(0,0,0,0.2);
                border-radius: 8px;
                max-height: 55vh;
                overflow-y: auto;
                color: #ddd;
                position: relative;
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
