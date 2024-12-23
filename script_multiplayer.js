var board1 = Chessboard('myBoard', 'start');
// NOTE: this example uses the chess.js library:
// https://github.com/jhlywa/chess.js

var board = null;
var game = new Chess();
var $status = $('#status');
var $fen = $('#fen');
var $pgn = $('#pgn');
let c_player = null;
let currentMatchTime = null;
let timerInstance = null;

function startTimer(seconds, container, oncomplete) {
  let startTime, timer, obj, ms = seconds * 1000,
      display = document.getElementById(container);
  
  obj = {};
  
  obj.resume = function () {
    startTime = new Date().getTime();
    timer = setInterval(obj.step, 250); // Adjust the granularity (lower is more CPU-expensive)
  };

  obj.pause = function () {
    ms = obj.step();
    clearInterval(timer);
  };

  obj.step = function () {
    let now = Math.max(0, ms - (new Date().getTime() - startTime)),
        m = Math.floor(now / 60000), s = Math.floor(now / 1000) % 60;
    s = (s < 10 ? "0" : "") + s;
    display.innerHTML = m + ":" + s;
    if (now === 0) {
      clearInterval(timer);
      obj.resume = function () {};  // Disable further resume once the timer hits 0
      if (oncomplete) oncomplete();
    }
    return now;
  };

  obj.resume();
  return obj;
}

function onDragStart(source, piece, position, orientation) {
  if (game.turn() !== c_player) {
    return false;
  }

  // Do not pick up pieces if the game is over
  if (game.game_over()) return false;

  // Only pick up pieces for the side to move
  if ((game.turn() === 'w' && piece.search(/^b/) !== -1) ||
    (game.turn() === 'b' && piece.search(/^w/) !== -1)) {
    return false;
  }
}

function onDrop(source, target) {
  // See if the move is legal
  var move = game.move({
    from: source,
    to: target,
    promotion: 'q' // Always promote to a queen for simplicity
  });

  // Illegal move
  if (move === null) return 'snapback';

  socket.emit('sync_state', game.fen(), game.turn());
  
  // Pause or start timer
  if (timerInstance) {
    timerInstance.pause();
  } else {
    timerInstance = startTimer(Number(currentMatchTime) * 60, "timerDisplay", function () { alert("Done!"); });
  }
  updateStatus();
}

function onChange() {
  if (game.game_over()) {
    if (game.in_checkmate()) {
      const winner = game.turn() === 'b' ? 'White' : 'Black';
      socket.emit('game_over', winner);
    }
  }
}

// Update the board position after the piece snap
// For castling, en passant, pawn promotion
function onSnapEnd() {
  board.position(game.fen());
}

function updateStatus() {
  var status = '';
  var moveColor = 'White';
  if (game.turn() === 'b') {
    moveColor = 'Black';
  }

  // Checkmate?
  if (game.in_checkmate()) {
    status = 'Game over, ' + moveColor + ' is in checkmate.';
  }
  // Draw?
  else if (game.in_draw()) {
    status = 'Game over, drawn position';
  }
  // Game still on
  else {
    status = moveColor + ' to move';

    // Check?
    if (game.in_check()) {
      status += ', ' + moveColor + ' is in check';
    }
  }

  $status.html(status);
  $fen.html(game.fen());
  $pgn.html(game.pgn());
}

var config = {
  draggable: true,
  position: 'start',
  onDragStart: onDragStart,
  onDrop: onDrop,
  onChange: onChange,
  onSnapEnd: onSnapEnd
};

board = Chessboard('myBoard', config);

updateStatus();

// Handle timer button clicks
function handleButtonClick(event) {
  const timer = Number(event.target.getAttribute('data-time'));
  socket.emit('want_to_play', timer);
  $('#main-element').hide();
  $('#waiting_text_p').show();
}

document.addEventListener('DOMContentLoaded', function () {
  const buttons = document.getElementsByClassName('timer-button');
  for (let index = 0; index < buttons.length; index++) {
    const button = buttons[index];
    button.addEventListener('click', handleButtonClick);
  }
});

const socket = io('http://localhost:3000');

// Update the total player count
socket.on('total_players_count_change', function (totalPlayersCount) {
  $('#total_players').html('Total Players: ' + totalPlayersCount);
});

// When a match is made
socket.on("match_made", (color, time) => {
  c_player = color;
  $('#main-element').show();
  $('#waiting_text_p').hide();
  const currentPlayer = color === 'b' ? 'Black' : 'White';
  $('#buttonsParent').html("<p id='youArePlayingAs'>You are Playing as " + currentPlayer + "</p><p id='timerDisplay'></p>");
  $('#buttonsParent').addClass('flex-col');  // Use flex-col layout for buttons

  // Show 'you are playing as' with animation
  $('#youArePlayingAs').hide().fadeIn(1000);  // jQuery animation

  game.reset();
  board.clear();
  board.start();
  board.orientation(currentPlayer.toLowerCase());

  currentMatchTime = time;

  if (game.turn() === c_player) {
    timerInstance = startTimer(Number(time) * 60, "timerDisplay", function () { alert("Done!"); });
  } else {
    timerInstance = null;
    $('#timerDisplay').html(currentMatchTime + ":00");
  }
});

// Sync the state from the server when a move is made
socket.on('sync_state_from_server', function (fen, turn) {
  game.load(fen);
  game.setTurn(turn);
  board.position(fen);

  // Restart the timer if required
  if (timerInstance) {
    timerInstance.resume();
  } else {
    timerInstance = startTimer(Number(currentMatchTime) * 60, "timerDisplay", function () { alert("Done!"); });
  }
});

// Handle game over from server
socket.on('game_over_from_server', function (winner) {
  alert(winner + " won the match");
  // Optionally reload the page or redirect
  // window.location.reload();
});
