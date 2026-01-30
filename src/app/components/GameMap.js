// GameMap Component - Renders the revealed rooms and player positions
// Uses focused viewport centered on player position

import { calculateVaultLayout, getDividerOrientation } from '../utils/vaultLayout.js';

/**
 * @typedef {{
 *   id: string;
 *   name: string;
 *   x: number;
 *   y: number;
 *   doors: ('north' | 'south' | 'east' | 'west')[];
 *   floor: 'ground' | 'upper' | 'basement';
 *   tokens?: ('omen' | 'event' | 'item')[];
 *   specialTokens?: string[];
 *   rotation?: number;
 *   vaultLayout?: import('../utils/vaultLayout.js').VaultLayout;
 * }} Room
 *
 * @typedef {{
 *   revealedRooms: Record<string, Room>;
 *   connections: Record<string, Record<string, string>>;
 * }} MapState
 */

// Viewport size (how many cells visible around player)
const VIEWPORT_RADIUS = 2; // Shows 5x5 grid (2 cells each direction + center)

/**
 * Get player's current room coordinates
 * @param {Record<string, Room>} rooms
 * @param {string | undefined} myPosition - Room ID where player is
 * @returns {{ x: number; y: number }}
 */
function getPlayerCoords(rooms, myPosition) {
    if (!myPosition || !rooms[myPosition]) {
        // Default to entrance-hall or first room
        const entranceHall = rooms['entrance-hall'];
        if (entranceHall) {
            return { x: entranceHall.x, y: entranceHall.y };
        }
        const firstRoom = Object.values(rooms)[0];
        return firstRoom ? { x: firstRoom.x, y: firstRoom.y } : { x: 0, y: 0 };
    }
    const room = rooms[myPosition];
    return { x: room.x, y: room.y };
}

/**
 * Filter rooms by floor only (no viewport limitation)
 * @param {Record<string, Room>} rooms
 * @param {string} currentFloor - Current floor to filter by
 * @returns {Room[]}
 */
function filterRoomsByFloor(rooms, currentFloor) {
    const visible = [];
    for (const room of Object.values(rooms)) {
        // Only show rooms on the same floor
        if (room.floor !== currentFloor) continue;

        // Don't show elevator shafts (empty elevator positions)
        if (room.isElevatorShaft) continue;

        visible.push(room);
    }
    return visible;
}

/**
 * Calculate map bounds (min/max x/y coordinates)
 * @param {Room[]} rooms
 * @returns {{ minX: number, maxX: number, minY: number, maxY: number }}
 */
function calculateMapBounds(rooms) {
    if (rooms.length === 0) {
        return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    }

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    for (const room of rooms) {
        if (room.x < minX) minX = room.x;
        if (room.x > maxX) maxX = room.x;
        if (room.y < minY) minY = room.y;
        if (room.y > maxY) maxY = room.y;
    }

    return { minX, maxX, minY, maxY };
}

/**
 * Get opposite direction
 * @param {'north' | 'south' | 'east' | 'west'} dir
 * @returns {'north' | 'south' | 'east' | 'west'}
 */
function getOppositeDir(dir) {
    const opposites = { north: 'south', south: 'north', east: 'west', west: 'east' };
    return opposites[dir];
}

/**
 * Get adjacent position based on direction
 * @param {number} x
 * @param {number} y
 * @param {'north' | 'south' | 'east' | 'west'} dir
 * @returns {{ x: number, y: number }}
 */
function getAdjacentPosition(x, y, dir) {
    switch (dir) {
        case 'north': return { x, y: y + 1 };
        case 'south': return { x, y: y - 1 };
        case 'east': return { x: x + 1, y };
        case 'west': return { x: x - 1, y };
        default: return { x, y };
    }
}

/**
 * Check if a door connects to a wall (adjacent room exists but has no matching door)
 * @param {Room} room - Current room
 * @param {'north' | 'south' | 'east' | 'west'} dir - Door direction
 * @param {Record<string, Room>} allRooms - All revealed rooms
 * @returns {boolean} - True if door connects to wall
 */
function isDoorToWall(room, dir, allRooms) {
    const adjPos = getAdjacentPosition(room.x, room.y, dir);
    
    // Find room at adjacent position on same floor
    const adjacentRoom = Object.values(allRooms).find(r => 
        r.x === adjPos.x && r.y === adjPos.y && r.floor === room.floor
    );
    
    // If no adjacent room, door is open (not to wall)
    if (!adjacentRoom) return false;
    
    // If adjacent room exists, check if it has a matching door
    const oppositeDir = getOppositeDir(dir);
    const hasMatchingDoor = adjacentRoom.doors && adjacentRoom.doors.includes(oppositeDir);
    
    // If adjacent room has no matching door, this door connects to wall
    return !hasMatchingDoor;
}

/**
 * Render door indicators for a room
 * @param {('north' | 'south' | 'east' | 'west')[]} doors
 * @param {Record<string, string>} connections - direction -> roomId
 * @param {Room} room - Current room
 * @param {Record<string, Room>} allRooms - All revealed rooms
 * @returns {string}
 */
function renderDoors(doors, connections, room, allRooms) {
    const doorHtml = [];

    for (const dir of doors) {
        // Skip door if it connects to a wall
        if (isDoorToWall(room, dir, allRooms)) continue;
        
        const isConnected = !!connections[dir];
        const doorClass = isConnected ? 'map-door--connected' : 'map-door--open';
        doorHtml.push(`<div class="map-door map-door--${dir} ${doorClass}"></div>`);
    }

    return doorHtml.join('');
}

/**
 * Render token indicators for a room
 * @param {('omen' | 'event' | 'item')[]} tokens
 * @param {Object} [vaultLayout] - Optional Vault layout for special positioning
 * @returns {string}
 */
function renderTokens(tokens, vaultLayout = null) {
    if (!tokens || tokens.length === 0) return '';
    
    // If Vault layout provided, use zone-based positioning
    if (vaultLayout) {
        return renderVaultTokens(tokens, vaultLayout);
    }
    
    // Group tokens by type
    const tokensByType = { omen: [], event: [], item: [] };
    for (const token of tokens) {
        if (tokensByType[token]) {
            tokensByType[token].push(token);
        }
    }
    
    // Render each token individually with offset based on index
    const tokenHtml = [];
    
    // Omen tokens - top right, stack horizontally to the left
    tokensByType.omen.forEach((_, i) => {
        tokenHtml.push(`<div class="map-token map-token--omen" style="right: ${4 + i * 10}px;" title="omen"></div>`);
    });
    
    // Event tokens - bottom right, stack horizontally to the left
    tokensByType.event.forEach((_, i) => {
        tokenHtml.push(`<div class="map-token map-token--event" style="right: ${4 + i * 10}px;" title="event"></div>`);
    });
    
    // Item tokens - bottom left, stack horizontally to the right
    tokensByType.item.forEach((_, i) => {
        tokenHtml.push(`<div class="map-token map-token--item" style="left: ${4 + i * 10}px;" title="item"></div>`);
    });
    
    return `<div class="map-tokens">${tokenHtml.join('')}</div>`;
}

/**
 * Render special tokens for a room (e.g., Secret Passage)
 * @param {string[]} specialTokens
 * @returns {string}
 */
function renderSpecialTokens(specialTokens) {
    if (!specialTokens || specialTokens.length === 0) return '';

    const tokenHtml = [];

    specialTokens.forEach((tokenType, i) => {
        const leftOffset = 4 + i * 12;
        if (tokenType === 'secretPassage') {
            tokenHtml.push(`
                <div class="map-token map-token--special map-token--secret-passage"
                     style="top: 4px; left: ${leftOffset}px;"
                     title="Secret Passage">
                    <span class="map-token__label">SP</span>
                </div>
            `);
        } else {
            tokenHtml.push(`
                <div class="map-token map-token--special"
                     style="top: 4px; left: ${leftOffset}px;"
                     title="${tokenType}">
                    <span class="map-token__label">?</span>
                </div>
            `);
        }
    });

    return `<div class="map-tokens map-tokens--special">${tokenHtml.join('')}</div>`;
}

/**
 * Render tokens for Vault room with zone-based positioning
 * Event token in near-door zone corner, item tokens in far-door zone corner
 * @param {('omen' | 'event' | 'item')[]} tokens
 * @param {Object} vaultLayout - Vault layout from calculateVaultLayout()
 * @returns {string}
 */
function renderVaultTokens(tokens, vaultLayout) {
    const tokenHtml = [];
    const { nearDoorZone, farDoorZone, dividerOrientation } = vaultLayout;
    
    // Corner position mappings for event token (near-door zone)
    // Event token goes to the corner of near-door zone
    const eventCornerPositions = {
        'top-half': { top: '4px', right: '4px' },      // Top-right corner of top half
        'bottom-half': { bottom: '4px', right: '4px' }, // Bottom-right corner of bottom half
        'left-half': { top: '4px', left: '4px' },       // Top-left corner of left half
        'right-half': { top: '4px', right: '4px' }      // Top-right corner of right half
    };
    
    // Corner position mappings for item tokens (far-door zone)
    const itemCornerPositions = {
        'top-half': { top: '4px', left: '4px' },        // Top-left corner of top half
        'bottom-half': { bottom: '4px', left: '4px' },  // Bottom-left corner of bottom half
        'left-half': { bottom: '4px', left: '4px' },    // Bottom-left corner of left half
        'right-half': { bottom: '4px', right: '4px' }   // Bottom-right corner of right half
    };
    
    const eventPos = eventCornerPositions[nearDoorZone];
    const itemPos = itemCornerPositions[farDoorZone];
    
    // Event token in near-door zone corner
    const eventTokens = tokens.filter(t => t === 'event');
    eventTokens.forEach(() => {
        const posStyle = Object.entries(eventPos).map(([k, v]) => `${k}: ${v}`).join('; ');
        tokenHtml.push(`
            <div class="map-token map-token--event map-token--vault-zone" 
                 style="${posStyle};" 
                 title="event (near door)"></div>
        `);
    });
    
    // Item tokens in far-door zone corner (stacked)
    const itemTokens = tokens.filter(t => t === 'item');
    const isHorizontalDivider = dividerOrientation === 'horizontal';
    
    itemTokens.forEach((_, i) => {
        const offset = i * 10; // 10px spacing between items
        let posStyle = Object.entries(itemPos).map(([k, v]) => `${k}: ${v}`).join('; ');
        
        // Stack items horizontally or vertically based on divider orientation
        if (isHorizontalDivider) {
            // Horizontal divider = stack items horizontally
            if (itemPos.left) {
                posStyle = posStyle.replace(/left:\s*\d+px/, `left: ${4 + offset}px`);
            } else if (itemPos.right) {
                posStyle = posStyle.replace(/right:\s*\d+px/, `right: ${4 + offset}px`);
            }
        } else {
            // Vertical divider = stack items vertically
            if (itemPos.top) {
                posStyle = posStyle.replace(/top:\s*\d+px/, `top: ${4 + offset}px`);
            } else if (itemPos.bottom) {
                posStyle = posStyle.replace(/bottom:\s*\d+px/, `bottom: ${4 + offset}px`);
            }
        }
        
        tokenHtml.push(`
            <div class="map-token map-token--item map-token--vault-zone" 
                 style="${posStyle};" 
                 title="item (far from door)"></div>
        `);
    });
    
    // Omen tokens (if any) - default positioning at top-right
    const omenTokens = tokens.filter(t => t === 'omen');
    omenTokens.forEach((_, i) => {
        tokenHtml.push(`<div class="map-token map-token--omen" style="top: 4px; right: ${4 + i * 10}px;" title="omen"></div>`);
    });
    
    return `<div class="map-tokens map-tokens--vault">${tokenHtml.join('')}</div>`;
}

/**
 * Render pawn icons for all players in this room
 * @param {string} roomId - Current room ID
 * @param {Record<string, string>} playerPositions - socketId -> roomId
 * @param {Record<string, string>} playerNames - socketId -> character name
 * @param {Record<string, string>} playerColors - socketId -> color
 * @param {string} myId - Current player's socket ID
 * @param {string | null} activePlayerId - ID of the active player (current turn)
 * @param {Object} [vaultLayout] - Optional Vault layout for spawn positioning
 * @param {Record<string, string>} [playerEntryDirections] - socketId -> entry direction (north/south/east/west)
 * @returns {string}
 */
function renderPawnMarkers(roomId, playerPositions, playerNames, playerColors, myId, activePlayerId, vaultLayout = null, playerEntryDirections = {}) {
    // Find all players in this room
    const playersInRoom = [];
    for (const [playerId, playerRoomId] of Object.entries(playerPositions)) {
        if (playerRoomId === roomId) {
            playersInRoom.push({
                id: playerId,
                name: playerNames[playerId] || 'Unknown',
                color: playerColors[playerId] || 'white',
                isMe: playerId === myId,
                isActive: playerId === activePlayerId,
                entryDirection: playerEntryDirections[playerId] || null
            });
        }
    }

    if (playersInRoom.length === 0) return '';

    // Group players by entry direction for positioning
    const playersByDirection = {};
    playersInRoom.forEach(player => {
        const dir = player.entryDirection || 'default';
        if (!playersByDirection[dir]) playersByDirection[dir] = [];
        playersByDirection[dir].push(player);
    });

    // Render each group of players at their entry position
    const groupsHtml = Object.entries(playersByDirection).map(([direction, players]) => {
        const pawnsHtml = players.map((player) => {
            const meClass = player.isMe ? 'map-pawn--me' : '';
            const activeClass = player.isActive ? 'map-pawn--active' : '';
            const colorClass = `map-pawn--${player.color}`;

            // Active player indicator arrow
            const activeIndicator = player.isActive ? `
                <svg class="map-pawn__active-indicator" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M7 10l5 5 5-5z"/>
                </svg>
            ` : '';

            return `
                <div class="map-pawn ${meClass} ${activeClass} ${colorClass}" title="${player.name}">
                    ${activeIndicator}
                    <svg class="map-pawn__icon" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="5" r="3.5"/>
                        <path d="M12 10c-3.5 0-7 2.5-7 6v4h14v-4c0-3.5-3.5-6-7-6z"/>
                    </svg>
                </div>
            `;
        }).join('');

        // Vault room positioning takes priority
        const vaultSpawnClass = vaultLayout ? `map-pawns--door-${vaultLayout.doorSide}` : '';
        const entryClass = direction !== 'default' ? `map-pawns--entry-${direction}` : '';
        const positionClass = vaultSpawnClass || entryClass;

        return `<div class="map-pawns ${positionClass}">${pawnsHtml}</div>`;
    }).join('');

    return groupsHtml;
}

/**
 * Render a single room tile with relative positioning
 * @param {Room} room
 * @param {Record<string, string>} connections
 * @param {Record<string, string>} playerPositions
 * @param {Record<string, string>} playerNames
 * @param {string} myId
 * @param {number} centerX - Player's X coord (for relative positioning)
 * @param {number} centerY - Player's Y coord (for relative positioning)
 * @param {number} radius - Viewport radius
 * @param {Record<string, Room>} allRooms - All revealed rooms
 * @returns {string}
 */
/**
 * Render a single room tile with absolute positioning based on map bounds
 * @param {Room} room
 * @param {Record<string, string>} connections
 * @param {Record<string, string>} playerPositions
 * @param {Record<string, string>} playerNames
 * @param {Record<string, string>} playerColors
 * @param {string} myId
 * @param {string | null} activePlayerId - ID of the active player (current turn)
 * @param {{ minX: number, maxX: number, minY: number, maxY: number }} bounds - Map bounds
 * @param {Record<string, Room>} allRooms - All revealed rooms
 * @param {Record<string, string>} [playerEntryDirections] - socketId -> entry direction
 * @returns {string}
 */
function renderRoomTile(room, connections, playerPositions, playerNames, playerColors, myId, activePlayerId, bounds, allRooms, playerEntryDirections = {}) {
    const floorClass = `map-room--${room.floor}`;
    
    // Check if current player is in this room
    const isMyRoom = playerPositions[myId] === room.id;
    const currentClass = isMyRoom ? 'map-room--current' : '';
    
    const hasTokens = room.tokens && room.tokens.length > 0;
    const tokensClass = hasTokens ? 'map-room--has-tokens' : '';
    
    // Special rooms with divider (like Vault)
    const isVault = room.name === 'Vault' || room.id === 'vault';
    const vaultClass = isVault ? 'map-room--vault' : '';
    
    // Calculate Vault layout if applicable
    let vaultLayout = null;
    let dividerOrientationClass = '';
    if (isVault) {
        const rotation = room.rotation || 0;
        vaultLayout = room.vaultLayout || calculateVaultLayout(rotation);
        dividerOrientationClass = `map-room--divider-${vaultLayout.dividerOrientation}`;
    }

    // Calculate grid position based on map bounds (1-indexed for CSS grid)
    const gridCol = room.x - bounds.minX + 1;
    const gridRow = bounds.maxY - room.y + 1; // Invert Y for CSS (top = maxY)
    
    // Vault divider line with orientation
    let vaultDivider = '';
    if (isVault && vaultLayout) {
        vaultDivider = `<div class="map-room__divider map-room__divider--${vaultLayout.dividerOrientation}"></div>`;
    }

    return `
        <div class="map-room ${floorClass} ${currentClass} ${tokensClass} ${vaultClass} ${dividerOrientationClass}"
             data-room-id="${room.id}"
             style="grid-column: ${gridCol}; grid-row: ${gridRow};">
            <div class="map-room__inner">
                <span class="map-room__name">${room.name}</span>
                ${vaultDivider}
                ${renderTokens(room.tokens, vaultLayout)}
                ${renderSpecialTokens(room.specialTokens)}
                ${renderDoors(room.doors, connections, room, allRooms)}
                ${renderPawnMarkers(room.id, playerPositions, playerNames, playerColors, myId, activePlayerId, vaultLayout, playerEntryDirections)}
            </div>
        </div>
    `;
}

/**
 * Render the game map with focused viewport
 * @param {MapState | null} mapState
 * @param {Record<string, string>} playerPositions - socketId -> roomId
 * @param {Record<string, string>} playerNames - socketId -> character name
 * @param {Record<string, string>} playerColors - socketId -> color
 * @param {string} myId
 * @param {string | undefined} myPosition
 * @param {Object | null} roomPreview - Preview room data { name, doors, rotation, x, y, isValid }
 * @param {Record<string, string>} [playerEntryDirections] - socketId -> entry direction
 * @param {string | null} [activePlayerId] - ID of the active player (current turn)
 * @param {'basement'|'ground'|'upper'|null} [floorOverride] - Force map to show a floor
 * @returns {string}
 */
export function renderGameMap(
    mapState,
    playerPositions,
    playerNames,
    playerColors,
    myId,
    myPosition,
    roomPreview = null,
    playerEntryDirections = {},
    activePlayerId = null,
    floorOverride = null
) {
    if (!mapState || !mapState.revealedRooms) {
        return `
            <div class="game-map game-map--empty">
                <p class="game-map__placeholder">Map loading...</p>
            </div>
        `;
    }

    const rooms = mapState.revealedRooms;
    const connections = mapState.connections || {};

    // Get current room to determine floor
    const currentRoom = myPosition ? rooms[myPosition] : null;
    const currentFloor = floorOverride || currentRoom?.floor || 'ground';

    // Get player position for focus feature
    const playerCoords = getPlayerCoords(rooms, myPosition);

    // Filter rooms by floor only (no viewport limitation)
    const visibleRooms = filterRoomsByFloor(rooms, currentFloor);

    // Calculate map bounds for grid positioning (include roomPreview if present)
    let bounds = calculateMapBounds(visibleRooms);

    // Expand bounds to include room preview position if present
    if (roomPreview) {
        bounds = {
            minX: Math.min(bounds.minX, roomPreview.x),
            maxX: Math.max(bounds.maxX, roomPreview.x),
            minY: Math.min(bounds.minY, roomPreview.y),
            maxY: Math.max(bounds.maxY, roomPreview.y)
        };
    }

    // Grid size based on actual map bounds
    const gridWidth = bounds.maxX - bounds.minX + 1;
    const gridHeight = bounds.maxY - bounds.minY + 1;

    // Render all rooms on current floor
    const roomsHtml = visibleRooms.map((room) => {
        const roomConnections = connections[room.id] || {};

        return renderRoomTile(
            room,
            roomConnections,
            playerPositions,
            playerNames,
            playerColors,
            myId,
            activePlayerId,
            bounds,
            rooms,
            playerEntryDirections
        );
    }).join('');

    // Render room preview if in placement mode
    let previewHtml = '';
    if (roomPreview) {
        const gridCol = roomPreview.x - bounds.minX + 1;
        const gridRow = bounds.maxY - roomPreview.y + 1;
        const validClass = roomPreview.isValid ? 'map-room-preview--valid' : 'map-room-preview--invalid';

        // Render doors for preview (already rotated)
        const previewDoorsHtml = roomPreview.doors.map(dir => {
            return `<div class="map-door map-door--${dir}"></div>`;
        }).join('');

        previewHtml = `
            <div class="map-room-preview ${validClass}"
                 data-action="rotate-room"
                 style="grid-column: ${gridCol}; grid-row: ${gridRow};">
                <div class="map-room-preview__inner">
                    <span class="map-room-preview__name">${roomPreview.name}</span>
                    <span class="map-room-preview__rotation">${roomPreview.rotation}°</span>
                    ${previewDoorsHtml}
                </div>
            </div>
        `;
    }

    // Calculate player grid position for focus button
    const playerGridCol = playerCoords.x - bounds.minX + 1;
    const playerGridRow = bounds.maxY - playerCoords.y + 1;

    // Calculate preview grid position if present
    let previewDataAttrs = '';
    if (roomPreview) {
        const previewGridCol = roomPreview.x - bounds.minX + 1;
        const previewGridRow = bounds.maxY - roomPreview.y + 1;
        previewDataAttrs = `data-preview-col="${previewGridCol}" data-preview-row="${previewGridRow}"`;
    }

    return `
        <div class="game-map" data-player-col="${playerGridCol}" data-player-row="${playerGridRow}" ${previewDataAttrs}>
            <div class="game-map__grid" style="--grid-width: ${gridWidth}; --grid-height: ${gridHeight};">
                ${roomsHtml}
                ${previewHtml}
            </div>
        </div>
    `;
}

/**
 * Get character name from player data
 * @param {any[]} players - Array of player objects
 * @param {(characterId: string) => string} getCharacterName
 * @returns {Record<string, string>}
 */
export function buildPlayerNamesMap(players, getCharacterName) {
    const map = {};
    for (const player of players) {
        if (player.characterId) {
            map[player.id] = getCharacterName(player.characterId);
        } else {
            map[player.id] = player.name || 'Unknown';
        }
    }
    return map;
}

/**
 * Get character color from player data
 * @param {any[]} players - Array of player objects
 * @param {(characterId: string) => string} getCharacterColor
 * @returns {Record<string, string>}
 */
export function buildPlayerColorsMap(players, getCharacterColor) {
    const map = {};
    for (const player of players) {
        if (player.characterId) {
            map[player.id] = getCharacterColor(player.characterId);
        } else {
            map[player.id] = 'white';
        }
    }
    return map;
}
