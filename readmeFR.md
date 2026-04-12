# Mirza -- Station d'IA Locale sur Apple Silicon

> Transformer un Mac Mini en serveur d'inference IA headless, pilote a distance depuis n'importe quel poste Linux.
> Pas d'ecran, pas de clavier, pas d'abonnement cloud. Juste SSH, bash, et de la memoire unifiee.

---

## Table des matieres

- [C'est quoi ce projet](#cest-quoi-ce-projet)
- [Prerequis](#prerequis)
- [Structure du projet](#structure-du-projet)
- [Phase 1 -- Preparation de macOS (ecran requis)](#phase-1----preparation-de-macos-ecran-requis)
- [Phase 2 -- Configuration reseau](#phase-2----configuration-reseau)
- [Phase 3 -- Installation du client](#phase-3----installation-du-client)
- [Phase 4 -- Premier contact](#phase-4----premier-contact)
- [Phase 5 -- Monitoring (Grafana + Prometheus)](#phase-5----monitoring-grafana--prometheus)
- [Phase 6 -- Deploiement IA (MLX)](#phase-6----deploiement-ia-mlx)
- [Phase 7 -- La WebUI](#phase-7----la-webui)
- [Reference CLI](#reference-cli)
- [Reference API](#reference-api)
- [Emplacements des fichiers](#emplacements-des-fichiers)
- [Depannage](#depannage)
- [Roadmap](#roadmap)
- [Licence](#licence)

---

## C'est quoi ce projet

Mirza est un toolkit complet pour transformer un Mac Mini (ou n'importe quel Mac Apple Silicon, en fait) en **serveur d'inference IA dedie et headless**, que vous controlez entierement depuis une machine Linux distante.

Le Mac est branche sur le reseau local en Ethernet, sans ecran. Vous le gerez via un CLI (`mirza`) et/ou une WebUI servie depuis votre machine cliente. Les modeles tournent en local grace au framework MLX d'Apple, qui exploite a fond l'architecture memoire unifiee. Aucune donnee ne quitte votre reseau. Pas de cle API requise. Juste des maths et du silicium.

Le projet deploie aussi une stack de monitoring (Grafana + Prometheus + Macmon) pour que vous puissiez observer votre hardware transpirer en temps reel. Parce que si vous allez pousser 24 Go de memoire unifiee dans ses retranchements, autant regarder un graphique en meme temps.

---

## Prerequis

| Composant | Exigence |
|---|---|
| **Machine cible** | N'importe quel Mac avec Apple Silicon (M1, M2, M3, M4). Un Mac Intel dans ce contexte, c'est un presse-papiers avec un logo pomme. |
| **Version macOS** | Tahoe 26.x |
| **Machine cliente** | Linux (Ubuntu 24.04 LTS teste). WSL2 fonctionne mais vous rappellera que c'est Windows a chaque occasion. |
| **Bash** | 5.2+ |
| **SSH** | OpenSSH 9.x |
| **Reseau** | Ethernet filaire, CAT6 minimum. Le Wi-Fi c'est pour YouTube, pas pour servir 9 milliards de parametres. |
| **Patience** | Non negligeable. Xcode fait 12 Go. Les telecharges de modeles peuvent prendre des heures. |

---

## Structure du projet

```text
mirza.local/
|
|-- mirza/                           Outils cote client (votre machine Linux)
|   |-- mirza.sh                     CLI principal (15 commandes)
|   |-- gatcha.sh                    Echange de cles SSH et setup environnement
|   |-- gen_config.sh                Generateur de config distante (alimente mirza.conf via SSH)
|   |-- mirza.conf                   Fichier de config auto-genere (ne pas editer manuellement)
|
|-- mirzaServer/                     Scripts cote serveur (deployes SUR le Mac)
|   |-- monitoring/
|   |   |-- setup_monitoring.sh      Installe Grafana, Prometheus, Macmon, configure crontab
|   |   |-- *.json                   Definitions de dashboards Grafana pre-construits
|   |-- ai/
|   |   |-- setup_mlx.sh             Installe uv, MLX, mlx-lm, cree le LaunchAgent
|   |   |-- models.json              Catalogue de modeles avec tiers RAM et categories
|   |-- utils/
|       |-- baptism.sh               Renomme le hostname du Mac
|       |-- .zshrc                   Configuration shell recommandee pour le serveur
|
|-- webui/                           WebUI (tourne sur votre machine cliente)
|   |-- index.html                   Layout : dashboard, chat, modeles, config, monitoring, docs
|   |-- style.css                    Design system (theme sombre, accents violets)
|   |-- app.js                       Logique applicative, integration API HuggingFace
|   |-- server.py                    Backend Python (API REST, relais SSH, fichiers statiques)
|   |-- serve.sh                     Script de demarrage rapide pour la WebUI
|
|-- docs/
|   |-- MCP_ROADMAP.md               Roadmap pour l'integration Model Context Protocol
|
|-- installation.sh                  Setup client en une commande (deps, symlink, cles SSH, deploiement)
|-- README.md                        Version anglaise
|-- readmeFR.md                      Ce fichier
|-- LICENSE                          GPLv3
```

---

## Phase 1 -- Preparation de macOS (ecran requis)

La seule fois ou vous aurez besoin d'un ecran branche au Mac. Savourez.

### 1. Empecher la mise en veille

**Reglages Systeme > Ecrans > Avance...** -- Cochez "Empecher la suspension d'activite automatique lorsque l'ecran est eteint."

**Reglages Systeme > Energie** -- Activez "Demarrer automatiquement apres une panne de courant" et "Reactiver lors d'un acces reseau."

Le Mac ne doit jamais s'endormir tout seul. C'est un serveur maintenant. Il n'a plus ce droit.

### 2. Definir le hostname

**Reglages Systeme > General > Partage** -- En bas, sous "Nom d'hote local", cliquez "Modifier..." et mettez `mirza`.

Cela cree `mirza.local` sur le reseau local via mDNS/Bonjour. Fini les adresses IP a retenir.

### 3. Activer la connexion a distance

Toujours dans Partage : activez **Session a distance** (c'est SSH). Ajoutez votre compte utilisateur a la liste des utilisateurs autorises.

Optionnel : Activez le **Partage d'ecran** (VNC) si vous voulez un filet de securite pour les premiers jours. Vous arreterez de l'utiliser quand vous ferez confiance au CLI. Probablement.

### 4. Installer Xcode

Ouvrez l'App Store et telechargez Xcode. Ca fait environ 12 Go. Allez faire autre chose.

Xcode est necessaire parce qu'Apple distribue la toolchain de compilation a l'interieur. `setup_mlx.sh` en a besoin pour compiler les packages Python avec le support Metal.

Apres l'installation de Xcode, acceptez la licence depuis le terminal :

```bash
sudo xcodebuild -license accept
```

Vous pouvez maintenant debrancher l'ecran. Le Mac est lache dans la nature.

---

## Phase 2 -- Configuration reseau

Un serveur qui change d'IP a chaque reboot, c'est un serveur que vous allez finir par detester.

1. Connectez-vous a l'interface d'administration de votre routeur (generalement `192.168.1.1`).
2. Naviguez vers les parametres DHCP / Baux statiques.
3. Attribuez une IP fixe (par exemple, `192.168.1.87`) a l'adresse MAC Ethernet du Mac.
4. Pour trouver l'adresse MAC, executez ceci sur le Mac (avant de debrancher l'ecran) :
   ```bash
   networksetup -getmacaddress Ethernet
   ```
5. Si `mirza.local` ne resout pas apres un reboot, votre routeur fait peut-etre de l'IGMP Snooping. Desactivez-le.

---

## Phase 3 -- Installation du client

Clonez le depot sur votre machine Linux :

```bash
git clone <repo-url> ~/git/mirza.local
cd ~/git/mirza.local
```

Lancez le script d'installation :

```bash
chmod +x installation.sh
./installation.sh
```

Ce script fait quatre choses, dans l'ordre :

| Etape | Ce que ca fait |
|---|---|
| **1. Dependances** | Installe `jq`, `curl`, `wakeonlan`, `python3`, `ssh` via votre gestionnaire de paquets. |
| **2. Symlink CLI** | Cree `~/.local/bin/mirza` pointant vers `mirza/mirza.sh`. Ajoute `~/.local/bin` au PATH si necessaire. |
| **3. Cles SSH** | Execute optionnellement `gatcha.sh` pour generer une paire de cles SSH dedies (`~/.ssh/mirza_key`) et la copier sur le Mac. Injecte aussi `MIRZA_HOST`, `MIRZA_USER` et `MIRZA_MAC_ADRESS` dans votre `~/.bashrc`. |
| **4. Deploiement serveur** | Copie optionnellement `mirzaServer/` vers `~/mirzaServer/` sur le Mac via rsync. |

Apres la fin du script :

```bash
source ~/.bashrc
mirza status
```

Si vous voyez "ONLINE", c'est parti.

---

## Phase 4 -- Premier contact

```bash
mirza ssh
```

Vous etes maintenant sur le Mac. Lancez les scripts de setup serveur dans l'ordre.

### Renommer l'hote (optionnel, si pas deja fait)

```bash
chmod +x ~/mirzaServer/utils/baptism.sh
~/mirzaServer/utils/baptism.sh
```

---

## Phase 5 -- Monitoring (Grafana + Prometheus)

Faire de l'inference sans monitoring, c'est du deni. La stack :

| Composant | Port | Role |
|---|---|---|
| **Grafana** | 3000 | Visualisation des dashboards |
| **Prometheus** | 9090 | Collecte et stockage des metriques |
| **Macmon** | 9091 | Exporteur de metriques Apple Silicon (CPU, GPU, ANE, temperature, puissance) |

### Installation (sur le Mac, via SSH)

```bash
chmod +x ~/mirzaServer/monitoring/setup_monitoring.sh
~/mirzaServer/monitoring/setup_monitoring.sh
```

Ce script :
- Installe Grafana, Prometheus et Macmon via Homebrew.
- Configure Prometheus pour scraper les metriques Macmon.
- Importe un dashboard Grafana pre-construit ("Mirza Monitor Lite").
- Ajoute des entrees crontab `@reboot` pour que tous les services demarrent automatiquement apres un reboot. Pas d'intervention manuelle.

### Emplacement de la base de donnees Grafana

La base de donnees Grafana (dashboards, utilisateurs, preferences) est stockee a l'emplacement :

```
/opt/homebrew/var/lib/grafana/grafana.db
```

Si vous devez faire un backup ou reset Grafana, c'est ce fichier.

### Acceder a Grafana

Depuis votre navigateur : `http://mirza.local:3000`

Depuis la WebUI : l'onglet Monitoring integre Grafana directement via iframe en mode kiosk.

---

## Phase 6 -- Deploiement IA (MLX)

MLX est le framework de machine learning d'Apple, optimise pour Apple Silicon. Il utilise la memoire unifiee, ce qui signifie que le GPU, le CPU et le Neural Engine partagent tous le meme pool de RAM. Pas de goulot d'etranglement PCIe. Pas de limite VRAM separee de la RAM systeme.

### Installation (sur le Mac, via SSH)

```bash
chmod +x ~/mirzaServer/ai/setup_mlx.sh
~/mirzaServer/ai/setup_mlx.sh
```

Cela installe :
- **uv** : un gestionnaire de paquets Python en Rust. Rapide. Tres rapide.
- **MLX et mlx-lm** : le moteur d'inference et sa couche de serving LLM.
- Un LaunchAgent pour le demarrage automatique du serveur.

### Ou sont stockes les modeles ?

`mlx-lm` utilise le cache Hugging Face. Tous les modeles telecharges atterrissent dans :

```
~/.cache/huggingface/hub/
```

sur le Mac. C'est la que part votre espace disque.

### Gerer les modeles depuis le CLI

```bash
mirza models              # Lister les modeles compatibles depuis le catalogue
mirza models code         # Filtrer par categorie
mirza deploy qwen3.5-9b-4bit  # Telecharger un modele sur le Mac
mirza serve qwen3.5-9b-4bit   # Demarrer le serveur d'inference avec ce modele
mirza stop                # Arreter le serveur d'inference
```

### L'API d'inference

`mlx-lm` sert une **API REST compatible OpenAI** sur le port 8080. Vous pouvez l'utiliser avec n'importe quel outil qui parle le protocole OpenAI :

```bash
curl http://mirza.local:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "mlx-community/Qwen3.5-9B-MLX-4bit", "messages": [{"role": "user", "content": "Bonjour"}]}'
```

---

## Phase 7 -- La WebUI

La WebUI est une application single-page servie depuis votre machine cliente. Elle communique avec le Mac via le backend Python (`server.py`), qui relaie les commandes par SSH.

### Demarrer la WebUI

```bash
mirza ui
```

Cela demarre `server.py` sur le port 3333 et cree un tunnel SSH vers l'API MLX si necessaire.

Ouvrez `http://localhost:3333` dans votre navigateur.

### Arreter la WebUI

```bash
mirza stop-ui
```

### Fonctionnalites de la WebUI

| Onglet | Ce qu'il fait |
|---|---|
| **Dashboard** | Statut du serveur, infos hardware, modele actif, actions rapides (reveil, veille, reboot, stop MLX), logs en direct. |
| **Chat** | Interface de chat complete avec streaming, support multi-provider (MLX local, OpenAI, Anthropic, Groq, Mistral, Ollama), historique des conversations, outils MCP. |
| **Modeles** | Catalogue en direct depuis l'API HuggingFace (mlx-community, top 100 par telechargements). Chaque carte affiche : taille estimee, overhead KV cache, 6 Go d'overhead OS, tok/s estimes pour votre puce, support Flash/Paged Attention, et avertissements de compatibilite. |
| **Config** | Affiche le contenu de `mirza.conf`. Peut regenerer la config via SSH. |
| **Monitoring** | Dashboard Grafana integre en mode kiosk. |
| **Documentation** | Guide d'utilisation integre. |

### Comment marchent les recommandations de modeles

La WebUI parse le nom de chaque modele pour en extraire les parametres (ex: "9B") et la quantification (ex: "4bit"), puis calcule :

1. **Taille des poids du modele** = Parametres x (Bits / 8)
2. **Estimation du KV Cache** = 1.5 Go (petits modeles) ou 3 Go (modeles > 15B parametres)
3. **Overhead OS** = 6 Go (reserves pour macOS et les processus de fond)
4. **RAM minimum requise** = Taille des poids + KV Cache + Overhead OS
5. **tok/s estimes** = Bande passante memoire de la puce / Taille des poids du modele

Les modeles qui ne rentrent pas dans votre RAM sont grises avec des boutons desactives. Les modeles adaptes a votre hardware sont tagges "Optimise pour ce Mac."

---

## Reference CLI

Toutes les commandes utilisent le format `mirza <commande> [arguments]`.

### Gestion du serveur

| Commande | Description |
|---|---|
| `mirza start` | Envoyer un paquet Wake-on-LAN au Mac. |
| `mirza ssh` | Ouvrir une session SSH interactive. |
| `mirza status` | Verifier si le serveur, l'API MLX et Grafana fonctionnent. |
| `mirza sleep` | Mettre le Mac en veille via `pmset sleepnow`. |
| `mirza reboot` | Redemarrer le Mac via `sudo shutdown -r now`. |

### Gestion de l'IA

| Commande | Description |
|---|---|
| `mirza models [categorie]` | Afficher le catalogue de modeles, filtre par compatibilite RAM. Categories : `general`, `code`, `reasoning`, `multimodal`, `light`, `french`. |
| `mirza deploy <model_id>` | Telecharger un modele sur le Mac (accepte les IDs du catalogue ou les chemins complets de depots HuggingFace). |
| `mirza serve [model_id]` | Demarrer le serveur d'inference MLX. Utilise le dernier modele deploye si aucun n'est specifie. |
| `mirza stop` | Arreter le serveur d'inference MLX. |
| `mirza chat` | Session de chat interactive en terminal. |

### Interface et Configuration

| Commande | Description |
|---|---|
| `mirza ui` | Lancer la WebUI sur le port 3333. Cree un tunnel SSH si necessaire. |
| `mirza stop-ui` | Arreter le processus WebUI. |
| `mirza tunnel [port]` | Creer un tunnel SSH vers l'API MLX (par defaut : port 8080). |
| `mirza config` | Afficher la configuration actuelle. |
| `mirza config --refresh` | Regenerer `mirza.conf` en interrogeant le Mac via SSH. |

---

## Reference API

Le backend de la WebUI (`server.py`) expose ces endpoints :

| Methode | Endpoint | Description |
|---|---|---|
| GET | `/api/status` | Statut du serveur, infos hardware, modele actif. |
| GET | `/api/config` | Contenu de `mirza.conf` en JSON. |
| POST | `/api/config/refresh` | Regenerer `mirza.conf` via SSH. |
| GET | `/api/models` | Catalogue de modeles depuis `models.json`. |
| POST | `/api/server/wake` | Envoyer un paquet Wake-on-LAN. |
| POST | `/api/server/sleep` | Mettre le Mac en veille. |
| POST | `/api/server/reboot` | Redemarrer le Mac. |
| POST | `/api/mlx/serve` | Demarrer le serveur MLX avec `{"model": "repo/name"}`. |
| POST | `/api/mlx/stop` | Arreter le serveur MLX. |
| POST | `/api/mlx/deploy` | Telecharger un modele avec `{"hf_repo": "repo/name"}`. |
| GET | `/api/mlx/logs` | 30 dernieres lignes du log du serveur MLX. |

---

## Emplacements des fichiers

| Quoi | Ou | Machine |
|---|---|---|
| Script CLI | `mirza/mirza.sh` | Client (Linux) |
| Symlink CLI | `~/.local/bin/mirza` | Client (Linux) |
| Configuration | `mirza/mirza.conf` | Client (Linux) |
| Cle SSH privee | `~/.ssh/mirza_key` | Client (Linux) |
| Variables d'environnement | `~/.bashrc` (MIRZA_HOST, MIRZA_USER, MIRZA_MAC_ADRESS) | Client (Linux) |
| Backend WebUI | `webui/server.py` | Client (Linux) |
| Catalogue de modeles | `mirzaServer/ai/models.json` | Les deux |
| Modeles telecharges | `~/.cache/huggingface/hub/` | Serveur (Mac) |
| Base de donnees Grafana | `/opt/homebrew/var/lib/grafana/grafana.db` | Serveur (Mac) |
| Donnees Prometheus | `/opt/homebrew/var/prometheus/` | Serveur (Mac) |
| Logs du serveur MLX | `/tmp/mirza-mlx.log` | Serveur (Mac) |
| Setup monitoring | `~/mirzaServer/monitoring/setup_monitoring.sh` | Serveur (Mac) |

---

## Depannage

### "mirza: command not found"

Le symlink `~/.local/bin/mirza` n'est pas dans votre PATH. Lancez :
```bash
source ~/.bashrc
```

### "Catalogue non trouve: .../.local/mirzaServer/ai/models.json"

Vous utilisez une ancienne version de `mirza.sh` qui ne resout pas les symlinks correctement. Mettez a jour et relancez `installation.sh`.

### "Address already in use" au demarrage de la WebUI

Un processus `server.py` precedent tourne encore. Tuez-le :
```bash
mirza stop-ui
```

### mirza.local ne resout pas

- Verifiez que le Mac est allume et connecte en Ethernet.
- Verifiez que votre routeur ne filtre pas le mDNS (verifiez l'IGMP Snooping).
- En dernier recours, utilisez l'IP statique du Mac directement.

### Grafana est vide apres un reboot

Le script `setup_monitoring.sh` installe des entrees crontab `@reboot`. Si elles sont manquantes, relancez le script. Il ne supprimera pas les donnees Grafana existantes.

### Les modeles sont trop lents

Verifiez `mirza status` pour confirmer que le modele tourne. Puis verifiez Grafana pour la pression memoire. Si le Mac swappe, le modele est trop gros pour votre RAM. Utilisez une quantification plus petite ou un modele plus petit.

---

## Roadmap

- [x] CLI pour la gestion distante du Mac
- [x] Stack de monitoring (Grafana + Prometheus + Macmon)
- [x] API d'inference compatible OpenAI (mlx-lm)
- [x] WebUI avec chat, dashboard, catalogue de modeles
- [x] Grafana integre dans la WebUI
- [x] Catalogue de modeles dynamique depuis l'API HuggingFace
- [x] Recommandations de modeles basees sur le hardware avec estimation tok/s
- [ ] Serveur MCP pour workflows agentiques (filesystem, recherche web, execution de code)
- [ ] Benchmarking de modeles a travers les variantes de puces (M1 a M4 Ultra)
- [ ] Serving multi-modeles (servir plusieurs modeles sur des ports differents)

---

## Licence

GPLv3. Copiez, distribuez, modifiez. Gardez-le ouvert.
