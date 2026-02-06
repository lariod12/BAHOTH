// Haunt trigger, death check, win condition, victory modal
import { state } from '../gameState.js';
import { isHauntTriggered, getFaction, getFactionLabel } from '../../../utils/factionUtils.js';
import { getCharacterName } from '../characters/characterManager.js';
import { syncGameStateToServer } from '../turn/turnManager.js';

export function showHauntAnnouncementModal(mountEl, hauntNumber, traitorName, amITraitor) {
    const existing = document.querySelector('.haunt-announcement-overlay');
    if (existing) existing.remove();

    const factionText = amITraitor ? 'Ban la KE PHAN BOI!' : 'Ban la NGUOI SONG SOT!';
    const factionClass = amITraitor ? 'traitor' : 'survivor';

    const modal = document.createElement('div');
    modal.className = `haunt-announcement-overlay haunt-announcement-overlay--${factionClass}`;
    modal.innerHTML = `
        <div class="haunt-announcement-modal haunt-announcement-modal--${factionClass}">
            <div class="haunt-announcement__icon">👻</div>
            <h2 class="haunt-announcement__title haunt-announcement__title--${factionClass}">THE HAUNT BEGINS!</h2>
            <div class="haunt-announcement__number">Haunt #${hauntNumber}</div>
            <div class="haunt-announcement__traitor">
                <span class="haunt-announcement__traitor-label">Ke Phan Boi:</span>
                <span class="haunt-announcement__traitor-name">${traitorName}</span>
            </div>
            <div class="haunt-announcement__faction haunt-announcement__faction--${factionClass}">
                <span class="haunt-announcement__faction-text">${factionText}</span>
            </div>
            <button class="haunt-announcement__close haunt-announcement__close--${factionClass} action-button" type="button">
                Bat dau chien dau!
            </button>
        </div>
    `;

    document.body.appendChild(modal);

    const closeModal = () => {
        modal.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => modal.remove(), 300);
    };

    modal.querySelector('.haunt-announcement__close')?.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
}

export function checkPlayerDeath(mountEl, playerId) {
    if (!state.currentGameState || !isHauntTriggered(state.currentGameState)) {
        return false;
    }
    const charData = state.currentGameState.playerState?.characterData?.[playerId];
    if (!charData || !charData.stats) return false;

    const stats = charData.stats;
    const isDead = stats.speed === 0 || stats.might === 0 ||
                   stats.sanity === 0 || stats.knowledge === 0;

    if (isDead && !charData.isDead) {
        charData.isDead = true;
        const player = state.currentGameState.players?.find(p => p.id === playerId);
        const characterName = getCharacterName(player?.characterId);
        const faction = getFaction(state.currentGameState, playerId);
        console.log('[Death] Player died:', playerId, characterName, 'faction:', faction);
        syncGameStateToServer();
        checkWinCondition(mountEl);
        return true;
    }
    return false;
}

export function checkWinCondition(mountEl) {
    if (!state.currentGameState || !isHauntTriggered(state.currentGameState)) return;

    const traitorId = state.currentGameState.hauntState?.traitorId;
    if (!traitorId) return;

    const traitorData = state.currentGameState.playerState?.characterData?.[traitorId];
    const traitorIsDead = traitorData?.isDead === true;

    const survivors = state.currentGameState.players?.filter(p =>
        getFaction(state.currentGameState, p.id) === 'survivor'
    ) || [];

    const aliveSurvivors = survivors.filter(p => {
        const charData = state.currentGameState.playerState?.characterData?.[p.id];
        return charData?.isDead !== true;
    });

    let winnerFaction = null;

    if (traitorIsDead) {
        winnerFaction = 'survivor';
        console.log('[Victory] Survivors win! Traitor is dead.');
    } else if (aliveSurvivors.length === 0) {
        winnerFaction = 'traitor';
        console.log('[Victory] Traitor wins! All survivors are dead.');
    }

    if (winnerFaction) {
        const deadPlayers = state.currentGameState.players?.filter(p => {
            const charData = state.currentGameState.playerState?.characterData?.[p.id];
            return charData?.isDead === true;
        }).map(p => ({
            id: p.id,
            name: getCharacterName(p.characterId),
            faction: getFaction(state.currentGameState, p.id)
        })) || [];

        state.currentGameState.gameOver = {
            winner: winnerFaction,
            deadPlayers: deadPlayers
        };
        syncGameStateToServer();
        showVictoryModal(mountEl, winnerFaction, deadPlayers);
    }
}

export function showVictoryModal(mountEl, winnerFaction, deadPlayers) {
    const existing = document.querySelector('.victory-overlay');
    if (existing) existing.remove();

    const isTraitorWin = winnerFaction === 'traitor';
    const myFaction = getFaction(state.currentGameState, state.mySocketId);
    const didIWin = myFaction === winnerFaction;

    const headerText = isTraitorWin ? 'KE PHAN BOI THANG!' : 'NGUOI SONG SOT THANG!';
    const subText = didIWin ? 'Chuc mung! Ban da CHIEN THANG!' : 'Ban da THAT BAI...';

    const deadListHtml = deadPlayers.length > 0
        ? `<div class="victory-modal__dead-list"><h4>Nhung nguoi da nga:</h4><ul>${deadPlayers.map(p => `
                <li class="victory-modal__dead-player victory-modal__dead-player--${p.faction}">
                    ${p.name} <span class="victory-modal__faction">(${getFactionLabel(p.faction)})</span>
                </li>
            `).join('')}</ul></div>`
        : '';

    const modal = document.createElement('div');
    modal.className = `victory-overlay victory-overlay--${winnerFaction}`;
    modal.innerHTML = `
        <div class="victory-modal victory-modal--${winnerFaction}">
            <div class="victory-modal__icon">${isTraitorWin ? '💀' : '🏆'}</div>
            <h2 class="victory-modal__title victory-modal__title--${winnerFaction}">${headerText}</h2>
            <p class="victory-modal__subtitle victory-modal__subtitle--${didIWin ? 'win' : 'lose'}">${subText}</p>
            ${deadListHtml}
            <button class="victory-modal__btn action-button" type="button" data-action="victory-close">
                Ve Trang Chu
            </button>
        </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('[data-action="victory-close"]')?.addEventListener('click', () => {
        modal.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => {
            modal.remove();
            window.location.hash = '#/';
        }, 300);
    });
}
