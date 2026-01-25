# Betrayal at House on the Hill

Digital edition của board game Betrayal at House on the Hill (2nd Edition).

## Giới thiệu

Dự án này là phiên bản digital của board game Betrayal at House on the Hill, cho phép người chơi trải nghiệm game kinh dị khám phá ngôi nhà ma ám trên nền tảng web với chế độ multiplayer real-time.

**⚠️ Mobile First Design**: Dự án được thiết kế ưu tiên cho thiết bị di động, sau đó mở rộng cho desktop.

## Công nghệ

- **Frontend**: Vite + Vanilla JavaScript (ES6+)
- **Backend**: Node.js + Socket.IO
- **Real-time**: WebSocket communication
- **Testing**: Vitest + fast-check

## Quick Start

### Cài đặt dependencies

```bash
yarn install
```

### Chạy development

```bash
yarn dev
```

Server sẽ chạy tại: `http://localhost:5173`

### Build production

```bash
yarn build
yarn preview
```

Output được tạo trong folder `dist/` - sẵn sàng deploy static.

## Cấu trúc dự án

```
.
├── src/
│   ├── index.html              # Entry point
│   ├── main.js                 # App initialization
│   ├── style.css               # Global styles
│   └── app/                    # Application source code
│       ├── router.js           # Hash-based client router
│       ├── components/         # Reusable UI components
│       ├── views/              # Page-level views
│       ├── services/           # External integrations (Socket.IO)
│       ├── data/               # Game data (characters, rooms, cards)
│       └── utils/              # Utility functions
├── server/                     # Backend managers
├── boardgame_rules.md          # Full game rules (Vietnamese)
└── README.md                   # This file
```

📖 **Chi tiết cấu trúc `src/app`**: Xem [src/app/README.md](./src/app/README.md) để hiểu:
- Architecture patterns và design principles
- Chi tiết từng file/folder và dependencies
- Data flow diagrams và component hierarchy
- Hướng dẫn cho contributors

## Game Modes

### 1. Multiplayer Mode (Production)

Chế độ chơi chính với nhiều người qua Socket.IO:

```
http://localhost:5173/#/home              # Landing page
http://localhost:5173/#/room              # Tạo phòng mới
http://localhost:5173/#/room/BAH-XXX      # Vào phòng có sẵn
http://localhost:5173/#/game/BAH-XXX      # Vào game đang chơi
```

**Flow:**
1. Tạo/vào phòng → Chọn nhân vật → Chờ người chơi sẵn sàng
2. Host bắt đầu game → Tất cả người chơi roll dice (turn order)
3. Lượt chơi: Di chuyển → Khám phá phòng → Rút thẻ → Kết thúc lượt
4. Tiếp tục cho đến khi Haunt bắt đầu

### 2. Debug Mode (Local Testing)

Chế độ test local với 3-6 players trên cùng 1 máy, **không cần server**:

```
http://localhost:5173/#/game/debug
```

**Đặc điểm:**
- 3 players với characters ngẫu nhiên
- Map khởi tạo sẵn: Entrance Hall → Foyer → Grand Staircase
- Click vào turn order để switch giữa players
- Dùng cùng logic với multiplayer mode
- Không cần Socket.IO connection

**Khi nào dùng:**
- Test UI/UX changes nhanh
- Develop features mà không cần nhiều người
- Debug game logic (movement, dice rolls, etc.)

## Features

✅ **Đã hoàn thành:**
- Character selection (12 characters với bilingual support)
- Turn-based movement system
- Room discovery và placement với rotation
- Token drawing (Omen/Event/Item cards)
- Viewport-based map rendering (5x5 grid)
- Character trait tracking và adjustment
- Special room layouts (Vault với zone-based tokens)
- Floor transitions (stairs giữa các tầng)
- Active player indicator (mũi tên chỉ người chơi hiện tại)
- Dice event modal (nhập số hoặc random 0-16)
- Debug mode cho local testing
- Real-time multiplayer synchronization

🚧 **Đang phát triển:**
- **Event Cards Implementation (13/45 completed - 29%)** - [Chi tiết progress](./EVENT_CARDS_IMPLEMENTATION.md)
- Haunt phase implementation
- Combat system
- Token placement system
- Game save/load

## Tài liệu

- 📘 **[boardgame_rules.md](./boardgame_rules.md)** - Luật chơi đầy đủ (Vietnamese)
- 📖 **[src/app/README.md](./src/app/README.md)** - Chi tiết technical architecture
- 📋 **[EVENT_CARDS_IMPLEMENTATION.md](./EVENT_CARDS_IMPLEMENTATION.md)** - Event cards implementation progress (13/45 done)

## Development

### Running Tests

```bash
yarn test
```

Tests sử dụng property-based testing (Vitest + fast-check) cho complex logic.

### Code Structure

Dự án sử dụng **functional component pattern** với:
- HTML string generation qua template literals
- Manual DOM manipulation sau rendering
- Module-level state management
- Socket.IO cho real-time sync

Chi tiết: Xem [src/app/README.md](./src/app/README.md)

## Contributing

1. Fork repo
2. Tạo feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

**Đọc trước khi contribute:**
- [src/app/README.md](./src/app/README.md) - Architecture guide
- [boardgame_rules.md](./boardgame_rules.md) - Game rules

## License

Dự án này được tạo cho mục đích giáo dục và giải trí.

---

**Last Updated**: 2025-01-25 (Event Cards Implementation: 13/45 completed)