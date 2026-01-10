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
 * Filter rooms to only those visible in viewport
 * @param {Record<string, Room>} rooms
 * @param {number} centerX
 * @param {number} centerY
 * @param {number} radius
 * @returns {Room[]}
 */
function filterVisibleRooms(rooms, centerX, centerY, radius) {
    const visible = [];
    for (const room of Object.values(rooms)) {
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

    // Calculate grid position relative to viewport (1-indexed for CSS grid)
    // Viewport is (2*radius + 1) x (2*radius + 1)
    const gridCol = (room.x - centerX) + radius + 1;
    const gridRow = -(room.y - centerY) + radius + 1; // Invert Y for CSS

    return `
        <div class="map-room ${floorClass} ${currentClass}" 
             data-room-id="${room.id}"
             style="grid-column: ${gridCol}; grid-row: ${gridRow};">
            <div class="map-room__inner">
                <span class="map-room__name">${room.name}</span>
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
 * @returns {string}
 */
export function renderGameMap(mapState, playerPositions, playerNames, myId, myPosition) {
    if (!mapState || !mapState.revealedRooms) {
        return `
            <div class="game-map game-map--empty">
                <p class="game-map__placeholder">Map loading...</p>
            </div>
        `;
    }

    const rooms = mapState.revealedRooms;
    const connections = mapState.connections || {};

    // Get player position to center viewport
    const playerCoords = getPlayerCoords(rooms, myPosition);
    const centerX = playerCoords.x;
    const centerY = playerCoords.y;

    // Filter rooms within viewport
    const visibleRooms = filterVisibleRooms(rooms, centerX, centerY, VIEWPORT_RADIUS);

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

    // Get current room name for display
    const currentRoom = myPosition ? rooms[myPosition] : null;
    const locationText = currentRoom ? currentRoom.name : 'Unknown';

    return `
        <div class="game-map">
            <div class="game-map__header">
                <span class="game-map__location">${locationText}</span>
            </div>
            <div class="game-map__grid" style="--grid-size: ${gridSize};">
                ${roomsHtml}
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
