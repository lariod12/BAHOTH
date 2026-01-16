/**
 * VaultLayoutCalculator Module
 * 
 * Handles special layout calculations for Vault room:
 * - Event token always adjacent to door
 * - Divider line parallel to door
 * - Player spawns in near-door zone
 * - Item tokens in far-door zone
 */

const VALID_ROTATIONS = [0, 90, 180, 270];
const SIDES = ['top', 'right', 'bottom', 'left'];

/**
 * Validate rotation value
 * @param {number} rotation - Rotation angle
 * @returns {number} - Valid rotation (defaults to 0 if invalid)
 */
export function validateRotation(rotation) {
  if (!VALID_ROTATIONS.includes(rotation)) {
    console.warn(`Invalid rotation ${rotation}, defaulting to 0`);
    return 0;
  }
  return rotation;
}

/**
 * Get door side after rotation
 * @param {string} originalSide - Original door side (default 'top' for Vault)
 * @param {number} rotation - Rotation angle (0, 90, 180, 270)
 * @returns {string} - Rotated door side ('top', 'right', 'bottom', 'left')
 */
export function getDoorSideAfterRotation(originalSide, rotation) {
  const validRotation = validateRotation(rotation);
  const originalIndex = SIDES.indexOf(originalSide);
  
  if (originalIndex === -1) {
    console.warn(`Invalid original side ${originalSide}, defaulting to 'top'`);
    return SIDES[(validRotation / 90) % 4];
  }
  
  const rotationSteps = validRotation / 90;
  const newIndex = (originalIndex + rotationSteps) % 4;
  return SIDES[newIndex];
}

/**
 * Get divider line orientation based on door side
 * Divider is always parallel to door
 * @param {string} doorSide - Door side after rotation
 * @returns {'horizontal' | 'vertical'}
 */
export function getDividerOrientation(doorSide) {
  if (doorSide === 'top' || doorSide === 'bottom') {
    return 'horizontal';
  }
  return 'vertical';
}

/**
 * Get near-door zone identifier
 * Near-door zone is the half of the room adjacent to the door
 * @param {string} doorSide - Door side
 * @returns {string} - Zone identifier ('top-half', 'bottom-half', 'left-half', 'right-half')
 */
export function getNearDoorZone(doorSide) {
  const zoneMap = {
    'top': 'top-half',
    'bottom': 'bottom-half',
    'left': 'left-half',
    'right': 'right-half'
  };
  return zoneMap[doorSide] || 'top-half';
}

/**
 * Get far-door zone identifier
 * Far-door zone is the half of the room opposite to the door
 * @param {string} doorSide - Door side
 * @returns {string} - Zone identifier
 */
export function getFarDoorZone(doorSide) {
  const oppositeMap = {
    'top': 'bottom-half',
    'bottom': 'top-half',
    'left': 'right-half',
    'right': 'left-half'
  };
  return oppositeMap[doorSide] || 'bottom-half';
}

/**
 * Calculate complete Vault room layout based on rotation
 * @param {number} rotation - Room rotation (0, 90, 180, 270)
 * @returns {VaultLayout} - Complete layout configuration
 */
export function calculateVaultLayout(rotation) {
  const validRotation = validateRotation(rotation);
  const doorSide = getDoorSideAfterRotation('top', validRotation);
  const dividerOrientation = getDividerOrientation(doorSide);
  const nearDoorZone = getNearDoorZone(doorSide);
  const farDoorZone = getFarDoorZone(doorSide);
  
  return {
    doorSide,
    dividerOrientation,
    nearDoorZone,
    farDoorZone,
    eventTokenPosition: nearDoorZone,
    itemTokensPosition: farDoorZone,
    playerSpawnZone: nearDoorZone
  };
}

/**
 * Get zone center coordinates based on zone identifier
 * @param {string} zone - Zone identifier ('top-half', 'bottom-half', 'left-half', 'right-half')
 * @param {Object} roomBounds - Room boundaries {width, height}
 * @returns {Object} - Center position {x, y}
 */
export function getZoneCenter(zone, roomBounds) {
  const { width, height } = roomBounds;
  const centerX = width / 2;
  const centerY = height / 2;
  
  const zoneCenters = {
    'top-half': { x: centerX, y: height * 0.25 },
    'bottom-half': { x: centerX, y: height * 0.75 },
    'left-half': { x: width * 0.25, y: centerY },
    'right-half': { x: width * 0.75, y: centerY }
  };
  
  return zoneCenters[zone] || { x: centerX, y: centerY };
}

/**
 * Check if a position is within a specific zone
 * @param {Object} position - Position {x, y}
 * @param {string} zone - Zone identifier
 * @param {Object} roomBounds - Room boundaries {width, height}
 * @returns {boolean}
 */
export function isPositionInZone(position, zone, roomBounds) {
  const { x, y } = position;
  const { width, height } = roomBounds;
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  
  switch (zone) {
    case 'top-half':
      return y < halfHeight;
    case 'bottom-half':
      return y >= halfHeight;
    case 'left-half':
      return x < halfWidth;
    case 'right-half':
      return x >= halfWidth;
    default:
      return false;
  }
}

/**
 * Calculate token positions within Vault room
 * Event token positioned in nearDoorZone center
 * Item tokens positioned in farDoorZone with offset
 * @param {VaultLayout} layout - Calculated layout from calculateVaultLayout()
 * @param {Object} roomBounds - Room boundaries {width, height}
 * @returns {TokenPositions} - {event: Position, items: Position[]}
 */
export function calculateTokenPositions(layout, roomBounds) {
  const { width, height } = roomBounds;
  
  // Validate room bounds
  if (!width || !height || width <= 0 || height <= 0) {
    throw new Error('Room bounds must have positive width and height');
  }
  
  const nearZoneCenter = getZoneCenter(layout.nearDoorZone, roomBounds);
  const farZoneCenter = getZoneCenter(layout.farDoorZone, roomBounds);
  
  // Item token offset (15px apart from each other)
  const itemOffset = 15;
  
  // Calculate item positions based on divider orientation
  let itemPositions;
  if (layout.dividerOrientation === 'horizontal') {
    // Items side by side horizontally
    itemPositions = [
      { x: farZoneCenter.x - itemOffset, y: farZoneCenter.y },
      { x: farZoneCenter.x + itemOffset, y: farZoneCenter.y }
    ];
  } else {
    // Items stacked vertically
    itemPositions = [
      { x: farZoneCenter.x, y: farZoneCenter.y - itemOffset },
      { x: farZoneCenter.x, y: farZoneCenter.y + itemOffset }
    ];
  }
  
  return {
    event: nearZoneCenter,
    items: itemPositions
  };
}

/**
 * Calculate player spawn position when entering Vault room
 * Player spawns in near-door zone, slightly offset from zone center
 * @param {VaultLayout} layout - Calculated layout from calculateVaultLayout()
 * @param {Object} roomBounds - Room boundaries {width, height}
 * @returns {Object} - Spawn position {x, y}
 */
export function calculatePlayerSpawnPosition(layout, roomBounds) {
  const { width, height } = roomBounds;
  
  // Validate room bounds
  if (!width || !height || width <= 0 || height <= 0) {
    throw new Error('Room bounds must have positive width and height');
  }
  
  const centerX = width / 2;
  const centerY = height / 2;
  
  // Player spawns in near-door zone, at 30% from the door side
  // This places them closer to the door than the zone center (25%)
  const spawnOffsets = {
    'top-half': { x: centerX, y: height * 0.3 },
    'bottom-half': { x: centerX, y: height * 0.7 },
    'left-half': { x: width * 0.3, y: centerY },
    'right-half': { x: width * 0.7, y: centerY }
  };
  
  return spawnOffsets[layout.playerSpawnZone] || { x: centerX, y: centerY };
}

export default {
  validateRotation,
  getDoorSideAfterRotation,
  getDividerOrientation,
  getNearDoorZone,
  getFarDoorZone,
  calculateVaultLayout,
  getZoneCenter,
  isPositionInZone,
  calculateTokenPositions,
  calculatePlayerSpawnPosition
};
