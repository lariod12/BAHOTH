/**
 * Property-Based Tests for VaultLayoutCalculator
 * 
 * Uses fast-check for property-based testing
 * Minimum 100 iterations per property test
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  getDoorSideAfterRotation,
  getDividerOrientation,
  getNearDoorZone,
  getFarDoorZone,
  calculateVaultLayout,
  calculateTokenPositions,
  calculatePlayerSpawnPosition,
  isPositionInZone
} from './vaultLayout.js';

// Generator for valid rotations
const rotationArb = fc.constantFrom(0, 90, 180, 270);

// Generator for room bounds with positive dimensions
const roomBoundsArb = fc.record({
  width: fc.integer({ min: 50, max: 200 }),
  height: fc.integer({ min: 50, max: 200 })
});

describe('VaultLayoutCalculator Property Tests', () => {
  /**
   * Property 2: Divider Orientation Matches Door Side
   * Feature: vault-room-event-logic, Property 2: Divider Orientation Matches Door Side
   * Validates: Requirements 2.1, 2.2, 2.3, 2.4
   */
  it('Property 2: divider orientation matches door side', () => {
    fc.assert(
      fc.property(rotationArb, (rotation) => {
        const layout = calculateVaultLayout(rotation);
        
        // Door at top or bottom -> horizontal divider
        // Door at left or right -> vertical divider
        if (layout.doorSide === 'top' || layout.doorSide === 'bottom') {
          return layout.dividerOrientation === 'horizontal';
        }
        return layout.dividerOrientation === 'vertical';
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1: Event Token Near-Door Zone Invariant
   * Feature: vault-room-event-logic, Property 1: Event Token Near-Door Zone Invariant
   * Validates: Requirements 1.1, 1.2, 1.3
   */
  it('Property 1: event token is always in near-door zone', () => {
    fc.assert(
      fc.property(rotationArb, roomBoundsArb, (rotation, bounds) => {
        const layout = calculateVaultLayout(rotation);
        const positions = calculateTokenPositions(layout, bounds);
        
        // Event token should be in near-door zone
        return isPositionInZone(positions.event, layout.nearDoorZone, bounds);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4: Item Tokens Opposite Zone from Event Token
   * Feature: vault-room-event-logic, Property 4: Item Tokens Opposite Zone from Event Token
   * Validates: Requirements 4.1, 4.2, 4.3
   */
  it('Property 4: item tokens are in far-door zone', () => {
    fc.assert(
      fc.property(rotationArb, roomBoundsArb, (rotation, bounds) => {
        const layout = calculateVaultLayout(rotation);
        const positions = calculateTokenPositions(layout, bounds);
        
        // All item tokens should be in far-door zone
        return positions.items.every(item => 
          isPositionInZone(item, layout.farDoorZone, bounds)
        );
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3: Player Spawn Zone Equals Event Token Zone
   * Feature: vault-room-event-logic, Property 3: Player Spawn Zone Equals Event Token Zone
   * Validates: Requirements 3.1, 3.6
   */
  it('Property 3: player spawns in same zone as event token', () => {
    fc.assert(
      fc.property(rotationArb, roomBoundsArb, (rotation, bounds) => {
        const layout = calculateVaultLayout(rotation);
        const tokenPositions = calculateTokenPositions(layout, bounds);
        const playerSpawn = calculatePlayerSpawnPosition(layout, bounds);
        
        // Player spawn should be in near-door zone (same as event token)
        const playerInNearZone = isPositionInZone(playerSpawn, layout.nearDoorZone, bounds);
        const eventInNearZone = isPositionInZone(tokenPositions.event, layout.nearDoorZone, bounds);
        
        return playerInNearZone && eventInNearZone;
      }),
      { numRuns: 100 }
    );
  });
});
