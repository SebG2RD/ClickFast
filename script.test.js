// Import des éléments exportés par script.js
const {
  API_URL,
  handleGameButton,
  handleResetButton,
  handleScoreForm,
  getScore,
  fetchScores,
  submitScore,
  displayScores,
} = require("./script.js");

/**
 * Le gestionnaire de soumission est asynchrone : dispatchEvent rend la main
 * avant la fin des appels réseau. On laisse tourner les microtâches pour que
 * les promesses (déjà résolues par nos mocks) aient le temps de s'enchaîner.
 */
async function flushPromises() {
  for (let i = 0; i < 20; i++) {
    await Promise.resolve();
  }
}

describe("ClickFast", () => {
  let buttonClicker;
  let buttonReset;
  let scoreDisplay;
  let timerDisplay;

  beforeEach(() => {
    // Faux timers : on maîtrise le temps au lieu d'attendre 5 vraies secondes
    jest.useFakeTimers();

    // jsdom ne fournit pas fetch : on le remplace par une fonction espionne,
    // ce qui évite aussi d'appeler la vraie API pendant les tests.
    global.fetch = jest.fn();

    // 1. Notre "faux DOM", recréé avant chaque test
    document.body.innerHTML = `
      <div id="score">0</div>
      <div id="timer">5</div>
      <button id="button-clicker">Click me!</button>
      <button id="button-reset">Reset</button>
      <form id="score-form">
        <input type="text" id="username" />
        <button id="button-submit" type="submit" disabled>Envoyer</button>
      </form>
      <p id="submit-status"></p>
      <ol id="scoreboard"></ol>
    `;

    // 2. Appel de nos fonctions JS.
    //    On les appelle à la main : dans jsdom, l'événement DOMContentLoaded
    //    est déjà passé quand le test s'exécute, il ne se déclenchera jamais.
    handleGameButton();
    handleResetButton();
    handleScoreForm();

    buttonClicker = document.getElementById("button-clicker");
    buttonReset = document.getElementById("button-reset");
    scoreDisplay = document.getElementById("score");
    timerDisplay = document.getElementById("timer");
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("Le score", () => {
    test("vaut 0 avant le premier clic", () => {
      expect(getScore()).toBe(0);
      expect(scoreDisplay.textContent).toBe("0");
    });

    test("Vérifiez que le score s'incrémente correctement", () => {
      // Un seul clic
      buttonClicker.click();
      expect(getScore()).toBe(2);
      expect(scoreDisplay.textContent).toBe("2");

      // Puis plusieurs clics d'affilée
      for (let i = 0; i < 4; i++) {
        buttonClicker.click();
      }
      expect(getScore()).toBe(5);
      expect(scoreDisplay.textContent).toBe("5");
    });
  });

  describe("Le chrono", () => {
    test("ne démarre pas tant qu'aucun clic n'a eu lieu", () => {
      jest.advanceTimersByTime(3000);

      expect(timerDisplay.textContent).toBe("5");
      expect(jest.getTimerCount()).toBe(0);
    });

    test("démarre au premier clic", () => {
      buttonClicker.click();
      jest.advanceTimersByTime(1000);

      expect(timerDisplay.textContent).toBe("4");
    });

    test("n'est pas relancé par les clics suivants", () => {
      buttonClicker.click();
      buttonClicker.click();
      buttonClicker.click();
      jest.advanceTimersByTime(1000);

      // Sans le garde `if (timer === null)`, trois intervalles tourneraient
      // en parallèle et le compte à rebours descendrait 3x trop vite.
      expect(timerDisplay.textContent).toBe("4");
      expect(jest.getTimerCount()).toBe(1);
    });

    test("Vérifiez que le timer décompte correctement", () => {
      // Un clic pour démarrer le jeu
      buttonClicker.click();

      // On avance le temps seconde par seconde
      jest.advanceTimersByTime(1000);
      expect(timerDisplay.textContent).toBe("4");

      jest.advanceTimersByTime(1000);
      expect(timerDisplay.textContent).toBe("3");

      // Puis jusqu'à la fin de la partie
      jest.advanceTimersByTime(3000);
      expect(timerDisplay.textContent).toBe("0");
    });
  });

  describe("La fin de partie", () => {
    test("le bouton reste actif pendant le temps imparti", () => {
      buttonClicker.click();
      jest.advanceTimersByTime(4999);

      expect(buttonClicker.disabled).toBe(false);
    });

    test("le bouton est désactivé une fois le temps écoulé", () => {
      buttonClicker.click();
      jest.advanceTimersByTime(5000);

      expect(buttonClicker.disabled).toBe(true);
    });

    test("l'intervalle est bien nettoyé", () => {
      buttonClicker.click();
      jest.advanceTimersByTime(5000);

      expect(jest.getTimerCount()).toBe(0);
    });

    test("Vérifiez que le score ne s'incrémente pas après la fin du timer", () => {
      // Des clics pour démarrer le jeu et marquer des points
      buttonClicker.click();
      buttonClicker.click();
      expect(getScore()).toBe(2);

      // On attend l'expiration du timer, puis on réessaie de cliquer
      jest.advanceTimersByTime(5000);
      buttonClicker.click();

      // Le score n'a pas bougé : le bouton désactivé n'écoute plus les clics
      expect(getScore()).toBe(2);
      expect(scoreDisplay.textContent).toBe("2");
    });

    test("le score final est affiché sur le bouton", () => {
      for (let i = 0; i < 7; i++) {
        buttonClicker.click();
      }
      jest.advanceTimersByTime(5000);

      expect(buttonClicker.textContent).toContain("7");
    });
  });

  describe("Le bouton reset", () => {
    test("Vérifiez que le bouton de réinitialisation remet le score à zéro", () => {
      // Quelques clics pour augmenter le score
      buttonClicker.click();
      buttonClicker.click();
      buttonClicker.click();

      // Le score est bien supérieur à zéro
      expect(getScore()).toBeGreaterThan(0);

      // Clic sur le bouton de réinitialisation
      buttonReset.click();

      // Le score a été remis à zéro
      expect(getScore()).toBe(0);
      expect(scoreDisplay.textContent).toBe("0");
    });

    test("remet le chrono à 5 et l'arrête", () => {
      buttonClicker.click();
      jest.advanceTimersByTime(2000);

      buttonReset.click();

      expect(timerDisplay.textContent).toBe("5");
      expect(jest.getTimerCount()).toBe(0);
    });

    test("réactive le bouton après une partie terminée", () => {
      buttonClicker.click();
      jest.advanceTimersByTime(5000);
      expect(buttonClicker.disabled).toBe(true);

      buttonReset.click();

      expect(buttonClicker.disabled).toBe(false);
      expect(buttonClicker.textContent).toBe("Clique !");
    });

    test("permet de relancer une partie complète", () => {
      buttonClicker.click();
      jest.advanceTimersByTime(5000);
      buttonReset.click();

      buttonClicker.click();
      jest.advanceTimersByTime(1000);

      expect(getScore()).toBe(1);
      expect(timerDisplay.textContent).toBe("4");
    });
  });

  describe("Le scoreboard (API)", () => {
    // Alice apparaît deux fois : c'est le doublon que submitScore doit nettoyer
    const faussesDonnees = [
      { id: "1", username: "Alice", score: 12, avatar: "alice.png" },
      { id: "2", username: "Bob", score: 47, avatar: "bob.png" },
      { id: "3", username: "Alice", score: 30, avatar: "alice.png" },
    ];

    test("fetchScores récupère la liste des scores", async () => {
      fetch.mockResolvedValue({ ok: true, json: async () => faussesDonnees });

      const scores = await fetchScores();

      expect(fetch).toHaveBeenCalledWith(API_URL);
      expect(scores).toHaveLength(3);
    });

    test("fetchScores lève une erreur si l'API répond mal", async () => {
      fetch.mockResolvedValue({ ok: false });

      await expect(fetchScores()).rejects.toThrow(
        "Impossible de récupérer les scores"
      );
    });

    test("submitScore remplace l'ancien score du joueur", async () => {
      fetch
        .mockResolvedValueOnce({ ok: true, json: async () => faussesDonnees })
        .mockResolvedValueOnce({ ok: true }) // DELETE de l'id 1
        .mockResolvedValueOnce({ ok: true }) // DELETE de l'id 3
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "4" }) });

      await submitScore("Alice", 42);

      // 1 GET + 2 DELETE (Alice était présente deux fois) + 1 POST
      expect(fetch).toHaveBeenCalledTimes(4);
      expect(fetch).toHaveBeenNthCalledWith(2, `${API_URL}/1`, {
        method: "DELETE",
      });
      expect(fetch).toHaveBeenNthCalledWith(3, `${API_URL}/3`, {
        method: "DELETE",
      });

      // Le score de Bob ne doit pas être touché
      const idsSupprimes = fetch.mock.calls
        .filter(([, options]) => options?.method === "DELETE")
        .map(([url]) => url);
      expect(idsSupprimes).not.toContain(`${API_URL}/2`);

      const [url, options] = fetch.mock.calls[3];
      const corps = JSON.parse(options.body);
      expect(url).toBe(API_URL);
      expect(options.method).toBe("POST");
      expect(corps.username).toBe("Alice");
      expect(corps.score).toBe(42);
    });

    test("displayScores affiche les joueurs du meilleur au moins bon", async () => {
      fetch.mockResolvedValue({ ok: true, json: async () => faussesDonnees });

      await displayScores();

      const lignes = document.querySelectorAll("#scoreboard li");
      expect(lignes).toHaveLength(3);
      expect(lignes[0].textContent).toContain("Bob");
      expect(lignes[0].textContent).toContain("47");
      expect(lignes[2].textContent).toContain("12");
    });

    test("displayScores prévient quand l'API est injoignable", async () => {
      fetch.mockRejectedValue(new Error("réseau indisponible"));

      await displayScores();

      expect(document.getElementById("scoreboard").textContent).toContain(
        "indisponible"
      );
    });

    test("le pseudo est inséré en texte, jamais interprété en HTML", async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: async () => [
          {
            id: "9",
            username: "<img src=x onerror=alert(1)>",
            score: 5,
            avatar: "x.png",
          },
        ],
      });

      await displayScores();

      const nom = document.querySelector(".score-name");
      expect(nom.textContent).toBe("<img src=x onerror=alert(1)>");
      expect(nom.querySelector("img")).toBeNull();
    });
  });

  describe("Le formulaire d'envoi", () => {
    test("le bouton d'envoi n'est actif qu'à la fin de la partie", () => {
      const buttonSubmit = document.getElementById("button-submit");
      expect(buttonSubmit.disabled).toBe(true);

      buttonClicker.click();
      jest.advanceTimersByTime(5000);

      expect(buttonSubmit.disabled).toBe(false);
    });

    test("le bouton d'envoi est à nouveau bloqué après un reset", () => {
      buttonClicker.click();
      jest.advanceTimersByTime(5000);

      buttonReset.click();

      expect(document.getElementById("button-submit").disabled).toBe(true);
    });

    test("refuse un pseudo vide sans appeler l'API", () => {
      const form = document.getElementById("score-form");
      form.dispatchEvent(
        new Event("submit", { cancelable: true, bubbles: true })
      );

      expect(document.getElementById("submit-status").textContent).toContain(
        "pseudo"
      );
      expect(fetch).not.toHaveBeenCalled();
    });

    test("envoie le score du joueur puis rafraîchit le classement", async () => {
      // Une partie complète de 2 clics
      document.getElementById("username").value = "Seb";
      buttonClicker.click();
      buttonClicker.click();
      jest.advanceTimersByTime(5000);

      fetch
        .mockResolvedValueOnce({ ok: true, json: async () => [] }) // GET (nettoyage)
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "1" }) }) // POST
        .mockResolvedValueOnce({
          ok: true, // GET (réaffichage du classement)
          json: async () => [
            { id: "1", username: "Seb", score: 2, avatar: "seb.png" },
          ],
        });

      document
        .getElementById("score-form")
        .dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
      await flushPromises();

      const corps = JSON.parse(fetch.mock.calls[1][1].body);
      expect(corps.username).toBe("Seb");
      expect(corps.score).toBe(2);

      expect(document.getElementById("submit-status").textContent).toContain(
        "Seb"
      );
      expect(document.querySelectorAll("#scoreboard li")).toHaveLength(1);
    });

    test("prévient le joueur si l'envoi échoue", async () => {
      document.getElementById("username").value = "Seb";
      fetch.mockRejectedValue(new Error("réseau indisponible"));

      document
        .getElementById("score-form")
        .dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
      await flushPromises();

      expect(document.getElementById("submit-status").textContent).toContain(
        "échoué"
      );
    });
  });
});
