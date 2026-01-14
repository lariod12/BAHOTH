function renderTutorialBooksMarkup() {
    return `
        <div class="welcome-container">
            <div class="welcome-content welcome-content--page">
                <p class="welcome-kicker">TUTORIAL</p>
                <h2 class="page-title">Choose a book</h2>
                <p class="page-subtitle">Select one of the three rule books from the board game.</p>

                <div class="page-actions">
                    <button class="action-button action-button--primary" data-book="traitors-tome">TRAITORS TOME</button>
                    <button class="action-button action-button--secondary" data-book="survival">SURVIVAL</button>
                    <button class="action-button action-button--secondary" data-book="rulesbook">RULESBOOK</button>
                </div>

                <div class="page-footer">
                    <button class="link-button" type="button" data-action="back">Back</button>
                </div>
            </div>
        </div>
    `.trim();
}

export function renderTutorialBooksView({ mountEl, onNavigate }) {
    mountEl.innerHTML = renderTutorialBooksMarkup();

    const backButton = mountEl.querySelector('[data-action="back"]');
    backButton?.addEventListener('click', () => {
        const returnRoute = sessionStorage.getItem('tutorialReturnRoute');
        if (returnRoute) {
            sessionStorage.removeItem('tutorialReturnRoute');
            onNavigate(returnRoute);
        } else {
            onNavigate('#/');
        }
    });

    const bookButtons = Array.from(mountEl.querySelectorAll('[data-book]'));
    for (const button of bookButtons) {
        button.addEventListener('click', () => {
            const book = button.getAttribute('data-book');
            console.log(`Tutorial book selected: ${book}`);
            if (book === 'traitors-tome') {
                onNavigate('#/tutorial/traitors-tome');
                return;
            }

            if (book === 'survival') {
                onNavigate('#/tutorial/survival');
                return;
            }

            if (book === 'rulesbook') {
                onNavigate('#/tutorial/rulesbook');
                return;
            }

            alert('Content coming soon...');
        });
    }
}


