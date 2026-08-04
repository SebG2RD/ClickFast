// ---------------------------------------------------------------
// Variables du jeu
// ---------------------------------------------------------------
const DUREE = 5; // durée d'une partie, en secondes

let score = 0;
let timeLeft = DUREE;
let timer = null; // id du setInterval, null tant qu'aucune partie n'est lancée

// ---------------------------------------------------------------
// Mise en place des boutons
// ---------------------------------------------------------------

/** Branche le bouton de clic et remet le jeu dans son état initial. */
function handleGameButton() {
  const buttonClicker = document.getElementById("button-clicker");

  buttonClicker.addEventListener("click", () => {
    // Le premier clic lance le chrono
    if (timer === null) {
      startTimer();
    }

    score++;
    document.getElementById("score").textContent = `${score}`;
  });

  resetGame();
}

/** Branche le bouton de remise à zéro. */
function handleResetButton() {
  const buttonReset = document.getElementById("button-reset");

  buttonReset.addEventListener("click", resetGame);
}

// ---------------------------------------------------------------
// Logique du jeu
// ---------------------------------------------------------------

function startTimer() {
  timer = setInterval(() => {
    timeLeft--;
    document.getElementById("timer").textContent = `${timeLeft}`;

    if (timeLeft <= 0) {
      stopGame();
    }
  }, 1000);
}

function stopGame() {
  clearInterval(timer);

  const buttonClicker = document.getElementById("button-clicker");
  buttonClicker.disabled = true;
  buttonClicker.textContent = `Terminé ! ${score} clics 🎉`;
}

function resetGame() {
  clearInterval(timer);
  timer = null;
  score = 0;
  timeLeft = DUREE;

  document.getElementById("score").textContent = `${score}`;
  document.getElementById("timer").textContent = `${timeLeft}`;

  const buttonClicker = document.getElementById("button-clicker");
  buttonClicker.disabled = false;
  buttonClicker.textContent = "Clique !";
}

/**
 * `score` est une variable interne au fichier. On l'expose via une fonction :
 * exporter la variable directement n'en donnerait qu'une copie figée à 0.
 */
function getScore() {
  return score;
}

// ---------------------------------------------------------------
// Démarrage dans le navigateur
// ---------------------------------------------------------------
// On attend que le DOM soit chargé, sinon getElementById renverrait null.
document.addEventListener("DOMContentLoaded", () => {
  handleGameButton();
  handleResetButton();
});

// Export pour Jest. Le test `typeof module` évite un plantage dans le
// navigateur, où la variable `module` n'existe pas.
if (typeof module !== "undefined") {
  module.exports = { handleGameButton, handleResetButton, getScore };
}
