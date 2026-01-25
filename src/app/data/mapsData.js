/**
 * Betrayal at House on the Hill (2nd Ed) - Rooms extracted from your images
 *
 * Icon mapping (confirmed by you):
 * - umbrella => 'omen'
 * - spiral   => 'event'
 * - horned skull => 'item'
 *
 * @typedef {'basement'|'ground'|'upper'} FloorKey
 * @typedef {'top'|'right'|'bottom'|'left'} DoorSide
 * @typedef {'omen'|'event'|'item'} TokenType
 *
 * @typedef {{ side: DoorSide; kind: 'door'; note?: string }} DoorDef
 * 
 * @typedef {{
 *   type: 'divided';
 *   dividerOrientation: 'parallel-to-door';
 *   zones: {
 *     nearDoor: { tokens: TokenType[]; playerSpawn: boolean };
 *     farDoor: { tokens: TokenType[] };
 *   };
 * }} SpecialLayout
 * 
 * @typedef {{
 *   name: { en: string; vi?: string };
 *   floorsAllowed: FloorKey[];
 *   doors: DoorDef[];
 *   tokens: TokenType[];
 *   text: { en?: string; vi?: string };
 *   notes?: string[];
 *   specialLayout?: SpecialLayout;
 * }} RoomDef
 */

/** @type {RoomDef[]} */
export const ROOMS = [
  // ===== STARTING ROOMS (fixed layout) =====
  {
    name: { en: 'Entrance Hall', vi: 'Lối vào sảnh chính (Entrance Hall)' },
    floorsAllowed: ['ground'],
    doors: [
      { side: 'top', kind: 'door' },
      { side: 'left', kind: 'door' },
      { side: 'right', kind: 'door' },
      { side: 'bottom', kind: 'front-door' }, // Front door - cannot exit
    ],
    tokens: [],
    text: {},
    notes: ['Starting tile. Front door (cannot exit).'],
    isStartingRoom: true,
  },
  {
    name: { en: 'Foyer', vi: 'Sảnh (Foyer)' },
    floorsAllowed: ['ground'],
    doors: [
      { side: 'top', kind: 'door' },
      { side: 'bottom', kind: 'door' },
      { side: 'left', kind: 'door' },
      { side: 'right', kind: 'door' },
    ],
    tokens: [],
    text: {},
    notes: ['Starting tile. Connects Entrance Hall to Grand Staircase.'],
    isStartingRoom: true,
  },
  {
    name: { en: 'Grand Staircase', vi: 'Cầu thang lớn (Grand Staircase)' },
    floorsAllowed: ['ground'],
    doors: [
      { side: 'bottom', kind: 'door' },
      { side: 'top', kind: 'stairs' }, // Leads to Upper Landing - not a regular door
    ],
    tokens: [],
    text: { en: 'Leads to Upper Landing', vi: 'Dẫn tới Chiếu nghỉ tầng trên' },
    notes: ['Starting tile. Connects to Upper Landing via stairs only.'],
    isStartingRoom: true,
  },

  // ===== FLOOR CARD (not a room tile) =====
  {
    name: { en: 'Basement', vi: 'Tầng hầm (Basement)' },
    floorsAllowed: ['basement'],
    doors: [],
    tokens: [],
    text: {},
    notes: ['This appears to be the Basement floor card, not a standard room tile.'],
  },

  // ===== SPECIAL CONNECTORS =====
  {
    name: { en: 'Stairs From Basement', vi: 'Cầu thang từ Tầng hầm (Stairs From Basement)' },
    floorsAllowed: ['basement'],
    doors: [
      { side: 'top', kind: 'door' }, // Only one door - connects to adjacent room
    ],
    tokens: [],
    text: { en: 'Leads to and from Foyer', vi: 'Dẫn tới/về từ Sảnh (Foyer)' },
    notes: ['Connects Basement <-> Foyer (special stair connection). Only has one door.'],
  },

  // ===== BASEMENT =====
  {
    name: { en: 'Catacombs', vi: 'Đường hầm (Catacombs)' },
    floorsAllowed: ['basement'],
    doors: [{ side: 'top', kind: 'door' }, { side: 'bottom', kind: 'door' }],
    tokens: ['omen'],
    text: {
      en: 'You can attempt a Sanity roll of 6+ to cross. If you fail, you stop moving.',
      vi: 'Bạn có thể thử roll Sanity 6+ để băng qua. Nếu thất bại, bạn dừng di chuyển.',
    },
  },
  {
    name: { en: 'Furnace Room', vi: 'Phòng lò (Furnace Room)' },
    floorsAllowed: ['basement'],
    doors: [{ side: 'top', kind: 'door' }, { side: 'bottom', kind: 'door' }, { side: 'left', kind: 'door' }],
    tokens: ['omen'],
    text: {
      en: 'If you end your turn here, take 1 point of physical damage.',
      vi: 'Nếu bạn kết thúc lượt ở đây, chịu 1 điểm sát thương thể chất.',
    },
  },
  {
    name: { en: 'Chasm', vi: 'Khe vực (Chasm)' },
    floorsAllowed: ['basement'],
    doors: [{ side: 'left', kind: 'door' }, { side: 'right', kind: 'door' }],
    tokens: [],
    text: {
      en: 'You can attempt a Speed roll of 3+ to cross. If you fail, you stop moving.',
      vi: 'Bạn có thể thử roll Speed 3+ để băng qua. Nếu thất bại, bạn dừng di chuyển.',
    },
  },
  {
    name: { en: 'Pentagram Chamber', vi: 'Phòng ngũ giác (Pentagram Chamber)' },
    floorsAllowed: ['basement'],
    doors: [{ side: 'top', kind: 'door' }, { side: 'right', kind: 'door' }],
    tokens: ['omen'],
    text: {
      en: 'When exiting, you must attempt a Knowledge roll of 4+. If you fail, lose 1 Sanity (but continue moving).',
      vi: 'Khi rời phòng, bạn phải thử roll Knowledge 4+. Nếu thất bại, mất 1 Sanity (nhưng vẫn tiếp tục di chuyển).',
    },
  },
  {
    name: { en: 'Underground Lake', vi: 'Hồ ngầm (Underground Lake)' },
    floorsAllowed: ['basement'],
    doors: [{ side: 'top', kind: 'door' }, { side: 'right', kind: 'door' }],
    tokens: ['event'],
    text: {},
  },
  {
    name: { en: 'Crypt', vi: 'Hầm mộ (Crypt)' },
    floorsAllowed: ['basement'],
    doors: [{ side: 'top', kind: 'door' }],
    tokens: ['event'],
    text: {
      en: 'If you end your turn here, take 1 point of mental damage.',
      vi: 'Nếu bạn kết thúc lượt ở đây, chịu 1 điểm sát thương tinh thần.',
    },
  },
  {
    name: { en: 'Wine Cellar', vi: 'Hầm rượu (Wine Cellar)' },
    floorsAllowed: ['basement'],
    doors: [{ side: 'top', kind: 'door' }, { side: 'bottom', kind: 'door' }],
    tokens: ['item'],
    text: {},
  },
  {
    name: { en: 'Larder', vi: 'Kho thực phẩm (Larder)' },
    floorsAllowed: ['basement'],
    doors: [{ side: 'top', kind: 'door' }],
    tokens: ['item'],
    text: {
      en: 'Once per game, if you end your turn here, gain 1 Might.',
      vi: 'Mỗi ván 1 lần, nếu bạn kết thúc lượt ở đây, tăng 1 Might.',
    },
  },

  // ===== GROUND =====
  {
    name: { en: 'Patio', vi: 'Sân hiên (Patio)' },
    floorsAllowed: ['ground'],
    doors: [{ side: 'top', kind: 'door' }, { side: 'bottom', kind: 'door' }, { side: 'left', kind: 'door' }],
    tokens: ['event'],
    text: {},
  },
  {
    name: { en: 'Gardens', vi: 'Vườn (Gardens)' },
    floorsAllowed: ['ground'],
    doors: [{ side: 'top', kind: 'door' }, { side: 'bottom', kind: 'door' }],
    tokens: ['event'],
    text: {},
  },
  {
    name: { en: 'Coal Chute', vi: 'Ống than (Coal Chute)' },
    floorsAllowed: ['ground'],
    doors: [{ side: 'top', kind: 'door' }],
    tokens: [],
    text: { en: 'One-way slide to Basement Landing', vi: 'Trượt 1 chiều tới Basement Landing' },
  },
  {
    name: { en: 'Dining Room', vi: 'Phòng ăn (Dining Room)' },
    floorsAllowed: ['ground'],
    doors: [{ side: 'top', kind: 'door' }, { side: 'right', kind: 'door' }],
    tokens: ['omen'],
    text: {},
  },
  {
    name: { en: 'Graveyard', vi: 'Nghĩa địa (Graveyard)' },
    floorsAllowed: ['ground'],
    doors: [{ side: 'bottom', kind: 'door' }],
    tokens: ['event'],
    text: {
      en: 'When exiting, you must attempt a Sanity roll of 4+. If you fail, lose 1 Knowledge (but continue moving).',
      vi: 'Khi rời phòng, bạn phải thử roll Sanity 4+. Nếu thất bại, mất 1 Knowledge (nhưng vẫn tiếp tục di chuyển).',
    },
  },
  {
    name: { en: 'Ballroom', vi: 'Phòng khiêu vũ (Ballroom)' },
    floorsAllowed: ['ground'],
    doors: [
      { side: 'top', kind: 'door' },
      { side: 'bottom', kind: 'door' },
      { side: 'left', kind: 'door' },
      { side: 'right', kind: 'door' },
    ],
    tokens: ['event'],
    text: {},
  },
  {
    name: { en: 'Kitchen', vi: 'Nhà bếp (Kitchen)' },
    floorsAllowed: ['ground'],
    doors: [{ side: 'top', kind: 'door' }, { side: 'right', kind: 'door' }],
    tokens: ['omen'],
    text: {},
  },

  // ===== MULTI-FLOOR (Basement/Ground/Upper) =====
  {
    name: { en: 'Vault', vi: 'Hầm két (Vault)' },
    floorsAllowed: ['basement', 'ground', 'upper'],
    doors: [{ side: 'top', kind: 'door' }],
    tokens: ['event', 'item', 'item'],
    text: {
      en: 'You can attempt a Knowledge roll of 6+ to open and empty the vault.',
      vi: 'Bạn có thể thử roll Knowledge 6+ để mở và lấy hết trong két.',
    },
    // Special layout: event token near door, divider line parallel to door
    specialLayout: {
      type: 'divided',
      dividerOrientation: 'parallel-to-door', // Line parallel to door side
      zones: {
        nearDoor: {
          tokens: ['event'],      // Event token in near-door zone
          playerSpawn: true       // Player spawns here
        },
        farDoor: {
          tokens: ['item', 'item'] // Item tokens in far-door zone
        }
      }
    }
  },
  {
    name: { en: 'Research Laboratory', vi: 'Phòng thí nghiệm nghiên cứu (Research Laboratory)' },
    floorsAllowed: ['basement', 'ground', 'upper'],
    doors: [{ side: 'top', kind: 'door' }, { side: 'bottom', kind: 'door' }],
    tokens: ['event'],
    text: {},
  },
  {
    name: { en: 'Operating Laboratory', vi: 'Phòng thí nghiệm phẫu thuật (Operating Laboratory)' },
    floorsAllowed: ['basement', 'ground', 'upper'],
    doors: [{ side: 'right', kind: 'door' }, { side: 'bottom', kind: 'door' }],
    tokens: ['event'],
    text: {},
  },
  {
    name: { en: 'Mystic Elevator', vi: 'Thang máy huyền bí (Mystic Elevator)' },
    floorsAllowed: ['basement', 'ground', 'upper'],
    doors: [{ side: 'top', kind: 'door' }],
    tokens: [],
    text: {
      en:
        'Once per turn, roll 2 dice and move this room next to any open door on:\n' +
        '4  Any floor\n' +
        '3  Upper floor\n' +
        '2  Ground floor\n' +
        '1  Basement\n' +
        '0  Basement, then take 1 die of physical damage',
      vi:
        'Mỗi lượt 1 lần, roll 2 xúc xắc và di chuyển phòng này cạnh bất kỳ cửa trống nào ở:\n' +
        '4  Bất kỳ tầng\n' +
        '3  Tầng trên (Upper)\n' +
        '2  Tầng trệt (Ground)\n' +
        '1  Tầng hầm (Basement)\n' +
        '0  Tầng hầm, rồi chịu 1 xúc xắc sát thương thể chất',
    },
  },
  {
    name: { en: 'Creaky Hallway', vi: 'Hành lang kẽo kẹt (Creaky Hallway)' },
    floorsAllowed: ['basement', 'ground', 'upper'],
    doors: [
      { side: 'top', kind: 'door' },
      { side: 'left', kind: 'door' },
      { side: 'right', kind: 'door' },
      { side: 'bottom', kind: 'door' },
    ],
    tokens: [],
    text: {},
  },
  {
    name: { en: 'Dusty Hallway', vi: 'Hành lang bụi bặm (Dusty Hallway)' },
    floorsAllowed: ['basement', 'ground', 'upper'],
    doors: [
      { side: 'top', kind: 'door' },
      { side: 'left', kind: 'door' },
      { side: 'right', kind: 'door' },
      { side: 'bottom', kind: 'door' },
    ],
    tokens: [],
    text: {},
  },
  {
    name: { en: 'Junk Room', vi: 'Phòng đồ đạc (Junk Room)' },
    floorsAllowed: ['basement', 'ground', 'upper'],
    doors: [
      { side: 'top', kind: 'door' },
      { side: 'left', kind: 'door' },
      { side: 'right', kind: 'door' },
      { side: 'bottom', kind: 'door' },
    ],
    tokens: ['omen'],
    text: {
      en: 'When exiting, you must attempt a Might roll of 3+. If you fail, lose 1 Speed (but continue moving).',
      vi: 'Khi rời phòng, bạn phải thử roll Might 3+. Nếu thất bại, mất 1 Speed (nhưng vẫn tiếp tục di chuyển).',
    },
  },
  {
    name: { en: 'Statuary Corridor', vi: 'Hành lang tượng (Statuary Corridor)' },
    floorsAllowed: ['basement', 'ground', 'upper'],
    doors: [{ side: 'top', kind: 'door' }, { side: 'bottom', kind: 'door' }],
    tokens: ['event'],
    text: {},
  },
  {
    name: { en: 'Game Room', vi: 'Phòng giải trí (Game Room)' },
    floorsAllowed: ['basement', 'ground', 'upper'],
    doors: [
      { side: 'top', kind: 'door' },
      { side: 'right', kind: 'door' },
      { side: 'bottom', kind: 'door' },
      { side: 'left', kind: 'door' },
    ],
    tokens: ['event'],
    text: {},
  },
  {
    name: { en: 'Organ Room', vi: 'Phòng đàn organ (Organ Room)' },
    floorsAllowed: ['basement', 'ground', 'upper'],
    doors: [{ side: 'left', kind: 'door' }, { side: 'bottom', kind: 'door' }],
    tokens: ['event'],
    text: {},
  },

  // ===== UPPER ONLY =====
  {
    name: { en: 'Gymnasium', vi: 'Phòng thể dục (Gymnasium)' },
    floorsAllowed: ['upper'],
    doors: [{ side: 'right', kind: 'door' }, { side: 'bottom', kind: 'door' }],
    tokens: ['omen'],
    text: {
      en: 'Once per game, if you end your turn here, gain 1 Speed.',
      vi: 'Mỗi ván 1 lần, nếu bạn kết thúc lượt ở đây, tăng 1 Speed.',
    },
  },
  {
    name: { en: 'Storeroom', vi: 'Kho chứa (Storeroom)' },
    floorsAllowed: ['upper'],
    doors: [{ side: 'top', kind: 'door' }],
    tokens: ['item'],
    text: {},
  },
  {
    name: { en: "Servants' Quarters", vi: "Phòng ở người hầu (Servants' Quarters)" },
    floorsAllowed: ['upper'],
    doors: [{ side: 'left', kind: 'door' }, { side: 'right', kind: 'door' }, { side: 'bottom', kind: 'door' }],
    tokens: ['omen'],
    text: {},
  },

  // ===== UPPER + GROUND =====
  {
    name: { en: 'Chapel', vi: 'Nhà nguyện (Chapel)' },
    floorsAllowed: ['ground', 'upper'],
    doors: [{ side: 'top', kind: 'door' }],
    tokens: ['event'],
    text: {
      en: 'Once per game, if you end your turn here, gain 1 Sanity.',
      vi: 'Mỗi ván 1 lần, nếu bạn kết thúc lượt ở đây, tăng 1 Sanity.',
    },
  },
  {
    name: { en: 'Charred Room', vi: 'Phòng cháy xém (Charred Room)' },
    floorsAllowed: ['ground', 'upper'],
    doors: [
      { side: 'top', kind: 'door' },
      { side: 'left', kind: 'door' },
      { side: 'right', kind: 'door' },
      { side: 'bottom', kind: 'door' },
    ],
    tokens: ['omen'],
    text: {},
  },
  {
    name: { en: 'Collapsed Room', vi: 'Phòng sụp (Collapsed Room)' },
    floorsAllowed: ['ground', 'upper'],
    doors: [
      { side: 'top', kind: 'door' },
      { side: 'left', kind: 'door' },
      { side: 'right', kind: 'door' },
      { side: 'bottom', kind: 'door' },
    ],
    tokens: [],
    text: {
      en: 'You must attempt a Speed roll of 5+ to avoid falling. If you fail the roll, draw a basement tile and put it in play. You fall there and take 1 die of physical damage.',
      vi: 'Bạn phải thử roll Speed 5+ để tránh rơi. Nếu thất bại, rút 1 tile Basement và đặt vào bàn. Bạn rơi xuống đó và chịu 1 xúc xắc sát thương thể chất.',
    },
  },
  {
    name: { en: 'Conservatory', vi: 'Nhà kính (Conservatory)' },
    floorsAllowed: ['ground', 'upper'],
    doors: [{ side: 'top', kind: 'door' }],
    tokens: ['event'],
    text: {},
  },
  {
    name: { en: 'Abandoned Room', vi: 'Phòng bỏ hoang (Abandoned Room)' },
    floorsAllowed: ['ground', 'upper'],
    doors: [
      { side: 'top', kind: 'door' },
      { side: 'left', kind: 'door' },
      { side: 'right', kind: 'door' },
      { side: 'bottom', kind: 'door' },
    ],
    tokens: ['omen'],
    text: {},
  },
  {
    name: { en: 'Bloody Room', vi: 'Phòng đẫm máu (Bloody Room)' },
    floorsAllowed: ['ground', 'upper'],
    doors: [
      { side: 'top', kind: 'door' },
      { side: 'left', kind: 'door' },
      { side: 'right', kind: 'door' },
      { side: 'bottom', kind: 'door' },
    ],
    tokens: ['item'],
    text: {},
  },
  {
    name: { en: 'Bedroom', vi: 'Phòng ngủ (Bedroom)' },
    floorsAllowed: ['upper'],
    doors: [
      { side: 'left', kind: 'door' },
      { side: 'right', kind: 'door' },
      { side: 'bottom', kind: 'door' },
    ],
    tokens: ['event'],
    text: {},
  },
  {
    name: { en: 'Master Bedroom', vi: 'Phòng ngủ chính (Master Bedroom)' },
    floorsAllowed: ['upper'],
    doors: [
      { side: 'top', kind: 'door' },
      { side: 'left', kind: 'door' },
      { side: 'bottom', kind: 'door' },
    ],
    tokens: ['omen'],
    text: {},
  },
  {
    name: { en: 'Gallery', vi: 'Phòng trưng bày (Gallery)' },
    floorsAllowed: ['upper'],
    doors: [
      { side: 'top', kind: 'door' },
      { side: 'bottom', kind: 'door' },
    ],
    tokens: ['omen'],
    text: {
      en: "You can choose to fall to the Ballroom if it's in the house. If you do, take 1 die of physical damage.",
      vi: 'Bạn có thể chọn rơi xuống Ballroom nếu Ballroom đã có trong nhà. Nếu rơi, chịu 1 xúc xắc sát thương thể chất.',
    },
  },
  {
    name: { en: 'Tower', vi: 'Tháp (Tower)' },
    floorsAllowed: ['upper'],
    doors: [
      { side: 'left', kind: 'door' },
      { side: 'right', kind: 'door' },
    ],
    tokens: ['event'],
    text: {
      en: 'You can attempt a Might roll of 3+ to cross. If you fail, you stop moving.',
      vi: 'Bạn có thể thử roll Might 3+ để băng qua. Nếu thất bại, bạn dừng di chuyển.',
    },
  },
  {
    name: { en: 'Attic', vi: 'Gác mái (Attic)' },
    floorsAllowed: ['upper'],
    doors: [{ side: 'bottom', kind: 'door' }],
    tokens: ['event'],
    text: {
      en: 'When exiting, you must attempt a Speed roll of 3+. If you fail, lose 1 Might (but continue moving).',
      vi: 'Khi rời phòng, bạn phải thử roll Speed 3+. Nếu thất bại, mất 1 Might (nhưng vẫn tiếp tục di chuyển).',
    },
  },
  {
    name: { en: 'Balcony', vi: 'Ban công (Balcony)' },
    floorsAllowed: ['upper'],
    doors: [
      { side: 'top', kind: 'door' },
      { side: 'bottom', kind: 'door' },
    ],
    tokens: ['omen'],
    text: {},
  },
  {
    name: { en: 'Basement Landing', vi: 'Chiếu nghỉ tầng hầm (Basement Landing)' },
    floorsAllowed: ['basement'],
    doors: [
      { side: 'top', kind: 'door' },
      { side: 'left', kind: 'door' },
      { side: 'right', kind: 'door' },
      { side: 'bottom', kind: 'door' },
    ],
    tokens: [],
    text: {},
    notes: ['Starting tile (Basement).'],
  },
  {
    name: { en: 'Upper Landing', vi: 'Chiếu nghỉ tầng trên (Upper Landing)' },
    floorsAllowed: ['upper'],
    doors: [
      { side: 'top', kind: 'door' },
      { side: 'left', kind: 'door' },
      { side: 'right', kind: 'door' },
      { side: 'bottom', kind: 'door' },
    ],
    tokens: [],
    text: { en: 'Stairs to Grand Staircase', vi: 'Cầu thang xuống Cầu thang lớn' },
    notes: ['Starting tile (Upper). Connects to Grand Staircase.'],
    isStartingRoom: true,
    stairsTo: 'grand-staircase',
  },
];
