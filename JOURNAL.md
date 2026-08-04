# Journal de bord — pipeline ClickFast

## Tableau de bord

Mesures relevées sur la branche `mesure-cache`, deux runs consécutifs ne
différant que par la présence de `cache: npm` sur `actions/setup-node`.

| Run | Durée totale | Job `test` | Taille de l'image |
| --- | --- | --- | --- |
| Avant cache (`30922710430`) | 34 s | 19 s | 92,7 Mo |
| Après cache (`30923316942`) | 32 s | 13 s | 92,7 Mo |
| **Écart** | **−2 s** | **−6 s** | — |

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
L'écart reste faible parce que l'arbre de dépendances est petit — 427 paquets,
soit 4 s de téléchargement sur un runner GitHub. Le gain spectaculaire évoqué
en cours (30 s → 8 s) suppose un projet où le téléchargement domine largement
le temps d'installation.

## Points de vigilance vérifiés

**Un cache partagé ne remplace jamais le contenu du `package-lock.json`.**
La clé de cache intègre le hash du lockfile
(`node-cache-Linux-x64-npm-<hash>`) : deux branches aux dépendances
différentes obtiennent donc deux clés différentes. Et même sur une clé
partagée, ce qui est mis en cache est `~/.npm`, le dossier de téléchargement,
pas `node_modules`. `npm ci` supprime puis reconstruit `node_modules`
strictement à partir du lockfile — d'où les mêmes 427 paquets installés dans
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
| Push sur `main`, tests verts | `30924519010` | Lint ✅ Test ✅ Build & Push ✅ — tag `2c766fc…` |
| Second push sur `main` | `30924700170` | tag `76844ac…`, distinct du précédent |
| Pull request #1 | `30924897416` | Lint ✅ Test ✅ **Build & Push `skipped`** — aucun tag ajouté |
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
