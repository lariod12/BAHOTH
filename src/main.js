import { initRouter } from './app/router.js';

const appRoot = document.getElementById('app');

if (!appRoot) {
    throw new Error('Missing #app root element');
}

initRouter({ mountEl: appRoot });

console.log('Betrayal at House on the Hill - App initialized');

