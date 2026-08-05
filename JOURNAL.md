# Journal de bord de la pipeline ClickFast

## Tableau de bord

Mesures relevées sur la branche `mesure-cache`, deux runs consécutifs ne
différant que par la présence de `cache: npm` sur `actions/setup-node`.

| Run | Durée totale | Job `test` | Taille de l'image |
| --- | --- | --- | --- |
| Avant cache (`30922710430`) | 34 s | 19 s | 92,7 Mo |
| Après cache (`30923316942`) | 32 s | 13 s | 92,7 Mo |
| **Écart** | **-2 s** | **-6 s** | n/a |

La taille de l'image ne dépend pas du cache npm : le conteneur nginx ne
contient que `index.html`, `script.js` et `style.css`. Elle est mesurée en
local avec `docker images clickfast`.

## Détail par étape

Les durées de job entières incluent l'attente d'un runner et le `checkout`,
qui varient d'un run à l'autre. Voici les étapes réellement affectées par le
cache :

| Étape | Sans cache | Avec cache |
| --- | --- | --- |
| `Installer les dépendances` (job lint) | 4 s | 3 s |
| `Installer les dépendances` (job test) | 9 s | 4 s |
| `Installer Node.js` (job lint) | 1 s | 3 s |
| `Installer Node.js` (job test) | 3 s | 4 s |
| **Total installation** | **17 s** | **14 s** |

## Analyse

L'écart est positif mais modeste : environ 6 s gagnées sur `npm ci`, dont 3 s
reperdues à restaurer l'archive du cache dans l'étape `Installer Node.js`.
Gain net d'environ 3 s par run.

Ce n'est pas un défaut de configuration. Le log confirme que le cache
fonctionne comme prévu :

```text
Cache hit for: node-cache-Linux-x64-npm-64a5effc452ceb...
Cache restored successfully
Cache hit occurred on the primary key, not saving cache.
```

La clé est trouvée, l'archive est restaurée, et rien n'est réécrit inutilement.
L'écart reste faible parce que l'arbre de dépendances est petit : 427 paquets,
soit 4 s de téléchargement sur un runner GitHub. Le gain spectaculaire évoqué
en cours (30 s à 8 s) suppose un projet où le téléchargement domine largement
le temps d'installation.

## Points de vigilance vérifiés

**Un cache partagé ne remplace jamais le contenu du `package-lock.json`.**
La clé de cache intègre le hash du lockfile
(`node-cache-Linux-x64-npm-<hash>`) : deux branches aux dépendances
différentes obtiennent donc deux clés différentes. Et même sur une clé
partagée, ce qui est mis en cache est `~/.npm`, le dossier de téléchargement,
pas `node_modules`. `npm ci` supprime puis reconstruit `node_modules`
strictement à partir du lockfile, d'où les mêmes 427 paquets installés dans
les deux runs. Une dépendance absente du `package.json` ne peut pas apparaître
par ce biais.

**Un commit qui ne touche pas aux dépendances profite pleinement du cache.**
Le second run de mesure ne modifiait que `ci.yml`. Le lockfile étant
inchangé, la clé primaire est identique et le log affiche `Cache hit`, sans
repli sur une clé partielle.

## Taille de l'image publiée

| Mesure | Taille |
| --- | --- |
| Locale, décompressée (`docker images`) | 92,7 Mo |
| Publiée sur Docker Hub, compressée | 24,9 Mo |

L'écart est normal : Docker Hub stocke et transfère les couches compressées,
alors que `docker images` affiche la taille une fois décompressée sur le
disque. C'est la seconde valeur qui détermine le temps de téléchargement d'un
déploiement.

Premier artefact publié : `nghtmre/clickfast:2c766fc31ae2d029764cc1b663a03a47605ff347`.

## Scénarios de publication vérifiés

| Scénario | Run | Résultat |
| --- | --- | --- |
| Push sur `main`, tests verts | `30924519010` | Lint ✅ Test ✅ Build & Push ✅, tag `2c766fc...` |
| Second push sur `main` | `30924700170` | tag `76844ac...`, distinct du précédent |
| Pull request #1 | `30924897416` | Lint ✅ Test ✅ **Build & Push `skipped`**, aucun tag ajouté |
| Secret mal orthographié | `30925276021` | Lint ✅ Test ✅ **Build & Push ❌** |

**Deux push, deux images.** Les tags publiés valent exactement le sha de leur
commit, donc chaque push produit un artefact distinct et traçable. Si les deux
runs avaient produit le même tag, c'est que le champ `tags:` n'aurait pas été
branché sur `${{ github.sha }}`.

**Une pull request ne publie rien.** La condition
`if: github.event_name == 'push' && github.ref == 'refs/heads/main'` fait
apparaître le job en `skipped` plutôt qu'en échec : la pipeline reste verte,
mais rien n'est envoyé sur le registre.

**Un secret introuvable échoue tard et localement.** Avec
`DOCKERHUB_TOKENN` au lieu de `DOCKERHUB_TOKEN`, GitHub ne signale aucune
erreur de syntaxe : l'expression est simplement remplacée par une chaîne vide.
L'échec n'apparaît qu'à l'exécution de `docker/login-action` :

```text
username: ***
##[error]Password required
```

`lint` et `test` étant déjà terminés, seul `build-and-push` tombe. C'est
l'intérêt de découper la pipeline en jobs : l'échec désigne l'étape fautive au
lieu de teinter tout le run en rouge.

## Tableau de bord sécurité (palier 2)

Relevé au commit `e5a3e63`, pipeline verte.

| Scanner | Résultat | Périmètre |
| --- | --- | --- |
| `npm audit` | 0 vulnérabilité high/critical | 455 paquets |
| gitleaks | 0 secret | historique complet |
| Trivy | 0 CVE high/critical | image `nginx:alpine` publiée |
| SBOM image | 1026 composants | paquets Alpine et nginx |
| SBOM sources | 432 composants | dépendances npm déclarées |

L'écart entre les deux inventaires n'est pas une anomalie : le `.dockerignore`
exclut `package.json` et `node_modules` de l'image. Ce qu'on développe et ce
qu'on livre ne contiennent pas les mêmes composants, d'où deux SBOM distincts.

## Démonstrations : prouver que les scanners détectent vraiment

Un job de sécurité qui reste vert n'a pas forcément vérifié quoi que ce soit.
Chaque scanner a donc été mis à l'épreuve.

| Démonstration | Run | Résultat |
| --- | --- | --- |
| `handlebars@4.0.0` (branche, non fusionnée) | `30987990950` | `npm audit` : 4 vulnérabilités high/critical |
| Faux secret ajouté puis supprimé (branche) | `30990475482` | gitleaks : 3 secrets, trouvés dans le commit qui les ajoutait |
| `FROM nginx:1.20-alpine` (main, puis retour arrière) | `30991474256` | Trivy : 30 CVE high/critical |
| Version `42.0.0-inventee` dans `package.json` | `30995235267` | reprise telle quelle dans le SBOM des sources |
| Ajout de `lodash` | `30995414413` | SBOM sources : 432 → 433 composants |

Dans chaque cas, seul le job concerné est tombé : `lint` et `test` sont restés
verts. C'est l'intérêt de découper la pipeline en jobs plutôt qu'en un seul.

### Trois pièges rencontrés, et ce qu'ils apprennent

**Un faux secret trop bien choisi n'est pas détecté.** La première tentative
utilisait `AKIAIOSFODNN7EXAMPLE`, la clé d'exemple publiée par AWS. gitleaks
est resté vert : cette valeur figure dans sa liste d'exception par défaut,
précisément parce qu'elle est publique. Le log confirmait pourtant que la
bonne plage de commits avait été relue. Avec des chaînes aléatoires, trois
trouvailles sont remontées.

**Un inventaire valide peut être vide de l'essentiel.** Le SBOM des sources ne
comptait que 2 composants sur un lockfile de 456 paquets. Cause :
`javascript.include-dev-dependencies` vaut `false` par défaut dans Syft, et
ClickFast n'a que des dépendances de développement. Corrigé par
`.github/syft.yaml`.

**Un scanner en échec doit déposer son rapport avant de bloquer.** Si l'étape
du scanner fait échouer le job immédiatement, l'artefact n'est jamais envoyé
et le résumé affiche « non exécuté » alors que le scanner a parfaitement
travaillé. D'où l'ordre retenu partout : scanner sans échouer, écrire le
rapport, l'envoyer avec `if: always()`, bloquer en dernier.

### Une vulnérabilité réelle, non mise en scène

L'ajout de `lodash@4.17.21` a fait tomber `npm audit` sur trois avis publiés
contre `lodash <= 4.17.23` (GHSA-r5fr-rjxr-66jc, GHSA-f23m-r3pf-42rh,
GHSA-xxjr-mmjv-4gpg). Ce n'était pas prévu : la version passait pour saine.
La pipeline a attrapé une vulnérabilité actuelle sur une dépendance courante,
ce qui vaut mieux que n'importe quelle démonstration préparée.

## Palier 3 : la validation humaine et la séparation des workflows

### Phase 8 : un humain avant la publication

L'environnement `production` a été créé avec `SebG2RD` comme relecteur
obligatoire et un déploiement restreint à `main`. Le job `build-and-push` y est
rattaché par `environment: production`.

Constat au premier push : le run est passé en `waiting`, `lint`, `test` et
`security-deps` au vert, et `Build & Push` arrêté net. L'API confirmait
`current_user_can_approve: true` pour le relecteur `SebG2RD`. Rien n'est parti
sur Docker Hub tant que personne n'avait cliqué.

| Événement | Horodatage |
| --- | --- |
| Run bloqué en attente | 2026-08-05, run `31004428020` |
| Approuvé par `SebG2RD` | 2026-08-05T12:10:14Z |

C'est le passage du Continuous Deployment au Continuous Delivery : la pipeline
sait toujours tout faire, mais elle demande la permission avant de rendre
quelque chose public.

### Phase 9 : deux fichiers, deux intentions

| Fichier | Déclencheur | Rôle |
| --- | --- | --- |
| `_verifications.yml` | `workflow_call` | lint, test, security-deps |
| `verify.yml` | `pull_request` | vérifie, ne publie jamais |
| `release.yml` | `push` sur `main` | vérifie puis publie, sous validation |

Les jobs communs sont appelés par les deux plutôt que dupliqués. Le PDF
affirme que « GitHub Actions ne partage pas facilement du code entre
workflows » : ce n'est plus exact depuis `workflow_call`. Ce qui compte, et
qui est respecté, c'est que les déclencheurs restent strictement séparés.

Vérifié en conditions réelles : un push sur `main` ne déclenche que `Release`,
une pull request ne déclenche que `Verify`.

**Un piège traité à la conception.** Sur une pull request, `security-image` et
`sbom` n'existent pas du tout, au lieu d'être `skipped`. Le job de résumé
n'aurait donc vu aucun job en défaut et aurait annoncé « publiable en
confiance » avec deux lignes sur cinq, sans avoir jamais regardé l'image.
Chaque appelant passe désormais une variable `CONTEXTE`, et le verdict sur
pull request devient « vérifications de branche : OK (scans d'image hors
périmètre) ». Le script ne connaît toujours aucun nom de scanner.

### Phase 10 : casser `main`, et s'en remettre

Une assertion de `script.test.js` a été inversée sur une branche : un clic
devait donner 1, le test attendait 2.

| Étape | Run | Résultat |
| --- | --- | --- |
| Pull request #5 | `31006587515` | `Verify` ❌ sur `test`, `Release` non déclenché |
| Fusion malgré le rouge | commit `9536d8b` à 14:51:33 | rien ne s'y est opposé |
| `main` après fusion | `31007495267` | `Release` ❌, `Build & Push` **skipped** |
| Correction | commit `934787e` à 15:05:01 | chaîne entièrement verte |

**Temps de rétablissement : 13 minutes 28 secondes.** C'est la métrique DORA
correspondante, mesurée entre le commit qui casse et le commit qui répare.

**Ce qui s'est passé à l'étape de la fusion, et pourquoi.** Rien n'a empêché
de fusionner une pull request dont la CI était rouge, parce que la branche
`main` n'est protégée par aucune règle. GitHub a affiché l'échec, et s'est
arrêté là : afficher n'est pas bloquer. La correction consiste à rendre le
check `Verify` obligatoire avant fusion, dans les réglages de la branche
`main` (Settings, Branches, règle sur `main`, « Require status checks to pass
before merging », en cochant `Verify`). Tant que ce n'est pas fait, la
séparation en deux workflows protège contre une publication accidentelle,
mais pas contre une fusion de code cassé.

**Aucun tag n'a été abîmé.** `Build & Push` ayant été sauté, aucune image n'a
été publiée pour le commit cassé — le tag `9536d8b…` n'existe pas sur Docker
Hub. Le tag publié juste avant l'incident, `1bd0a155…`, est resté disponible
et fonctionnel pendant toute la durée de la panne. Un nouveau tag,
`934787e7…`, est apparu après correction. On ne touche jamais à un tag déjà
publié : on en ajoute un.

**Ce que l'incident apprend.** Une pipeline rouge sur `main` n'est pas une
faute personnelle, c'est un arrêt d'usine : plus rien ne se publie tant que ce
n'est pas réparé. Le découpage en jobs a fait que l'échec désignait
immédiatement le coupable — `verifications / Test` — sans qu'il faille lire
quatre logs. Et la publication protégée a joué son rôle de dernier filet : même
si les tests étaient passés, l'image n'aurait pas quitté la CI sans un accord
humain.
