// Faction Utilities for Betrayal at House on the Hill
// Handles player faction logic: pre-haunt (all allies) vs post-haunt (traitor vs heroes)

/**
 * @typedef {'survivor' | 'traitor' | null} Faction
 * null = pre-haunt, all players are allies
 */

/**
 * @typedef {Object} HauntState
 * @property {boolean} hauntTriggered - Whether haunt has been triggered
 * @property {number | null} hauntNumber - Haunt scenario number (1-50)
 * @property {string | null} triggeredByPlayerId - Who triggered the haunt
 * @property {string | null} triggerOmen - Omen that triggered haunt
 * @property {string | null} triggerRoom - Room where haunt was triggered
 * @property {string | null} traitorId - Player ID of the traitor
 */

/**
 * Check if haunt has been triggered
 * @param {Object} gameState - Current game state
 * @returns {boolean}
 */
export function isHauntTriggered(gameState) {
    return gameState?.hauntState?.hauntTriggered === true;
}

/**
 * Get a player's faction
 * @param {Object} gameState - Current game state
 * @param {string} playerId - Player ID to check
 * @returns {Faction}
 */
export function getFaction(gameState, playerId) {
    const characterData = gameState?.playerState?.characterData?.[playerId]
        || gameState?.characterData?.[playerId];
    return characterData?.faction ?? null;
}

/**
 * Check if two players are allies
 * Pre-haunt: everyone is allies
 * Post-haunt: same faction = allies
 * @param {Object} gameState - Current game state
 * @param {string} playerId1 - First player ID
 * @param {string} playerId2 - Second player ID
 * @returns {boolean}
 */
export function isAlly(gameState, playerId1, playerId2) {
    // Same player is always an ally of themselves
    if (playerId1 === playerId2) return true;

    // Pre-haunt: everyone is allies
    if (!isHauntTriggered(gameState)) return true;

    const faction1 = getFaction(gameState, playerId1);
    const faction2 = getFaction(gameState, playerId2);

    // Same faction = allies (both must have a faction assigned)
    if (faction1 && faction2) {
        return faction1 === faction2;
    }

    // If factions not yet assigned after haunt, treat as allies (safety fallback)
    return true;
}

/**
 * Check if two players are enemies
 * Pre-haunt: no enemies
 * Post-haunt: different factions = enemies
 * @param {Object} gameState - Current game state
 * @param {string} playerId1 - First player ID
 * @param {string} playerId2 - Second player ID
 * @returns {boolean}
 */
export function isEnemy(gameState, playerId1, playerId2) {
    // Same player is never their own enemy
    if (playerId1 === playerId2) return false;

    // Pre-haunt: no enemies
    if (!isHauntTriggered(gameState)) return false;

    const faction1 = getFaction(gameState, playerId1);
    const faction2 = getFaction(gameState, playerId2);

    // Different faction = enemies (both must have a faction assigned)
    if (faction1 && faction2) {
        return faction1 !== faction2;
    }

    // If factions not yet assigned after haunt, not enemies (safety fallback)
    return false;
}

/**
 * Get faction display label in Vietnamese
 * @param {Faction} faction - Faction value
 * @returns {string}
 */
export function getFactionLabel(faction) {
    if (faction === 'traitor') return 'Traitor';
    if (faction === 'survivor') return 'Survivor';
    return '';
}

/**
 * Trigger haunt and assign factions to all players
 * This mutates the gameState object directly
 * @param {Object} gameState - Current game state
 * @param {Object} hauntData - Haunt trigger data
 * @param {number} hauntData.hauntNumber - Haunt scenario number
 * @param {string} hauntData.traitorId - Player ID who becomes traitor
 * @param {string} [hauntData.triggeredByPlayerId] - Who triggered the haunt
 * @param {string} [hauntData.triggerOmen] - Omen that triggered
 * @param {string} [hauntData.triggerRoom] - Room where triggered
 */
export function applyHauntState(gameState, hauntData) {
    if (!gameState) return;

    const { hauntNumber, traitorId, triggeredByPlayerId, triggerOmen, triggerRoom } = hauntData;

    // Set haunt state
    gameState.hauntState = {
        hauntTriggered: true,
        hauntNumber: hauntNumber,
        triggeredByPlayerId: triggeredByPlayerId || traitorId,
        triggerOmen: triggerOmen || null,
        triggerRoom: triggerRoom || null,
        traitorId: traitorId,
    };

    // Ensure playerState.characterData exists
    if (!gameState.playerState) {
        gameState.playerState = {};
    }
    if (!gameState.playerState.characterData) {
        gameState.playerState.characterData = {};
    }

    // Assign factions to all players
    const players = gameState.players || [];
    players.forEach(p => {
        // Get or create character data entry
        let charData = gameState.playerState.characterData[p.id];
        if (!charData) {
            // Initialize if not exists
            gameState.playerState.characterData[p.id] = {
                characterId: p.characterId,
                faction: null,
            };
            charData = gameState.playerState.characterData[p.id];
        }
        // Set faction
        charData.faction = p.id === traitorId ? 'traitor' : 'survivor';
        console.log(`[Haunt] Player ${p.id} faction set to: ${charData.faction}`);
    });
}

