import { renderHomeView } from './views/homeView.js';
import { renderRoomView } from './views/roomView.js';
import { renderGameView } from './views/game/index.js';
import { renderTutorialBooksView } from './views/tutorialBooksView.js';
import { renderTraitorsTomeReferenceView } from './views/traitorsTomeReferenceView.js';
import { renderRulesBookReferenceView } from './views/rulesBookReferenceView.js';

function normalizeHash(rawHash) {
    const hash = (rawHash || '').trim();
    if (!hash || hash === '#') return '#/';
    if (!hash.startsWith('#')) return `#${hash}`;
    return hash;
}

function getRoute(hash) {
    const normalized = normalizeHash(hash);
    const route = normalized.replace(/^#/, '');
    return route.startsWith('/') ? route : `/${route}`;
}

/**
 * Parse route and extract params
 * @param {string} route
 * @returns {{ path: string; params: Record<string, string> }}
 */
function parseRoute(route) {
    // Match /room/:roomId pattern
    const roomMatch = route.match(/^\/room\/([A-Z0-9-]+)$/i);
    if (roomMatch) {
        return { path: '/room/:roomId', params: { roomId: roomMatch[1] } };
    }

    // Match /game/debug and /game/solo-debug first (before generic :roomId)
    if (route === '/game/debug') {
        return { path: '/game/debug', params: {} };
    }

    if (route === '/game/solo-debug' || route === '/game/SOLO_DEBUG') {
        return { path: '/game/solo-debug', params: {} };
    }

    // Match /game/:roomId pattern
    const gameMatch = route.match(/^\/game\/([A-Z0-9-]+)$/i);
    if (gameMatch) {
        return { path: '/game/:roomId', params: { roomId: gameMatch[1] } };
    }

    return { path: route, params: {} };
}

function navigateTo(hash) {
    const normalized = normalizeHash(hash);
    if (window.location.hash !== normalized) {
        window.location.hash = normalized;
    }
}

function renderRoute({ mountEl }) {
    const route = getRoute(window.location.hash);
    const { path, params } = parseRoute(route);

    if (path === '/' || path === '/home') {
        renderHomeView({ mountEl, onNavigate: navigateTo });
        return;
    }

    // Room with specific ID: /room/XXXXXX
    if (path === '/room/:roomId') {
        renderRoomView({ mountEl, onNavigate: navigateTo, roomId: params.roomId });
        return;
    }

    // Room without ID (create new room)
    if (path === '/room') {
        renderRoomView({ mountEl, onNavigate: navigateTo, roomId: null });
        return;
    }

    // Game with specific ID: /game/XXXXXX
    if (path === '/game/:roomId') {
        renderGameView({ mountEl, onNavigate: navigateTo, roomId: params.roomId });
        return;
    }

    // Debug mode: /game/debug - 2 players, 2 tabs
    if (path === '/game/debug') {
        renderGameView({ mountEl, onNavigate: navigateTo, roomId: null, debugMode: true });
        return;
    }

    // Solo debug mode: /game/solo-debug - 1 tab, 2 virtual players, switch between them
    if (path === '/game/solo-debug') {
        renderGameView({ mountEl, onNavigate: navigateTo, roomId: 'SOLO_DEBUG', soloDebug: true });
        return;
    }

    if (path === '/tutorial') {
        renderTutorialBooksView({ mountEl, onNavigate: navigateTo });
        return;
    }

    if (path === '/tutorial/traitors-tome') {
        renderTraitorsTomeReferenceView({ mountEl, onNavigate: navigateTo });
        return;
    }

    if (path === '/tutorial/survival') {
        renderTraitorsTomeReferenceView({ mountEl, onNavigate: navigateTo });
        return;
    }

    if (path === '/tutorial/rulesbook') {
        renderRulesBookReferenceView({ mountEl, onNavigate: navigateTo });
        return;
    }

    // Fallback
    navigateTo('#/');
}

export function initRouter({ mountEl }) {
    window.addEventListener('hashchange', () => renderRoute({ mountEl }));
    renderRoute({ mountEl });
}
