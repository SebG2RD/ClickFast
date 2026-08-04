// Récupération des éléments du DOM
const button = document.getElementById("button-clicker");
const countDisplay = document.getElementById("count");
const timeDisplay = document.getElementById("time");

// 1. La variable count, qui stocke le nombre de clics
let count = 0;

// Variables du chrono
const DUREE = 5; // durée de la partie en secondes
let timeLeft = DUREE;
let timer = null; // identifiant du setInterval, null tant que la partie n'a pas démarré

// 2. L'eventListener sur le bouton
button.addEventListener("click", () => {
  // Le premier clic lance le chrono
  if (timer === null) {
    startTimer();
  }

  count++;
  countDisplay.textContent = `${count}`;
});

function startTimer() {
  timer = setInterval(() => {
    timeLeft--;
    timeDisplay.textContent = `${timeLeft}`;

    if (timeLeft <= 0) {
      stopGame();
    }
  }, 1000);
}

function stopGame() {
  clearInterval(timer);
  button.disabled = true;
  button.textContent = `Terminé ! ${count} clics 🎉`;
}
