// Character system - stats, data initialization, stat changes
import { state } from '../gameState.js';
import { CHARACTER_BY_ID } from '../../../data/charactersData.js';
import { calculateVaultLayout, calculatePlayerSpawnPosition } from '../../../utils/vaultLayout.js';
import {
    getStatValue,
    getPlayerStatForDice as getPlayerStatForDiceUtil,
    applyStatChange as applyStatChangeUtil,
    applyMultipleStatChanges as applyMultipleStatChangesUtil,
} from '../../../utils/eventEffects.js';

export function createCharacterData(playerId, characterId) {
    const char = CHARACTER_BY_ID[characterId];
    if (!char) return null;
    return {
        characterId,
        stats: {
            speed: char.traits.speed.startIndex,
            might: char.traits.might.startIndex,
            sanity: char.traits.sanity.startIndex,
            knowledge: char.traits.knowledge.startIndex,
        },
        isDead: false,
        faction: null,
    };
}

export function ensureCharacterDataInitialized(gameState) {
    if (!gameState || !gameState.players) return;
    if (!gameState.playerState) {
        gameState.playerState = {};
    }
    if (!gameState.playerState.characterData) {
        gameState.playerState.characterData = {};
    }
    for (const player of gameState.players) {
        if (!player.characterId) continue;
        if (!gameState.playerState.characterData[player.id]) {
            const charData = createCharacterData(player.id, player.characterId);
            if (charData) {
                gameState.playerState.characterData[player.id] = charData;
                console.log('[CharacterData] Initialized for player:', player.id, player.characterId);
            }
        }
    }
}

export function removeDiacritics(str) {
    if (!str) return '';
    return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D');
}

export function getCharacterSpeed(characterId, characterData = null) {
    const char = CHARACTER_BY_ID[characterId];
    if (!char) return 4;
    const speedTrait = char.traits.speed;
    const speedIndex = characterData?.stats?.speed ?? speedTrait.startIndex;
    return speedTrait.track[speedIndex];
}

export function getCharacterMight(characterId, characterData = null) {
    const char = CHARACTER_BY_ID[characterId];
    if (!char) return 3;
    const mightTrait = char.traits.might;
    const mightIndex = characterData?.stats?.might ?? mightTrait.startIndex;
    return mightTrait.track[mightIndex];
}

export function applyVaultSpawnPosition(playerId, targetRoom, gameState) {
    if (!targetRoom || !gameState) return;
    const isVault = targetRoom.name === 'Vault' || targetRoom.id === 'vault';
    if (!isVault) return;
    if (!gameState.playerState.playerSpawnPositions) {
        gameState.playerState.playerSpawnPositions = {};
    }
    const rotation = targetRoom.rotation || 0;
    const vaultLayout = targetRoom.vaultLayout || calculateVaultLayout(rotation);
    const roomBounds = { width: 100, height: 100 };
    const spawnPosition = calculatePlayerSpawnPosition(vaultLayout, roomBounds);
    gameState.playerState.playerSpawnPositions[playerId] = {
        roomId: targetRoom.id,
        zone: vaultLayout.nearDoorZone,
        position: spawnPosition
    };
    console.log(`[Vault] Player ${playerId} spawn position set to ${vaultLayout.nearDoorZone}`, spawnPosition);
}

export function getAllStatValues(characterData) {
    if (!characterData || !characterData.characterId || !characterData.stats) return null;
    const { characterId, stats } = characterData;
    return {
        speed: getStatValue(characterId, 'speed', stats.speed),
        might: getStatValue(characterId, 'might', stats.might),
        sanity: getStatValue(characterId, 'sanity', stats.sanity),
        knowledge: getStatValue(characterId, 'knowledge', stats.knowledge),
    };
}

export function getCharacterName(characterId) {
    const char = CHARACTER_BY_ID[characterId];
    if (!char) return 'Unknown';
    return char.name.vi || char.name.nickname || char.name.en;
}

export function getCharacterColor(characterId) {
    const char = CHARACTER_BY_ID[characterId];
    if (!char) return 'white';
    return char.color || 'white';
}

export function getPlayerStatForDice(playerId, stat) {
    return getPlayerStatForDiceUtil(state.currentGameState, playerId, stat);
}

export function applyStatChange(playerId, stat, amount) {
    const result = applyStatChangeUtil(state.currentGameState, playerId, stat, amount);
    if (result) {
        console.log(`[StatChange] Player ${playerId} ${stat}: ${result.beforeIndex} -> ${result.afterIndex} (${amount > 0 ? '+' : ''}${amount})`);
    }
}

export function applyMultipleStatChanges(playerId, stats) {
    applyMultipleStatChangesUtil(state.currentGameState, playerId, stats);
}

export function applyDamageToPlayer(playerId, physicalDamage, mentalDamage, physicalStat, mentalStat) {
    if (physicalDamage > 0 && physicalStat) {
        applyStatChange(playerId, physicalStat, -physicalDamage);
        console.log(`[Damage] Physical ${physicalDamage} applied to ${physicalStat}`);
    }
    if (mentalDamage > 0 && mentalStat) {
        applyStatChange(playerId, mentalStat, -mentalDamage);
        console.log(`[Damage] Mental ${mentalDamage} applied to ${mentalStat}`);
    }
    console.log(`[Damage] Applied to ${playerId} - physical: ${physicalDamage} (${physicalStat}), mental: ${mentalDamage} (${mentalStat})`);
}

// Re-export getStatValue for use by other modules
export { getStatValue } from '../../../utils/eventEffects.js';
