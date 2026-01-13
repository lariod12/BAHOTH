// GameMap Component - Renders the revealed rooms and player positions
// Uses focused viewport centered on player position

/**
 * @typedef {{
 *   id: string;
 *   name: string;
 *   x: number;
 *   y: number;
 *   doors: ('north' | 'south' | 'east' | 'west')[];
 *   floor: 'ground' | 'upper' | 'basement';
 *   tokens?: ('omen' | 'event' | 'item')[];
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
 * Filter rooms to only those visible in viewport AND on same floor
 * @param {Record<string, Room>} rooms
 * @param {number} centerX
 * @param {number} centerY
 * @param {number} radius
 * @param {string} currentFloor - Current floor to filter by
 * @returns {Room[]}
 */
function filterVisibleRooms(rooms, centerX, centerY, radius, currentFloor) {
    const visible = [];
    for (const room of Object.values(rooms)) {
        // Only show rooms on the same floor
        if (room.floor !== currentFloor) continue;
        
        const dx = Math.abs(room.x - centerX);
        const dy = Math.abs(room.y - centerY);
        if (dx <= radius && dy <= radius) {
            visible.push(room);
        }
    }
    return visible;
}

/**
 * Render door indicators for a room
 * @param {('north' | 'south' | 'east' | 'west')[]} doors
 * @param {Record<string, string>} connections - direction -> roomId
 * @returns {string}
 */
function renderDoors(doors, connections) {
    const doorHtml = [];

    for (const dir of doors) {
        const isConnected = !!connections[dir];
        const doorClass = isConnected ? 'map-door--connected' : 'map-door--open';
        doorHtml.push(`<div class="map-door map-door--${dir} ${doorClass}"></div>`);
    }

    return doorHtml.join('');
}

/**
 * SVG icons for token types
 */
const TOKEN_ICONS = {
    // Omen - Umbrella icon (mystical/foreboding)
    omen: `<svg class="map-token__icon" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.5 2 2 6.5 2 12h2c0-1.1.2-2.2.6-3.2C5.4 7.2 8.4 6 12 6s6.6 1.2 7.4 2.8c.4 1 .6 2.1.6 3.2h2c0-5.5-4.5-10-10-10z"/>
        <path d="M11 12v8c0 .6-.4 1-1 1s-1-.4-1-1v-1H7v1c0 1.7 1.3 3 3 3s3-1.3 3-3v-8h-2z"/>
    </svg>`,
    
    // Event - Spiral icon (supernatural occurrence)
    event: `<svg class="map-token__icon" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2a10 10 0 0 0-7.35 16.76l1.46-1.46A8 8 0 1 1 12 20a7.93 7.93 0 0 1-4.9-1.69l-1.46 1.46A10 10 0 1 0 12 2z"/>
        <path d="M12 6a6 6 0 0 0-4.24 10.24l1.41-1.41A4 4 0 1 1 12 16a3.95 3.95 0 0 1-2.83-1.17l-1.41 1.41A6 6 0 1 0 12 6z"/>
        <circle cx="12" cy="12" r="2"/>
    </svg>`,
    
    // Item - Horned skull icon (treasure/artifact)
    item: `<svg class="map-token__icon" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14l-5-5 1.4-1.4 3.6 3.6 7.6-7.6L21 8l-9 9z"/>
    </svg>`
};

/**
 * Render token indicators for a room
 * @param {('omen' | 'event' | 'item')[]} tokens
 * @returns {string}
 */
function renderTokens(tokens) {
    if (!tokens || tokens.length === 0) return '';
    
    // Count unique token types
    const tokenCounts = {};
    for (const token of tokens) {
        tokenCounts[token] = (tokenCounts[token] || 0) + 1;
    }
    
    const tokenHtml = Object.entries(tokenCounts).map(([type, count]) => {
        const icon = TOKEN_ICONS[type] || '';
        const countBadge = count > 1 ? `<span class="map-token__count">${count}</span>` : '';
        return `<div class="map-token map-token--${type}" title="${type}">${icon}${countBadge}</div>`;
    }).join('');
    
    return `<div class="map-tokens">${tokenHtml}</div>`;
}

/**
 * Render pawn icon for current player's room only
 * @param {boolean} isMyRoom - Whether this is the current player's room
 * @returns {string}
 */
function renderPawnMarker(isMyRoom) {
    if (!isMyRoom) return '';

    return `
        <div class="map-pawn">
            <svg class="map-pawn__icon" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="5" r="3.5"/>
                <path d="M12 10c-3.5 0-7 2.5-7 6v4h14v-4c0-3.5-3.5-6-7-6z"/>
            </svg>
        </div>
    `;
}

/**
 * Render a single room tile with relative positioning
 * @param {Room} room
 * @param {Record<string, string>} connections
 * @param {boolean} isCurrentRoom
 * @param {number} centerX - Player's X coord (for relative positioning)
 * @param {number} centerY - Player's Y coord (for relative positioning)
 * @param {number} radius - Viewport radius
 * @returns {string}
 */
function renderRoomTile(room, connections, isCurrentRoom, centerX, centerY, radius) {
    const floorClass = `map-room--${room.floor}`;
    const currentClass = isCurrentRoom ? 'map-room--current' : '';
    const hasTokens = room.tokens && room.tokens.length > 0;
    const tokensClass = hasTokens ? 'map-room--has-tokens' : '';

    // Calculate grid position relative to viewport (1-indexed for CSS grid)
    // Viewport is (2*radius + 1) x (2*radius + 1)
    const gridCol = (room.x - centerX) + radius + 1;
    const gridRow = -(room.y - centerY) + radius + 1; // Invert Y for CSS

    return `
        <div class="map-room ${floorClass} ${currentClass} ${tokensClass}" 
             data-room-id="${room.id}"
             style="grid-column: ${gridCol}; grid-row: ${gridRow};">
            <div class="map-room__inner">
                <span class="map-room__name">${room.name}</span>
                ${renderTokens(room.tokens)}
                ${renderDoors(room.doors, connections)}
                ${renderPawnMarker(isCurrentRoom)}
            </div>
        </div>
    `;
}

/**
 * Render the game map with focused viewport
 * @param {MapState | null} mapState
 * @param {Record<string, string>} playerPositions - socketId -> roomId
 * @param {Record<string, string>} playerNames - socketId -> character name
 * @param {string} myId
 * @param {string | undefined} myPosition
 * @param {Object | null} roomPreview - Preview room data { name, doors, rotation, x, y, isValid }
 * @returns {string}
 */
export function renderGameMap(mapState, playerPositions, playerNames, myId, myPosition, roomPreview = null) {
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
    const currentFloor = currentRoom?.floor || 'ground';

    // Get player position to center viewport
    const playerCoords = getPlayerCoords(rooms, myPosition);
    const centerX = playerCoords.x;
    const centerY = playerCoords.y;

    // Filter rooms within viewport AND on same floor
    const visibleRooms = filterVisibleRooms(rooms, centerX, centerY, VIEWPORT_RADIUS, currentFloor);

    // Grid size is (2*radius + 1) x (2*radius + 1)
    const gridSize = VIEWPORT_RADIUS * 2 + 1;

    // Render visible rooms (only show pawn on current player's room)
    const roomsHtml = visibleRooms.map((room) => {
        const roomConnections = connections[room.id] || {};
        const isCurrentRoom = room.id === myPosition;

        return renderRoomTile(
            room, 
            roomConnections,
            isCurrentRoom,
            centerX,
            centerY,
            VIEWPORT_RADIUS
        );
    }).join('');

    // Render room preview if in placement mode
    let previewHtml = '';
    if (roomPreview) {
        const gridCol = (roomPreview.x - centerX) + VIEWPORT_RADIUS + 1;
        const gridRow = -(roomPreview.y - centerY) + VIEWPORT_RADIUS + 1;
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

    // Get current room name for display
    const locationText = currentRoom ? currentRoom.name : 'Unknown';

    return `
        <div class="game-map">
            <div class="game-map__header">
                <span class="game-map__location">${locationText}</span>
            </div>
            <div class="game-map__grid" style="--grid-size: ${gridSize};">
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
