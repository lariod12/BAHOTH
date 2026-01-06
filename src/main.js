// Main entry point for Betrayal at House on the Hill

const playButton = document.getElementById('playButton');
const tutorialButton = document.getElementById('tutorialButton');

playButton?.addEventListener('click', () => {
    console.log('Play button clicked!');
    // TODO: Navigate to game screen
    alert('Game starting soon...');
});

tutorialButton?.addEventListener('click', () => {
    console.log('Tutorial button clicked!');
    // TODO: Navigate to tutorial screen
    alert('Tutorial coming soon...');
});

// Initialize app
console.log('Betrayal at House on the Hill - Game initialized');

