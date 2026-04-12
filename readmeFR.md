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
  <i>Transformez votre Mac Mini en bête de course dopée aux stéroïdes pour l'IA générative locale.</i><br/>
  <i>Pas d'écran, pas de clavier, pas de nuage (c'est le cloud des autres).</i>
</p>

---

## 📖 Table des matières

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

## 🌟 Présentation

**Mirza** documente — et automatise — la transformation complète d'un Mac Mini Apple Silicon (M1, M2, M3, M4…) qui passait sa vie à afficher des mails, en un **serveur d'inférence IA dédié**, puissant, réactif et surveillé à la culotte.
Pourquoi le Mac Mini ? Parce que sa RAM unifiée fait pleurer les ingénieurs de chez Nvidia. Pourquoi en local ? Parce que payer 20 balles par mois pour qu'une IA dans le Nevada vous écrive une fonction `sqrt()` en Python, c'est surfait. 

**L'objectif est simple :** brancher le Mac sur le réseau, jeter l'écran à la cave, et tout piloter à distance via SSH ou la superbe interface Web intégrée. Un peu comme un Tamagotchi, mais avec 32 Go de RAM unifiée et qui peut réellement vous aider à travailler.

> **⚠️ Alerte Wi-Fi : Connexion filaire fortement recommandée.**
> Ce guide présuppose que le serveur est branché en Ethernet. Le Wi-Fi, c'est sympa pour regarder Netflix sur les toilettes, mais pour un serveur d'IA, autant jouer à la roulette russe. Si vous insistez pour rester sans-fil, assumez votre latence et vos futurs regrets.

---

## 🛠 Prérequis

| Élément | Version / Détail |
|---|---|
| **Machine cible** | Mac Mini Apple Silicon (M1 à M4). Si c'est un Intel, recyclez-le en chauffage d'appoint. |
| **macOS** | Sequoia 15.x (la hype ou rien) |
| **Machine cliente** | N'importe quel poste sous Linux/Ubuntu (pour de vrai, même Windows Subsystem for Linux fera l'affaire en pleurant un peu). |
| **Bash** | 5.2+ (on ne vit pas dans le passé) |
| **SSH** | OpenSSH 9.x |
| **Réseau** | Un bon vieux câble RJ45 CAT6 minimum. |
| **Patience** | Très utile, notamment lors du téléchargement d'Xcode (12 Go de bonheur). |
| **Café / Boisson Énergétique** | Obligatoire pour la Phase 2. Prévoyez-en un pack. |

---

## 🍏 Phase 1 — Préparation de macOS (depuis l'interface graphique)

L'heure de faire comprendre à macOS que ce n'est plus un ordinateur grand public mais une **bête de somme**. Il va falloir le sevrer de l'interface graphique. Délicatement.

### 1. Ne Jamais Fermer L'Œil
Allez dans **Réglages Système** → **Écrans** → **Avancé…**
Cochez la case **"Empêcher la suspension d'activité automatique."** Le repos, c'est pour les faibles.

Ensuite, dans **Réglages Système** → **Énergie** :
Activez **"Démarrer automatiquement après une panne de courant"** (sinon à quoi bon). Cochez aussi **"Réactiver lors d'un accès réseau"** pour lui balancer des datagrammes Wake-on-LAN au réveil.

### 2. Le Baptême (Identité Réseau)
Dans **Réglages Système** → **Général** → **Partage** :
En bas, sous *Nom d'hôte local*, cliquez sur *Modifier…* et tapez : `mirza`.
Boum. Vous venez de créer `mirza.local`. Marre de copier coller des IPs comme `192.168.1.42`. 

### 3. Le Cordon Ombilical SSH
Toujours dans les paramètres de Partage : Activez la **Session à distance** (le saint SSH d'Apple). Ajoutez votre profil. Cochez **Partage d'écran** si vous n'êtes pas hyper confiant dans vos talents SSH et que le VNC vous rassure la nuit.

> **Bravo !** Vous pouvez le débrancher de l'écran. Il est libre. (Enfin, surtout esclave de vos futures requêtes LLM.)

---

## 🌐 Phase 2 — Configuration du Routeur / Box Internet

Parce qu'un serveur qui chage d'IP à chaque boot, c'est comme essayer d'envoyer un colis à un agent secret amnésique.

**Étape 1** — Piratez... pardon, connectez-vous légalement à l'IP de votre box (souvent le traditionnel `192.168.1.1`).
**Étape 2** — Trouvez la section de Baux Statiques / DHCP. (Généralement cachée sous "Options Avancées" pour vous faire peur).
**Étape 3** — Fixez l'IP (ex: `192.168.1.87`) pour l'adresse MAC de Mirza. Pour la connaitre, dans le terminal Mac :
```bash
networksetup -getmacaddress Ethernet
```
**Étape 4** — Si votre routeur a mal géré l'option **"IGMP Snooping"**, désactivez-la pour garantir que `mirza.local` réponde au mDNS.
**Étape 5** — Ouvrez l'App Store et téléchargez Xcode. Prenez une douche, faites un marathon, revenez. Ça fait 12 Go. C'est le boss final de la consommation de données.

---

## 🚀 Phase 3 — Première connexion

Vous n'avez plus besoin d'écran. Votre clavier sans-fil logitech commence à prendre la poussière. Tout se passe de loin.

```bash
ssh votre_nom_user_mac@mirza.local
```
Si la connexion saute, c'est soit que votre box DHCP n'a pas pris effet, soit que vous avez oublié l'étape du Partage (Phase 1). Retournez brancher l'écran dans la honte.

Une fois branché :
1. Copiez vos clés SSH via `./mirza/gatcha.sh` (votre mot de passe vous énervera moins souvent).
2. Lancez le setup :
```bash
./mirza/mirza.sh
```
Il installe le framework Mirza et ses alias magiques.

---

## 📊 Phase 4 — Monitoring (Grafana + Prometheus)

Ouvrir l'IA sans monitoring, c'est traverser une autoroute les yeux bandés en criant YOLO.

Heureusement, on déploie la *Sainte Trinité* du sysadmin: Grafana, Prometheus et Macmon (pour la puce M-series). Vous allez pouvoir scruter la moindre chauffe de votre GPU Unifié, et regarder votre SSD souffrir en temps réel ! 

Installation :
```bash
# Entrez dans la matrice Mirza
chmod +x mirzaServer/monitoring/setup_monitoring.sh
./mirzaServer/monitoring/setup_monitoring.sh
```
*Note: Le script rajoutera les triggers adéquats via crontab pour Homebrew. Pas de perte de BDD Grafana à chaque tentative, promis !*

---

## 🧠 Phase 5 — Déploiement IA (MLX)

C'est là que la blague de serveur se transforme en IA sérieuse. Apple a sorti MLX, le PyTorch du pauvre mais extrêmement riche en performances Apple Silicon. Adieu Python qui crash, Bonjour **uv**, le gestionnaire d'environnement écrit en Rust (parce qu'il fallait bien de la rouille).

```bash
chmod +x mirzaServer/ai/setup_mlx.sh
./mirzaServer/ai/setup_mlx.sh
```

**Qu'allez-vous faire tourner là-dessus ?**
- 💬 *Conversation* : Llama, Qwen, Gemma (Les Avengers des LLMs ouverts).
- 💻 *Code* : Devstral (Parce que ChatGPT rate toujours ce fameux point virgule).
- ⚡ *MoE, RAG et Ultra-Léger*.

L'outil `mlx-lm` lance une API *100% compatible OpenAI* en local au port 8080.
Pour tester :
```bash
mirza models      # Montrez-moi ce qu'on a en magasin
mirza deploy nom_modele # Téléchargement depuis les tréfonds de HuggingFace
mirza serve       # IT'S ALIVE!
```

---

## 🖥 Phase 6 — WebUI Chat

Vous vouliez l'interface de ChatGPT mais... chez vous, pour vous, et qui ne vend pas vos données ? On l'a fait. L'interface Mirza AI est un petit chef-d'œuvre de HTML/JS (zéro dépendance Node/NPM, parce qu'on aime les choses propres).

- 💬 **Streaming en direct** : Voyez les tokens s'afficher plus vite que vous ne lisez.
- 🎨 **UI soignée** avec mode sombre.
- 📈 **Grafana** intégré directement dans le menu : Admirez le CPU fondre en 1 clic.
- 🔧 **Multi-providers** et **Model Context Protocol (MCP)** supportés.

**Démarrage Express :**
```bash
mirza ui # Sur votre client local
```
Allez sur `http://localhost:3333` et amusez-vous.

---

## ⌨ Commandes CLI de BG

| Commande `mirza` | Action héroïque |
|---|---|
| `start` | Envoie un jet d'eau Wake-on-LAN au Mac endormi. |
| `ssh` | Pour les vrais. |
| `status` | Est-ce que ça marche ou ça cramé ? |
| `models` / `deploy` | Fait vos courses chez HuggingFace. |
| `ui` | Déploie la Batmobile (Interface Web). |

---

## 📝 Roadmap

Parce qu'on s'ennuie vite :
- [x] Outils CLI pour fainéants
- [x] Monitoring ultra performant (merci Macmon)
- [x] Serveur API OpenAI compatible
- [x] Web UI sans le bloatware React
- [x] Grafana intégré à l'UI 😎
- [ ] Outils complets pour agentic workflow (Agent MCP, Web Search)
- [ ] Benchmarking (Histoire de justifier le prix du M4 Pro à sa moitié)

---

## 🤝 Contribuer

Vous avez écrit un script Bash plus propre que le mien ? (C'est pas dur). Vous voulez rajouter du tailscale ? Faites péter la **Pull Request**. On est sympas, on mord pas (sauf si vous n'avez pas rebase).

---

## 📄 Licence
Licence **GPLv3**. Copiez, distribuez, modifiez, mais laissez les droits ouverts et citez vos sources sinon le karma (et Richard Stallman) vous rattrapera.
