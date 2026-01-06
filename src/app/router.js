import { renderHomeView } from './views/homeView.js';
import { renderTutorialBooksView } from './views/tutorialBooksView.js';
import { renderTraitorsTomeReferenceView } from './views/traitorsTomeReferenceView.js';

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

function navigateTo(hash) {
    const normalized = normalizeHash(hash);
    if (window.location.hash !== normalized) {
        window.location.hash = normalized;
    }
}

function renderRoute({ mountEl }) {
    const route = getRoute(window.location.hash);

    if (route === '/' || route === '/home') {
        renderHomeView({ mountEl, onNavigate: navigateTo });
        return;
    }

    if (route === '/tutorial') {
        renderTutorialBooksView({ mountEl, onNavigate: navigateTo });
        return;
    }

    if (route === '/tutorial/traitors-tome') {
        renderTraitorsTomeReferenceView({ mountEl, onNavigate: navigateTo });
        return;
    }

    // Fallback
    navigateTo('#/');
}

export function initRouter({ mountEl }) {
    window.addEventListener('hashchange', () => renderRoute({ mountEl }));
    renderRoute({ mountEl });
}


