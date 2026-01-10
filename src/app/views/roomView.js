import { CHARACTERS, CHARACTER_BY_ID } from '../data/charactersData.js';

const MOCK_ROOM_ID = 'BAH-123456';
const MOCK_MIN_PLAYERS = 3;
const MOCK_MAX_PLAYERS = 6;

/**
 * Get a short description for a character (first sentence of VI info, or fallback).
 * @param {import('../data/charactersData.js').CharacterDef} char
 * @returns {string}
 */
function getCharacterShortDesc(char) {
    const info = char.profile?.vi?.info || char.profile?.en?.info || '';
    // Take first sentence (up to first period followed by space or end)
    const firstSentence = info.split(/\.\s/)[0];
    if (firstSentence && firstSentence.length > 0) {
        // Limit length for card display
        const maxLen = 60;
        if (firstSentence.length > maxLen) {
            return firstSentence.slice(0, maxLen).trim() + '...';
        }
        return firstSentence + '.';
    }
    return 'Nhân vật trong Betrayal at House on the Hill.';
}

/**
 * Render a single character card.
 * @param {import('../data/charactersData.js').CharacterDef} char
 * @param {{ isSelected?: boolean; isTaken?: boolean }} options
 * @returns {string}
 */
function renderCharacterCard(char, { isSelected = false, isTaken = false } = {}) {
    const name = char.name.vi || char.name.nickname || char.name.en;
    const desc = getCharacterShortDesc(char);

    let stateClass = '';
    let badgeClass = 'badge--muted';
    let badgeText = 'Có sẵn';

    if (isTaken) {
        stateClass = 'is-taken';
        badgeText = 'Đã chọn';
    } else if (isSelected) {
        stateClass = 'is-selected';
        badgeClass = 'badge--accent';
        badgeText = 'Đang chọn';
    }

    return `
        <div class="character-card ${stateClass}" data-character="${char.id}">
            <div class="character-card__header">
                <span class="character-name">${name}</span>
                <span class="badge ${badgeClass}">${badgeText}</span>
            </div>
            <p class="character-note">${desc}</p>
            <button class="character-info-btn" type="button" data-action="view-character" data-character-id="${char.id}">
                Xem chi tiết
            </button>
        </div>
    `.trim();
}

/**
 * Render all character cards.
 * For demo purposes, first character is selected, fourth is taken.
 * @returns {string}
 */
function renderCharacterCards() {
    return CHARACTERS.map((char, index) => {
        // Demo: index 0 = selected, index 3 = taken by another player
        const isSelected = index === 0;
        const isTaken = index === 3;
        return renderCharacterCard(char, { isSelected, isTaken });
    }).join('\n');
}

/**
 * Render the character detail modal markup.
 * @returns {string}
 */
function renderCharacterModal() {
    return `
        <div class="character-modal" id="character-modal" aria-hidden="true">
            <div class="character-modal__backdrop" data-action="close-modal"></div>
            <div class="character-modal__content" role="dialog" aria-modal="true" aria-labelledby="modal-title">
                <header class="character-modal__header">
                    <h2 class="character-modal__title" id="modal-title"></h2>
                    <button class="character-modal__close" type="button" data-action="close-modal" aria-label="Đóng">
                        &times;
                    </button>
                </header>
                <div class="character-modal__body" id="modal-body">
                    <!-- Dynamic content inserted here -->
                </div>
            </div>
        </div>
    `.trim();
}

/**
 * Render character detail content for modal.
 * @param {import('../data/charactersData.js').CharacterDef} char
 * @returns {string}
 */
function renderCharacterDetail(char) {
    const bio = char.bio.vi;
    const profile = char.profile?.vi || char.profile?.en || {};

    const hobbies = bio.hobbies?.join(', ') || 'Không rõ';
    const fear = profile.fear || 'Không rõ';
    const info = profile.info || '';

    // Build traits display
    const traitLabels = {
        speed: 'Tốc độ',
        might: 'Sức mạnh',
        sanity: 'Tâm trí',
        knowledge: 'Kiến thức',
    };

    const traitsHtml = Object.entries(char.traits)
        .map(([key, trait]) => {
            const label = traitLabels[key] || key;
            // Render track with start index highlighted in green
            const trackHtml = trait.track
                .map((val, idx) => {
                    if (idx === trait.startIndex) {
                        return `<span class="trait-value trait-value--start">${val}</span>`;
                    }
                    return `<span class="trait-value">${val}</span>`;
                })
                .join('<span class="trait-sep"> - </span>');
            return `
                <div class="trait-row">
                    <span class="trait-label">${label}</span>
                    <span class="trait-track">${trackHtml}</span>
                </div>
            `;
        })
        .join('');

    return `
        <div class="character-detail">
            <div class="character-detail__bio">
                <div class="detail-row">
                    <span class="detail-label">Tuổi:</span>
                    <span class="detail-value">${bio.age}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Chiều cao:</span>
                    <span class="detail-value">${bio.height}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Cân nặng:</span>
                    <span class="detail-value">${bio.weight}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Sinh nhật:</span>
                    <span class="detail-value">${bio.birthday}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Sở thích:</span>
                    <span class="detail-value">${hobbies}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Nỗi sợ:</span>
                    <span class="detail-value">${fear}</span>
                </div>
            </div>

            <div class="character-detail__traits">
                <h3 class="detail-section-title">Chỉ số</h3>
                ${traitsHtml}
            </div>

            <div class="character-detail__story">
                <h3 class="detail-section-title">Tiểu sử</h3>
                <p class="detail-info">${info.replace(/\n\n/g, '</p><p class="detail-info">')}</p>
            </div>
        </div>
    `.trim();
}

function renderRoomMarkup({ roomId }) {
    return `
        <div class="welcome-container room-container">
            <div class="room-surface">
                <header class="room-header">
                    <div>
                        <p class="welcome-kicker">Room</p>
                        <h1 class="page-title">Private Lobby</h1>
                        <p class="room-subtitle">Room ID: <span class="room-id">${roomId}</span></p>
                    </div>
                    <div class="room-actions">
                        <button class="chip-button" type="button" data-action="copy-id">Copy ID</button>
                        <button class="chip-button chip-button--ghost" type="button" data-action="leave-room">Leave</button>
                    </div>
                </header>

                <div class="room-grid">
                    <nav class="room-mobile-tabs" aria-label="Room sections">
                        <button class="room-tab is-active" type="button" data-tab="players" aria-pressed="true">Players</button>
                        <button class="room-tab" type="button" data-tab="characters" aria-pressed="false">Characters</button>
                    </nav>

                    <section class="room-panel room-panel--players" data-panel="players">
                        <div class="room-panel__header">
                            <p class="welcome-kicker">Players</p>
                            <p class="room-panel__meta">4 / ${MOCK_MAX_PLAYERS}</p>
                        </div>
                        <div class="players-list">
                            <div class="player-slot is-host">
                                <div class="player-slot__top">
                                    <span class="player-name">You</span>
                                    <span class="badge badge--accent">HOST</span>
                                </div>
                                <div class="player-slot__status">
                                    <span class="badge badge--success">Ready</span>
                                    <span class="player-note">Creator of this room</span>
                                </div>
                            </div>

                            <div class="player-slot">
                                <div class="player-slot__top">
                                    <span class="player-name">Player 2</span>
                                    <span class="badge badge--success">Ready</span>
                                </div>
                                <div class="player-slot__status">
                                    <span class="player-note">Character locked in</span>
                                </div>
                            </div>

                            <div class="player-slot">
                                <div class="player-slot__top">
                                    <span class="player-name">Player 3</span>
                                    <span class="badge badge--muted">Selecting</span>
                                </div>
                                <div class="player-slot__status">
                                    <span class="player-note">Choosing a character...</span>
                                </div>
                            </div>

                            <div class="player-slot">
                                <div class="player-slot__top">
                                    <span class="player-name">Player 4</span>
                                    <span class="badge badge--muted">Not Ready</span>
                                </div>
                                <div class="player-slot__status">
                                    <span class="player-note">Joined the room</span>
                                </div>
                            </div>

                            <div class="player-slot is-waiting">
                                <div class="player-slot__top">
                                    <span class="player-name">Waiting for player...</span>
                                    <span class="badge badge--muted">Slot 2</span>
                                </div>
                                <div class="player-slot__status">
                                    <span class="player-note">Share the Room ID to invite</span>
                                </div>
                            </div>

                            <div class="player-slot is-waiting">
                                <div class="player-slot__top">
                                    <span class="player-name">Waiting for player...</span>
                                    <span class="badge badge--muted">Slot 3</span>
                                </div>
                                <div class="player-slot__status">
                                    <span class="player-note">Min ${MOCK_MIN_PLAYERS} players required</span>
                                </div>
                            </div>

                            <div class="player-slot is-waiting">
                                <div class="player-slot__top">
                                    <span class="player-name">Waiting for player...</span>
                                    <span class="badge badge--muted">Slot 4</span>
                                </div>
                                <div class="player-slot__status">
                                    <span class="player-note">Slots remain open</span>
                                </div>
                            </div>

                            <div class="player-slot is-waiting">
                                <div class="player-slot__top">
                                    <span class="player-name">Waiting for player...</span>
                                    <span class="badge badge--muted">Slot 5</span>
                                </div>
                                <div class="player-slot__status">
                                    <span class="player-note">Up to ${MOCK_MAX_PLAYERS} players</span>
                                </div>
                            </div>

                            <div class="player-slot is-waiting">
                                <div class="player-slot__top">
                                    <span class="player-name">Waiting for player...</span>
                                    <span class="badge badge--muted">Slot 6</span>
                                </div>
                                <div class="player-slot__status">
                                    <span class="player-note">Invite link or Room ID</span>
                                </div>
                            </div>
                        </div>
                        <p class="room-hint">Min ${MOCK_MIN_PLAYERS} players to start · Max ${MOCK_MAX_PLAYERS} players</p>
                    </section>

                    <section class="room-panel room-panel--characters" data-panel="characters">
                        <div class="room-panel__header">
                            <p class="welcome-kicker">Chọn nhân vật</p>
                        </div>
                        <div class="character-grid">
                            ${renderCharacterCards()}
                        </div>
                        <p class="room-hint">Nhấn vào nhân vật để chọn</p>
                    </section>
                </div>

                <footer class="room-footer">
                    <div class="room-start">
                        <button class="action-button action-button--primary room-start__button" type="button" data-action="start-room">Start</button>
                        <p class="room-start__hint">Minimum reached (4 / 6). Ready to start.</p>
                    </div>
                </footer>
            </div>
        </div>
        ${renderCharacterModal()}
    `.trim();
}

export function renderRoomView({ mountEl, onNavigate }) {
    const roomId = MOCK_ROOM_ID;

    mountEl.innerHTML = renderRoomMarkup({ roomId });

    // Modal controls
    const modal = mountEl.querySelector('#character-modal');
    const modalTitle = mountEl.querySelector('#modal-title');
    const modalBody = mountEl.querySelector('#modal-body');

    const openModal = (charId) => {
        const char = CHARACTER_BY_ID[charId];
        if (!char || !modal || !modalTitle || !modalBody) return;

        modalTitle.textContent = char.name.vi || char.name.nickname || char.name.en;
        modalBody.innerHTML = renderCharacterDetail(char);
        modal.setAttribute('aria-hidden', 'false');
        modal.classList.add('is-open');
        document.body.style.overflow = 'hidden';
    };

    const closeModal = () => {
        if (!modal) return;
        modal.setAttribute('aria-hidden', 'true');
        modal.classList.remove('is-open');
        document.body.style.overflow = '';
    };

    // Close modal on backdrop or close button click
    mountEl.addEventListener('click', (e) => {
        const target = /** @type {HTMLElement} */ (e.target);
        if (target.closest('[data-action="close-modal"]')) {
            closeModal();
        }
    });

    // Close modal on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal?.classList.contains('is-open')) {
            closeModal();
        }
    });

    // View character detail button
    const viewButtons = mountEl.querySelectorAll('[data-action="view-character"]');
    for (const btn of viewButtons) {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // Don't trigger card selection
            const charId = btn.getAttribute('data-character-id');
            if (charId) openModal(charId);
        });
    }

    const mobileTabs = Array.from(mountEl.querySelectorAll('[data-tab]'));
    const setMobileTab = (tab) => {
        const surface = mountEl.querySelector('.room-surface');
        if (surface) {
            surface.setAttribute('data-active-panel', tab);
        }

        for (const btn of mobileTabs) {
            const isActive = btn.getAttribute('data-tab') === tab;
            btn.classList.toggle('is-active', isActive);
            btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        }
    };

    for (const tabButton of mobileTabs) {
        tabButton.addEventListener('click', () => {
            const tab = tabButton.getAttribute('data-tab');
            if (!tab) return;
            setMobileTab(tab);
        });
    }

    setMobileTab('players');

    const copyButton = mountEl.querySelector('[data-action="copy-id"]');
    copyButton?.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(roomId);
            copyButton.textContent = 'Copied';
            setTimeout(() => {
                copyButton.textContent = 'Copy ID';
            }, 1800);
        } catch (error) {
            console.warn('Clipboard API unavailable', error);
            alert(`Room ID: ${roomId}`);
        }
    });

    const leaveButton = mountEl.querySelector('[data-action="leave-room"]');
    leaveButton?.addEventListener('click', () => {
        onNavigate('#/');
    });

    const characterCards = Array.from(mountEl.querySelectorAll('[data-character]'));
    const resetAvailableBadges = () => {
        for (const card of characterCards) {
            if (card.classList.contains('is-taken')) continue;
            card.classList.remove('is-selected');
            const badge = card.querySelector('.character-card__header .badge');
            if (!badge) continue;
            badge.textContent = 'Có sẵn';
            badge.classList.remove('badge--accent');
            badge.classList.add('badge--muted');
        }
    };

    for (const card of characterCards) {
        if (card.classList.contains('is-taken')) continue;
        card.addEventListener('click', (e) => {
            // Don't select if clicking the info button
            const target = /** @type {HTMLElement} */ (e.target);
            if (target.closest('[data-action="view-character"]')) return;

            resetAvailableBadges();
            card.classList.add('is-selected');
            const badge = card.querySelector('.character-card__header .badge');
            if (badge) {
                badge.textContent = 'Đang chọn';
                badge.classList.remove('badge--muted');
                badge.classList.add('badge--accent');
            }
        });
    }

    const startButton = mountEl.querySelector('[data-action="start-room"]');
    startButton?.addEventListener('click', () => {
        alert('Game start (mock).');
    });
}
