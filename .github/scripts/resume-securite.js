// Agrège les rapports déposés par les jobs de sécurité et écrit un tableau
// dans le résumé du run GitHub Actions.
//
// Principe : les lignes du tableau viennent des FICHIERS trouvés, pas des jobs.
// Un scanner ajouté dans un job existant apparaît donc sans qu'on touche à ce
// script. Seul un scanner logé dans un nouveau job impose d'ajouter une ligne
// au needs: du workflow, ce que GitHub Actions ne permet pas de contourner.
//
// Ce script ne doit jamais échouer : il ne bloque rien, le blocage est le
// travail des jobs de scanner eux-mêmes.

const fs = require("fs");

const DOSSIER = "rapports";
const ICONES = { ok: "✅", alerte: "⚠️", erreur: "❌" };

/** Liste les rapports réellement présents, sans supposer lesquels. */
function listerRapports() {
  try {
    return fs
      .readdirSync(DOSSIER)
      .filter((f) => f.startsWith("rapport-") && f.endsWith(".json"))
      .sort();
  } catch {
    // Dossier absent : aucun artefact récupéré, tous les jobs ont été sautés.
    return [];
  }
}

/** Une ligne de tableau par rapport, et la liste des scanners en défaut. */
function construireLignes(fichiers) {
  const lignes = [];
  const soucis = [];

  for (const fichier of fichiers) {
    try {
      const r = JSON.parse(fs.readFileSync(`${DOSSIER}/${fichier}`, "utf8"));
      const icone = ICONES[r.statut] || "❓";
      lignes.push(
        `| ${r.scanner} | ${icone} ${r.statut} | ${r.compte} ${r.unite} | ${r.detail || ""} |`
      );
      if (r.statut !== "ok") {
        soucis.push(r.scanner);
      }
    } catch (e) {
      // Un rapport illisible se signale, il ne fait pas tomber le résumé.
      lignes.push(`| \`${fichier}\` | ❌ erreur | rapport illisible | ${e.message} |`);
      soucis.push(fichier);
    }
  }

  return { lignes, soucis };
}

/**
 * Jobs qui n'ont pas abouti, lus dans toJSON(needs) : générique, aucun nom de
 * scanner n'est codé en dur ici.
 */
function listerJobsSansResultat() {
  let jobs;
  try {
    jobs = JSON.parse(process.env.RESULTATS_JOBS || "{}");
  } catch {
    return [];
  }
  return Object.entries(jobs)
    .filter(([, v]) => v && v.result !== "success")
    .map(([nom, v]) => `${nom} (${v.result})`);
}

/**
 * Le verdict dépend du contexte. Sur une pull request, aucune image n'est
 * publiée : les scans d'image sont hors périmètre, pas en panne. Sans cette
 * distinction, le résumé annoncerait « publiable en confiance » avec deux
 * lignes sur cinq, sans avoir jamais regardé ce qu'on livrerait.
 */
function construireVerdict(soucis, absents) {
  if (soucis.length) {
    return `❌ à ne pas publier : ${soucis.join(", ")}`;
  }
  if ((process.env.CONTEXTE || "publication") === "verification") {
    return absents.length
      ? "⚠️ vérifications de branche incomplètes"
      : "✅ vérifications de branche : OK (scans d'image hors périmètre)";
  }
  if (absents.length) {
    return "⚠️ incomplet : certains scanners n'ont pas produit de résultat";
  }
  return "✅ publiable en confiance";
}

function construireResume() {
  const { lignes, soucis } = construireLignes(listerRapports());
  const absents = listerJobsSansResultat();
  const verdict = construireVerdict(soucis, absents);

  const sortie = [
    "## Résumé de sécurité",
    "",
    "| Scanner | Statut | Résultat | Détail |",
    "| --- | --- | --- | --- |",
    ...(lignes.length ? lignes : ["| _aucun rapport récupéré_ | ❓ | | |"]),
    "",
    `**Verdict : ${verdict}**`,
    "",
  ];

  if (absents.length) {
    sortie.push("### Jobs sans résultat", "", ...absents.map((a) => `- ${a}`), "");
  }

  return sortie.join("\n");
}

const texte = construireResume();
console.log(texte);

if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${texte}\n`);
}
