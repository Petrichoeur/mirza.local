<!-- Shields / Badges -->
<p align="center">
  <img src="https://img.shields.io/badge/macOS-Tahoe_26.x-000000?style=for-the-badge&logo=apple&logoColor=white" />
  <img src="https://img.shields.io/badge/Apple_Silicon-M1_|_M2_|_M3_|_M4-blue?style=for-the-badge&logo=apple&logoColor=white" />
  <img src="https://img.shields.io/badge/Ubuntu-24.04_LTS-E95420?style=for-the-badge&logo=ubuntu&logoColor=white" />
  <img src="https://img.shields.io/badge/Bash-5.2+-4EAA25?style=for-the-badge&logo=gnubash&logoColor=white" />
  <img src="https://img.shields.io/badge/MLX-Apple_AI-e8722a?style=for-the-badge&logo=apple&logoColor=white" />
  <img src="https://img.shields.io/badge/License-GPLv3-green?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Status-Work_In_Progress-orange?style=for-the-badge" />
</p>

<h1 align="center"> Mirza — Station d'IA Locale sur Apple Silicon</h1>

<p align="center">
  <i>Transformez votre Mac Mini en bête de course pour l'IA générative locale.</i><br/>
  <i>Pas d'écran, pas de clavier, pas de problème.</i>
</p>

---

##  Table des matières

- [Présentation](#-présentation)
- [Prérequis](#-prérequis)
- [Phase 1 — Préparation de macOS](#-phase-1--préparation-de-macos-depuis-linterface-graphique)
- [Phase 2 — Configuration du Routeur / Box Internet](#-phase-2--configuration-du-routeur--box-internet)
- [Phase 3 — Première connexion](#-phase-3--première-connexion)
- [Phase 4 — Monitoring](#-phase-4--monitoring)
- [Phase 5 — Déploiement IA (MLX)](#-phase-5--déploiement-ia-mlx)
- [Phase 6 — WebUI Chat](#-phase-6--webui-chat)
- [Architecture](#-architecture)
- [Commandes CLI](#-commandes-cli)
- [Roadmap](#-roadmap)
- [Contribuer](#-contribuer)
- [Licence](#-licence)

---

##  Présentation

**Mirza** documente — et automatise — la transformation complète d'un Mac Mini Apple Silicon (M1, M2, M3, M4…) d'une paisible machine de bureau en un **serveur d'inférence IA dédié**, robuste et monitoré de bout en bout.

**L'objectif est simple :** brancher le Mac sur le réseau, débrancher l'écran, et tout piloter à distance via SSH — tout en gardant un œil sur ses constantes vitales grâce à Grafana. Un peu comme un Tamagotchi, mais avec 32 Go de RAM unifiée.

> **⚠️ Connexion filaire fortement recommandée.**
> Ce guide part du principe que le serveur est connecté en **Ethernet** à votre box. Le Wi-Fi *fonctionne*, mais autant jouer à la roulette russe avec votre latence. Si vous tenez absolument au sans-fil, pensez à adapter les scripts et commandes réseau en conséquence.

---

## Prérequis

| Élément | Version / Détail |
|---|---|
| **Machine cible** | Mac Mini Apple Silicon (M1, M2, M3, M4) |
| **macOS** | Sequoia 15.x (dernière version stable recommandée) |
| **Machine cliente** | N'importe quel poste sous Ubuntu 24.04 LTS (ou équivalent) |
| **Bash** | 5.2+ (version par défaut sur Ubuntu 24.04) |
| **SSH** | OpenSSH 9.x |
| **Réseau** | Connexion Ethernet entre le Mac et la box |
| **Xcode CLI Tools** | Requis sur le Mac (voir Phase 2) |
| **Café** | Au moins un. Probablement deux. |

---

##  Phase 1 — Préparation de macOS (depuis l'interface graphique)

Avant de débrancher l'écran et le clavier, il faut convaincre macOS qu'il est un serveur maintenant. Il va s'y faire.

### 1. Paramètres d'Énergie — Ne jamais dormir

Allez dans **Réglages Système** → **Écrans** → **Avancé…**

Activez **"Empêcher la suspension d'activité automatique lorsque l'écran est éteint"**.

Puis dans **Réglages Système** → **Énergie** :

Activez **"Démarrer automatiquement après une panne de courant"** — c'est non négociable pour un serveur. Activez également **"Réactiver lors d'un accès réseau"** (Wake on LAN) pour pouvoir le réveiller à distance si besoin.

### 2. Identité Réseau

Allez dans **Réglages Système** → **Général** → **Partage** :

Tout en bas, dans **Nom d'hôte local**, cliquez sur *Modifier…* et définissez le nom : `mirza`. Cela créera l'adresse mDNS `mirza.local` — bien plus agréable à taper qu'une IP.

### 3. Accès à distance — Le cordon ombilical

Toujours dans **Réglages Système** → **Général** → **Partage** :

Activez **Session à distance** (c'est le serveur SSH intégré à macOS) et autorisez votre utilisateur. Activez aussi **Partage d'écran** (accès VNC au bureau macOS) — c'est votre filet de sécurité si un jour SSH ne suffit plus.

>  **Félicitations !** Vous pouvez maintenant débrancher l'écran de Mirza. Il vole de ses propres ailes.

---

##  Phase 2 — Configuration du Routeur / Box Internet

Un serveur qui change d'IP à chaque redémarrage, c'est comme un chat qui change de nom tous les jours : personne ne s'y retrouve.

**Étape 1** — Connectez-vous à l'interface d'administration de votre box (souvent `192.168.1.1` ou `192.168.0.1`).

**Étape 2** — Cherchez la section **DHCP** ou **Baux Statiques / Adresses IP Fixes**.

**Étape 3** — Associez l'adresse MAC de Mirza (interface Ethernet) à une IP fixe (par exemple `192.168.1.87`). Pour retrouver ces informations, lancez directement sur le Mac :

```bash
echo "=== Configuration réseau Mirza ==="
echo "Adresse MAC :"
networksetup -getmacaddress Ethernet
echo "Adresse IP :"
networksetup -getinfo Ethernet | grep "IP address:"
```

**Étape 4** *(optionnel mais recommandé)* — Si votre routeur propose une option **"IGMP Snooping"** ou **"Multicast Routing"**, vérifiez qu'elle ne bloque pas le trafic mDNS. C'est ce qui permet à `mirza.local` de fonctionner sur votre réseau local.

**Étape 5** — Avant de pouvoir installer quoi que ce soit, macOS a besoin de ses outils de développement. Téléchargez **Xcode** depuis l'App Store sur le Mac. Oui, c'est long. Oui, c'est 12 Go. Profitez-en pour aller chercher ce deuxième café.

---

## Phase 3 — Première connexion

C'est le grand moment : vous allez parler à Mirza pour la première fois depuis votre poste client.

**Étape 1** — Tentez une première connexion SSH :

```bash
ssh votre_user@mirza.local
```

**Étape 2** — Entrez votre mot de passe. Si la connexion échoue, pas de panique : revérifiez chaque étape des phases précédentes (IP fixe, session à distance activée, même réseau…).

**Étape 3** — Une fois la connexion validée, on va injecter une clé SSH sur le serveur distant et récupérer quelques informations utiles. Placez-vous dans le dossier `mirza/` de ce repo :

```bash
chmod -R +x mirza/
./mirza/gatcha.sh
```

**Étape 4** — Installez l'outil **mirza** qui vous permettra de vous connecter au Mac, de le rallumer à distance (Wake on LAN), de vérifier son état, etc. :

```bash
./mirza/mirza.sh
```

> **C'est fait.** Mirza est configuré côté local. Vous disposez désormais d'un serveur distant pilotable en une commande. Les phases suivantes vont transformer cette petite boîte en véritable bête de course pour l'IA générative locale. Attachez vos ceintures.

---

## Phase 4 — Monitoring

Avant de se lancer tête baissée dans des modèles de 70 milliards de paramètres qui vont chatouiller les limites de votre RAM unifiée, il est **essentiel** de monitorer ce qui se passe sous le capot. Faire tourner un LLM sans monitoring, c'est comme conduire de nuit sans phares : techniquement possible, mais fortement déconseillé.

Bonne nouvelle : un script d'installation complet est fourni pour déployer toute la stack de monitoring en une seule passe.

**La stack inclut :**

| Composant | Rôle |
|---|---|
| **Grafana** | Tableaux de bord et visualisation |
| **Prometheus** | Collecte et stockage des métriques |
| **Node Exporter** | Métriques système classiques (CPU, RAM, disque, réseau) |
| **Macmon** | Métriques spécifiques à macOS et Apple Silicon (température, GPU, ANE…) |
| **Dashboard natif** | Un dashboard pré-configuré pour surveiller l'essentiel d'un coup d'œil |

**Installation** (depuis une session SSH sur Mirza) :

```bash
chmod +x mirzaServer/monitoring/setup_monitoring.sh
./mirzaServer/monitoring/setup_monitoring.sh
```

---

## 🧠 Phase 5 — Déploiement IA (MLX)

C'est ici que Mirza révèle sa vraie nature. On va installer le framework **MLX** d'Apple pour faire tourner des LLM directement sur la puce Apple Silicon, en exploitant la mémoire unifiée GPU/CPU.

### Architecture de la stack IA

| Composant | Rôle |
|---|---|
| **[uv](https://github.com/astral-sh/uv)** | Gestionnaire d'environnement Python ultra-rapide |
| **[MLX](https://github.com/ml-explore/mlx)** | Framework de calcul d'Apple optimisé Apple Silicon |
| **[mlx-lm](https://github.com/ml-explore/mlx-lm)** | Serveur d'inférence LLM avec API OpenAI-compatible |
| **HuggingFace** | Source des modèles pré-quantifiés (mlx-community) |

### Installation automatisée

**Depuis une session SSH sur Mirza** :

```bash
chmod +x mirzaServer/ai/setup_mlx.sh
./mirzaServer/ai/setup_mlx.sh
```

Ce script :
1. Installe `uv` via Homebrew
2. Crée un projet Python dédié dans `~/mirza-ai/`
3. Installe `mlx-lm` via `uv add`
4. Configure un **LaunchAgent** pour démarrage automatique au boot
5. Pré-télécharge un modèle par défaut

### Gestion des modèles

Un catalogue de modèles pré-sélectionnés est disponible dans `mirzaServer/ai/models.json`, organisé par catégorie et compatibilité RAM :

| Catégorie | Description |
|---|---|
| 💬 Conversation | Modèles polyvalents (Qwen, Gemma, Llama) |
| 💻 Code | Spécialisés développement (Devstral, GPT-OSS) |
| 🧠 Raisonnement | Logique et mathématiques (DeepSeek, Claude Distilled) |
| 👁️ Multimodal | Vision + texte (Gemma 4, Qwen 3.5) |
| ⚡ Ultra-léger | Réponse instantanée, <2 Go (Gemma 1B, Llama 1B) |
| 🇫🇷 Français | Bon support de la langue française |

**Compatibilité RAM** :

| RAM | Modèles recommandés |
|---|---|
| 8 Go | Modèles ≤4B (Gemma 3 4B, Llama 3.2 3B, Qwen 3 4B) |
| 16 Go | Modèles ≤14B + MoE (Qwen 3.5 9B, Gemma 4 MoE 26B) |
| 24 Go | Modèles ≤24B (Devstral 24B, Gemma 3 27B) |
| 32 Go | Modèles ≤35B (Gemma 4 31B, Qwen 3.5 27B) |
| 48-64 Go | Les plus gros modèles disponibles |

**Depuis la machine cliente** :

```bash
# Lister les modèles compatibles avec votre Mac
mirza models

# Filtrer par catégorie
mirza models code

# Déployer un modèle
mirza deploy qwen3.5-9b-4bit

# Démarrer le serveur d'inférence
mirza serve qwen3.5-9b-4bit

# Chat rapide dans le terminal
mirza chat
```

---

## 🖥 Phase 6 — WebUI Chat

Une interface web élégante est fournie pour dialoguer avec le modèle déployé, directement depuis votre navigateur.

### Fonctionnalités

- 💬 Chat en temps réel avec **streaming** (affichage token par token)
- 📝 Rendu **Markdown** complet (code, tableaux, listes, liens)
- 🎨 Thème sombre avec accents orange
- 💾 Historique des conversations persistant (localStorage)
- ⚙️ Paramètres ajustables (température, tokens max, system prompt)
- 📊 Compteur de tokens/seconde en temps réel
- 📋 Bouton copier sur les blocs de code
- 📱 Interface responsive (desktop + mobile)

### Lancement

```bash
# Méthode simple : via le CLI mirza
mirza ui

# Méthode manuelle :
# 1. Créer un tunnel SSH vers l'API MLX
mirza tunnel

# 2. Dans un autre terminal, lancer la WebUI
cd webui/
chmod +x serve.sh
./serve.sh
```

Ouvrez ensuite `http://localhost:3333` dans votre navigateur.

---

## 🏗 Architecture

```
mirza.local/
├── mirza/                        # 🖥  Outils côté client (votre poste Linux)
│   ├── gatcha.sh                 #    Setup SSH + récupération des infos
│   ├── mirza.sh                  #    CLI principal (13 commandes)
│   ├── gen_config.sh             #    Générateur de configuration
│   └── mirza.conf                #    Configuration auto-générée
│
├── mirzaServer/                  # 🍎 Scripts côté serveur (le Mac)
│   ├── monitoring/
│   │   ├── setup_monitoring.sh   #    Installation Grafana + Prometheus + macmon
│   │   └── *.json                #    Dashboards Grafana pré-configurés
│   ├── ai/
│   │   ├── setup_mlx.sh          #    Installation uv + MLX + LaunchAgent
│   │   └── models.json           #    Catalogue de modèles MLX
│   └── utils/
│       ├── baptism.sh            #    Renommage du serveur
│       └── .zshrc                #    Configuration shell recommandée
│
├── webui/                        # 🌐 Interface de chat
│   ├── index.html                #    Structure de l'interface
│   ├── style.css                 #    Design system (dark + orange)
│   ├── app.js                    #    Logique chat + streaming
│   └── serve.sh                  #    Serveur HTTP local
│
├── README.md
└── LICENSE
```

---

## ⌨ Commandes CLI

| Commande | Description |
|---|---|
| `mirza start` | Réveiller le serveur (Wake-on-LAN) |
| `mirza ssh` | Session SSH interactive |
| `mirza status` | État du serveur et des services |
| `mirza sleep` | Mettre en veille |
| `mirza reboot` | Redémarrer |
| `mirza models [catégorie]` | Catalogue de modèles MLX |
| `mirza deploy <model_id>` | Télécharger un modèle sur le serveur |
| `mirza serve [model_id]` | Démarrer le serveur d'inférence |
| `mirza stop` | Arrêter le serveur d'inférence |
| `mirza chat` | Chat interactif en terminal |
| `mirza ui` | Lancer la WebUI de chat |
| `mirza tunnel [port]` | Tunnel SSH vers l'API MLX |
| `mirza config [--refresh]` | Voir/régénérer la configuration |

---

## Roadmap

- [x] Configuration headless du Mac Mini
- [x] Connexion SSH et outils CLI
- [x] Stack de monitoring (Grafana + Prometheus + macmon)
- [x] Configuration auto-générée via SSH (`mirza.conf`)
- [x] Installation MLX via uv + LaunchAgent
- [x] Catalogue de modèles avec compatibilité RAM
- [x] CLI étendu (13 commandes)
- [x] WebUI Chat avec streaming
- [ ] Benchmarks Apple Silicon (M1 vs M2 vs M4…)
- [ ] Support RAG (upload de documents)
- [ ] Fine-tuning local via LoRA/QLoRA
- [ ] Intégration Tailscale (accès distant sécurisé)
- [ ] Dashboard Grafana pour métriques MLX (tokens/s, VRAM, latence)

---

## Contribuer

Les contributions sont les bienvenues ! Si vous avez un Mac Mini qui prend la poussière et des idées pour l'exploiter, n'hésitez pas à ouvrir une **issue** ou une **pull request**.

Merci de respecter les conventions suivantes : créez une branche par feature (`feature/ma-feature`), écrivez des messages de commit clairs, et testez vos scripts avant de soumettre.

---

## 📄 Licence

Ce projet est distribué sous licence **GNU GENERAL PUBLIC LICENSE**. Voir le fichier Licence pour plus de détails.

---

<p align="center">
  <i>Fait avec ☕ et un Mac Mini qui ne dort jamais.</i>
</p>
