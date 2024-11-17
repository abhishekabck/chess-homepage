// Define sound paths
const moveSound = new Audio('/sounds/move.mp3');  // Ensure the path is correct

// Trigger sound when a move is made
function playMoveSound() {
    moveSound.play();
}

// Hook the move sound to your chess logic (replace this with your chessboard's event)
board.on('move', function (oldPos, newPos) {
    playMoveSound();
});
