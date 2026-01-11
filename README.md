# Betrayal at House on the Hill

Digital edition của board game Betrayal at House on the Hill (2nd Edition).

## Mô tả

Dự án này là phiên bản digital của board game Betrayal at House on the Hill, cho phép người chơi trải nghiệm game trên web.

## Lưu ý

**⚠️ Mobile First Design**: Dự án này được thiết kế theo phương pháp **Mobile First**, ưu tiên tối ưu hóa giao diện và trải nghiệm cho thiết bị di động. Giao diện sẽ được phát triển với mobile làm mục tiêu chính, sau đó mở rộng cho desktop.

## Công nghệ

- **Vite** - Build tool và dev server
- **Vanilla JavaScript** - Không sử dụng framework
- **HTML/CSS** - Giao diện web

## Cài đặt

```bash
yarn install
```

hoặc đơn giản:

```bash
yarn
```

## Chạy development server

```bash
yarn dev
```

## Build cho production

```bash
yarn build
```

Output sẽ được tạo trong folder `dist/` - sẵn sàng để deploy static.

## Preview build

```bash
yarn preview
```

## Cấu trúc dự án

```
.
├── src/
│   ├── index.html          # Entry HTML
│   ├── main.js             # Main JavaScript
│   ├── style.css           # Styles
│   └── app/
│       ├── router.js       # Client-side routing
│       ├── views/          # View components
│       ├── components/     # Reusable components
│       ├── services/       # Socket client, etc.
│       └── data/           # Static data files
├── server/                 # Backend managers
├── dist/                   # Build output (generated)
├── package.json
├── vite.config.js
└── README.md
```

## Game Modes

### Main Game (Multiplayer)

Chế độ chơi chính với nhiều người qua Socket.IO:

```
http://localhost:5173/#/room          # Tạo phòng mới
http://localhost:5173/#/room/BAH-XXX  # Vào phòng có sẵn
http://localhost:5173/#/game/BAH-XXX  # Vào game đang chơi
```

### Debug Mode (Local Testing)

Chế độ debug cho phép test game với 3 players trên cùng 1 máy, **không cần kết nối server**:

```
http://localhost:5173/#/game/debug
```

**Đặc điểm Debug Mode:**
- 3 players với characters ngẫu nhiên
- Map khởi tạo sẵn: Entrance Hall → Foyer → Grand Staircase
- Click vào turn order để switch giữa các players
- Dùng **cùng logic** với main game (dice roll, movement, turn order)
- Không cần Socket.IO connection

**Khi nào dùng Debug Mode:**
- Test UI/UX mới
- Test game logic (movement, dice, turns)
- Develop features mà không cần nhiều người chơi
- Debug issues nhanh chóng

**Shared Logic giữa Debug và Main:**

| Feature | Debug Mode | Main Game |
|---------|------------|-----------|
| Dice Roll | `handleDebugDiceRoll()` | `socketClient.rollDice()` |
| Movement | `handleDebugMove()` | `socketClient.move()` |
| Turn Order | Local state | Server state |
| Map Connections | Same logic | Same logic |
| Character Speed | `getCharacterSpeed()` | `getCharacterSpeed()` |

Cả hai modes đều sử dụng:
- `renderGameScreen()` - Render UI
- `renderDiceRollOverlay()` - Dice roll phase
- `renderSidebar()`, `renderPlayerBar()` - Player info
- `mapDirectionToDoor()` - Direction mapping
- Map connections logic để validate movement

## Luật chơi

Xem file [rules.md](./rules.md) để biết luật chơi chi tiết.

## License

Dự án này được tạo cho mục đích giáo dục và giải trí.

