# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Digital edition of the board game "Betrayal at House on the Hill" built with Vanilla JavaScript, Vite, and Socket.IO for real-time multiplayer gameplay. Mobile-first design with bilingual support (Vietnamese/English).

## Commands

```bash
# Install dependencies
yarn install

# Development server (http://localhost:5173)
yarn dev

# Run tests (Vitest + fast-check property-based testing)
yarn test
yarn test:watch

# Production build
yarn build
yarn preview

# Clear all game data
yarn clean
```

## Debug Mode

Test locally without server at `http://localhost:5173/#/game/debug` - 3 local players with random characters, click turn order to switch players.

## Architecture

### Tech Stack
- **Frontend**: Vite + Vanilla JavaScript (ES6+) - no frameworks
- **Backend**: Node.js + Socket.IO (via Vite plugin)
- **Testing**: Vitest + fast-check (property-based)

### Directory Structure

```
src/app/
├── router.js           # Hash-based client router
├── components/         # Reusable UI (GameMap.js - viewport rendering)
├── views/              # Page-level views (gameView.js is 4000+ lines)
├── services/           # socketClient.js - Socket.IO wrapper
├── data/               # Static game data (characters, rooms, cards)
└── utils/              # Pure functions (vaultLayout.js, factionUtils.js)

server/
├── vite-socket-plugin.js  # Socket.IO integration with Vite
├── roomManager.js         # Room/lobby management
├── playerManager.js       # Player state management
└── mapManager.js          # Game map state management
```

### Core Patterns

**Functional Component Pattern** - All views follow:
```javascript
export function renderView({ mountEl, onNavigate, ...props }) {
  const html = `<div>...</div>`;    // 1. Generate HTML string
  mountEl.innerHTML = html;          // 2. Inject into DOM
  button.addEventListener('click', handleClick);  // 3. Attach events
  socketClient.onGameState((state) => { ... });   // 4. Subscribe to updates
}
```

**State Management** - No centralized store:
- Module-level variables for view state
- Socket.IO server as source of truth
- Event-driven updates trigger re-renders

**Real-Time Sync Flow**:
```
User Action → Event Handler → Socket Emit → Server Processing
→ Socket Broadcast → Event Listener → State Update → Re-render
```

### Key Files

| File | Purpose |
|------|---------|
| [gameView.js](src/app/views/gameView.js) | Main gameplay (152KB, most complex) |
| [GameMap.js](src/app/components/GameMap.js) | 5x5 viewport-based map rendering |
| [socketClient.js](src/app/services/socketClient.js) | Socket.IO client wrapper |
| [vaultLayout.js](src/app/utils/vaultLayout.js) | Vault room zone calculations |
| [factionUtils.js](src/app/utils/factionUtils.js) | Haunt/faction system utilities |

## Required Reading Before Changes

1. **Always read first**: [src/app/README.md](src/app/README.md) - Comprehensive technical docs
2. For `src/app/` changes, read the README to understand architecture patterns

## Code Conventions

### Bilingual Support
```javascript
// All text supports Vietnamese/English
{ name: { en: "Madame Zostra", vi: "Madame Zostra" } }
// Display Vietnamese by default
const displayName = item.name.vi || item.name.en;
```

### File Organization
- Views in `views/` (full-page components)
- Reusable components in `components/`
- Game data in `data/` (characters, rooms, cards)
- Pure utility functions in `utils/`
- External integrations in `services/`

### Testing
- Test files next to source: `myFile.js` → `myFile.test.js`
- Property-based testing with fast-check for complex logic
- Focus on pure utility functions, skip UI testing

### What NOT to Do
- Use React/Vue/other frameworks
- Create centralized state stores (Redux/Zustand)
- Directly modify game state (always go through Socket.IO)
- Add large dependencies without discussion

## README Update Protocol

After completing ANY feature/fix, check if READMEs need updates:
- `README.md` (root) - User-facing features, setup changes
- `src/app/README.md` - Technical architecture, file structure, dependencies

## Claude Skills

This project includes Claude skills for playing the board game:
- `/play-bahoth` - AI plays as a character using MCP tools from `bahoth-game-info` server
- `/bahoth-recorder` - AI observes/records game state without playing

MCP Server: `bahoth-game-info` provides 70+ tools for game data and gameplay management (defined in `.mcp.json`).

## Git Commit Format

```
<type>(<scope>): <subject>

Co-Authored-By: Claude <model>
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`
Scopes: `gameView`, `roomView`, `gameMap`, `socketClient`, `data`, `utils`
