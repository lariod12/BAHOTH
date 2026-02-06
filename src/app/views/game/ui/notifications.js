// Toast / notification utilities
export function showToast(message, type = 'info', duration = 3000) {
    const existing = document.querySelectorAll('.game-toast');
    existing.forEach(t => t.remove());

    const toast = document.createElement('div');
    toast.className = `game-toast game-toast--${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('is-visible'));

    setTimeout(() => {
        toast.classList.remove('is-visible');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

export function showDebugWaitingPopup() {
    if (document.querySelector('.debug-waiting-popup')) return;
    const popup = document.createElement('div');
    popup.className = 'debug-waiting-popup';
    popup.innerHTML = `
        <div class="debug-waiting-popup__content">
            <h3>Che do Debug</h3>
            <p>Dang cho nguoi choi thu 2 ket noi...</p>
            <p class="debug-waiting-popup__hint">Mo them 1 tab/cua so khac de vao phong debug</p>
        </div>
    `;
    document.body.appendChild(popup);
}

export function removeDebugWaitingPopup() {
    const popup = document.querySelector('.debug-waiting-popup');
    if (popup) popup.remove();
}
