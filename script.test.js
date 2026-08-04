// Import des éléments exportés par script.js
const {
  handleGameButton,
  handleResetButton,
  getScore,
} = require("./script.js");

describe("ClickFast", () => {
  let buttonClicker;
  let buttonReset;
  let scoreDisplay;
  let timerDisplay;

  beforeEach(() => {
    // Faux timers : on maîtrise le temps au lieu d'attendre 5 vraies secondes
    jest.useFakeTimers();

    // 1. Notre "faux DOM", recréé avant chaque test
    document.body.innerHTML = `
      <div id="score">0</div>
      <div id="timer">5</div>
      <button id="button-clicker">Click me!</button>
      <button id="button-reset">Reset</button>
    `;

    // 2. Appel de nos fonctions JS.
    //    On les appelle à la main : dans jsdom, l'événement DOMContentLoaded
    //    est déjà passé quand le test s'exécute, il ne se déclenchera jamais.
    handleGameButton();
    handleResetButton();

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

    test("augmente de 1 après un clic", () => {
      buttonClicker.click();

      expect(getScore()).toBe(1);
      expect(scoreDisplay.textContent).toBe("1");
    });

    test("vaut 5 après cinq clics", () => {
      for (let i = 0; i < 5; i++) {
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

    test("atteint 0 après 5 secondes", () => {
      buttonClicker.click();
      jest.advanceTimersByTime(5000);

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

    test("le score n'augmente plus après la fin", () => {
      buttonClicker.click();
      buttonClicker.click();
      jest.advanceTimersByTime(5000);

      buttonClicker.click();

      expect(getScore()).toBe(2);
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
    test("remet le score à 0", () => {
      buttonClicker.click();
      buttonClicker.click();

      buttonReset.click();

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
});
