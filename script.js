// ---------------------------------------------------------------
// Variables du jeu
// ---------------------------------------------------------------
const DUREE = 5; // durée d'une partie, en secondes
const API_URL = "https://672e1217229a881691eed80f.mockapi.io/scores";

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

/** Branche le formulaire d'envoi du score au scoreboard. */
function handleScoreForm() {
  const form = document.getElementById("score-form");
  const status = document.getElementById("submit-status");

  form.addEventListener("submit", async (event) => {
    // Sans ça, le navigateur rechargerait la page et on perdrait le score
    event.preventDefault();

    const username = document.getElementById("username").value.trim();
    if (username === "") {
      status.textContent = "Choisis un pseudo avant d'envoyer.";
      return;
    }

    status.textContent = "Envoi en cours…";

    try {
      await submitScore(username, score);
      status.textContent = `Score de ${score} envoyé, bravo ${username} !`;
      await displayScores();
    } catch {
      status.textContent = "L'envoi a échoué, réessaie dans un instant.";
    }
  });
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

  // La partie est finie : on autorise l'envoi du score au scoreboard
  document.getElementById("button-submit").disabled = false;
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

  // On ne peut envoyer un score qu'à la fin d'une partie
  document.getElementById("button-submit").disabled = true;
  document.getElementById("submit-status").textContent = "";
}

/**
 * `score` est une variable interne au fichier. On l'expose via une fonction :
 * exporter la variable directement n'en donnerait qu'une copie figée à 0.
 */
function getScore() {
  return score;
}

// ---------------------------------------------------------------
// Scoreboard : appels à l'API
// ---------------------------------------------------------------

/** Récupère la liste complète des scores (GET). */
async function fetchScores() {
  const response = await fetch(API_URL);

  if (!response.ok) {
    throw new Error("Impossible de récupérer les scores");
  }

  return response.json();
}

/**
 * Supprime les scores déjà enregistrés sous ce pseudo (DELETE).
 * L'API n'a pas de filtre par username : on récupère tout, puis on filtre
 * côté JS avant de supprimer ligne par ligne.
 */
async function deleteScoresByUsername(username) {
  const scores = await fetchScores();
  const anciens = scores.filter((entry) => entry.username === username);

  for (const entry of anciens) {
    const response = await fetch(`${API_URL}/${entry.id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      console.error(`Suppression impossible pour l'id ${entry.id}`);
    }
  }
}

/** Envoie un score (POST), en remplaçant l'ancien score du joueur. */
async function submitScore(username, points) {
  // Un seul score par pseudo : on efface l'ancien avant d'envoyer le nouveau
  await deleteScoresByUsername(username);

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      createdAt: new Date().toISOString(),
      username,
      avatar: `https://api.dicebear.com/9.x/bottts/svg?seed=${encodeURIComponent(
        username
      )}`,
      score: points,
      website_url: "sebg2rd.github.io/ClickFast",
    }),
  });

  if (!response.ok) {
    throw new Error("Impossible d'envoyer le score");
  }

  return response.json();
}

// ---------------------------------------------------------------
// Scoreboard : affichage
// ---------------------------------------------------------------

/** Affiche le top 10 des scores, du meilleur au moins bon. */
async function displayScores() {
  const list = document.getElementById("scoreboard");
  list.innerHTML = "<li>Chargement du scoreboard…</li>";

  try {
    const scores = await fetchScores();
    const classement = scores
      .slice() // copie : on ne veut pas trier le tableau d'origine
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    list.innerHTML = "";

    for (const entry of classement) {
      list.appendChild(buildScoreLine(entry));
    }
  } catch {
    list.innerHTML = "<li>Scoreboard indisponible pour le moment</li>";
  }
}

/** Construit une ligne <li> du scoreboard. */
function buildScoreLine(entry) {
  const line = document.createElement("li");
  line.className = "score-line";

  const avatar = document.createElement("img");
  avatar.src = entry.avatar;
  avatar.alt = "";
  avatar.className = "avatar";

  const name = document.createElement("span");
  name.className = "score-name";
  // textContent et non innerHTML : les pseudos viennent d'une API publique,
  // du HTML dans un pseudo serait sinon interprété par le navigateur.
  name.textContent = entry.username;

  const points = document.createElement("span");
  points.className = "score-points";
  points.textContent = `${entry.score}`;

  line.append(avatar, name, points);

  return line;
}

// ---------------------------------------------------------------
// Démarrage dans le navigateur
// ---------------------------------------------------------------
// On attend que le DOM soit chargé, sinon getElementById renverrait null.
document.addEventListener("DOMContentLoaded", () => {
  handleGameButton();
  handleResetButton();
  handleScoreForm();
  displayScores();
});

// Export pour Jest. Le test `typeof module` évite un plantage dans le
// navigateur, où la variable `module` n'existe pas.
if (typeof module !== "undefined") {
  module.exports = {
    API_URL,
    handleGameButton,
    handleResetButton,
    handleScoreForm,
    getScore,
    fetchScores,
    deleteScoresByUsername,
    submitScore,
    displayScores,
  };
}
