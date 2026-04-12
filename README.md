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

<h1 align="center"> Mirza — Local AI Station for Apple Silicon</h1>

<p align="center">
  <i>Supercharge your old Mac Mini into a full-fledged local generative AI beast.</i><br/>
  <i>No screen, no keyboard, no pesky cloud subscriptions.</i>
</p>

---

## 📖 Table of Contents

- [Overview](#-overview)
- [Prerequisites](#-prerequisites)
- [Architecture](#-architecture)
- [Phase 1 — macOS Preparation](#-phase-1--macos-preparation-from-the-gui)
- [Phase 2 — Router / Network Setup](#-phase-2--router--network-setup)
- [Phase 3 — First Contact](#-phase-3--first-contact)
- [Phase 4 — Monitoring](#-phase-4--monitoring)
- [Phase 5 — AI Deployment (MLX)](#-phase-5--ai-deployment-mlx)
- [Phase 6 — WebUI Chat](#-phase-6--webui-chat)
- [CLI Commands](#-cli-commands)
- [Roadmap](#-roadmap)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🌟 Overview

**Mirza** documents — and automates — the complete transformation of an Apple Silicon Mac Mini (M1, M2, M3, M4...) from a boring email-checker into a **dedicated AI inference server**, robust and fully monitored end-to-end.  
Why the Mac Mini? Because its unified RAM architecture makes traditional PC builders weep softly in the corner. Why local? Because paying $20/month for an API to write a `Hello World` loop in Python is so last year.

**The goal is simple:** plug the Mac into the network, toss the monitor out the window (figuratively), and remotely control everything via SSH and an integrated Web UI. Think of it like a Tamagotchi, but with 32GB of unified memory and the ability to actually help you write code.

> **⚠️ Wi-Fi Alert : Wired connection strongly recommended.**
> This guide assumes your server is hooked up via Ethernet. Wi-Fi is cute for watching Netflix in bed, but for an AI server, you might as well play Russian Roulette with your latency. If you're a masochist and insist on Wi-Fi, fully embrace the lag. You've been warned.

---

## 🛠 Prerequisites

| Element | Version / Detail |
|---|---|
| **Target Machine** | Apple Silicon Mac Mini (M1 to M4). If it has Intel inside, turn it into a space heater. |
| **macOS** | Tahoe 26.x (the latest and greatest) |
| **Client Machine** | Any device running Linux/Ubuntu (yes, WSL might work if you enjoy suffering). |
| **Bash** | 5.2+ (we don't live in the stone age) |
| **SSH** | OpenSSH 9.x |
| **Network** | A good old RJ45 CAT6 cable. |
| **Patience** | Highly necessary for the 12GB Xcode download. |
| **Coffee** | At least one cup. Maybe pour a second one. |

---

## 🏗 Architecture

Here is the exact layout of the repository and how the components interact:

```text
mirza.local/
├── mirza/                        # 🖥  Client-side tools (your Linux machine)
│   ├── gatcha.sh                 #    SSH Setup + info retrieval
│   ├── mirza.sh                  #    Main CLI wrapper (13 commands)
│   ├── gen_config.sh             #    Configuration generator
│   └── mirza.conf                #    Auto-generated configuration file
│
├── mirzaServer/                  # 🍎 Server-side scripts (the Mac)
│   ├── monitoring/
│   │   ├── setup_monitoring.sh   #    Installation script: Grafana + Prometheus + macmon
│   │   └── *.json                #    Pre-configured Grafana dashboards
│   ├── ai/
│   │   ├── setup_mlx.sh          #    uv + MLX + LaunchAgent setup
│   │   └── models.json           #    Pre-curated catalog of MLX models
│   └── utils/
│       ├── baptism.sh            #    Server renaming tool
│       └── .zshrc                #    Recommended shell configuration
│
├── webui/                        # 🌐 WebUI Chat interface (multi-provider)
│   ├── index.html                #    Structure + settings modal + iframe Grafana
│   ├── style.css                 #    Design system (dark mode + orange accents)
│   ├── app.js                    #    Multi-provider logic, streaming, MCP tools
│   ├── server.py                 #    Local API Server & remote exec via SSH
│   └── serve.sh                  #    Easy local startup
│
├── docs/                         # 📚 Documentation
│   └── MCP_ROADMAP.md            #    MCP (Model Context Protocol) roadmap
│
├── README.md                     #    This English document
├── readmeFR.md                   #    French version (pour les baguettes)
└── LICENSE                       #    GPLv3 License
```

---

## 🍏 Phase 1 — macOS Preparation (from the GUI)

Time to gently let macOS know it's no longer a casual consumer toy; it's a workhorse now. Let's wean it off its graphical interface. 

### 1. Sleep is for the weak
Go to **System Settings** → **Displays** → **Advanced…**  
Check **"Prevent automatic sleeping when the display is off"**. 

Then head to **System Settings** → **Energy** :  
Enable **"Start up automatically after a power failure"** (mandatory for servers). Also check **"Wake for network access"** so we can zap it with Wake-On-LAN magic.

### 2. The Christening (Network Identity)
In **System Settings** → **General** → **Sharing** :  
Scroll down to *Local hostname*, click *Edit…* and type: `mirza`.  
Boom. You've just created `mirza.local`. We don't have time to memorize IPs like `192.168.1.42`. 

### 3. The SSH Umbilical Cord
Still in Sharing: Turn on **Remote Login** (Apple's fancy name for SSH). Allow your user. Also tick **Screen Sharing** if you secretly don't trust terminal commands and want an escape pod.

> **Congratulations!** Unplug that monitor. You're flying blind from here on out.

---

## 🌐 Phase 2 — Router / Network Setup

A server that changes its IP every reboot is like an undercover operative with amnesia. Unacceptable.

**Step 1** — Log into your dreaded router's admin panel (usually `192.168.1.1`).  
**Step 2** — Find the DHCP / Static IP section. (It's usually buried under "Advanced Options" to keep mere mortals away).  
**Step 3** — Reserve a static IP (e.g. `192.168.1.87`) for Mirza's MAC address. To get it, run this on the Mac terminal before you toss the keyboard:
```bash
networksetup -getmacaddress Ethernet
```
**Step 4** — Disable **"IGMP Snooping"** if your router breaks mDNS, ensuring `mirza.local` actually resolves.  
**Step 5** — Download Xcode from the App Store. Yes, it's 12GB. Go for a run, bake a cake, reconsider your life choices. 

---

## 🚀 Phase 3 — First Contact

Now you only talk to Mirza from afar. 

```bash
ssh your_mac_username@mirza.local
```
If this hangs, you either messed up Phase 1 or Phase 2. Go get the monitor out of the basement in shame.

Once logged in:
1. Inject your SSH keys via `./mirza/gatcha.sh` (passwords are for peasants).
2. Install the setup:
```bash
./mirza/mirza.sh
```
This deploys the Mirza framework and its magical CLI tools.

---

## 📊 Phase 4 — Monitoring (Grafana + Prometheus)

Running AI without monitoring is like driving down a highway at night with no headlights and screaming "YOLO". 

We're deploying the Holy Trinity of sysadmin tech: Grafana, Prometheus, and Macmon (for M-series chips). Watch your Unified Memory cry and your GPU fry in real-time!

Installation:
```bash
chmod +x mirzaServer/monitoring/setup_monitoring.sh
./mirzaServer/monitoring/setup_monitoring.sh
```
*Note: The script adds crontab safeguards (`@reboot`) for Homebrew services so that Grafana starts headless after a reboot, without wiping configs. The Grafana database is located at `/opt/homebrew/var/lib/grafana/grafana.db` on the Mac.*

---

## 🧠 Phase 5 — AI Deployment (MLX)

Apple made MLX, which is basically PyTorch but highly optimized for Apple Silicon. Say goodbye to environment chaos and hello to **uv**, the ridiculously fast Python package manager written in Rust (because everything is Rust nowadays).

```bash
chmod +x mirzaServer/ai/setup_mlx.sh
./mirzaServer/ai/setup_mlx.sh
```

**Where are models saved?**
Models are downloaded through Hugging Face via the `mlx_lm` utility and are cached directly in your Mac's disk under `~/.cache/huggingface/hub/`.

`mlx-lm` boots up a 100% OpenAI compatible API locally on port 8080.
Try this out:
```bash
mirza models      # Let's see the menu
mirza deploy model_name # Download it from HuggingFace
mirza serve       # IT'S ALIVE!
```

---

## 🖥 Phase 6 — WebUI Chat

You wanted the ChatGPT interface but ad-free, completely private, and hosted on your own metallic little box? We got you. Mirza AI Interface is built in pure HTML/JS, served via Python.

- 💬 **Live streaming**: Watch tokens render faster than you can read them.
- 🎨 **Beautiful UI** with a sick dark/orange theme.
- 📈 **Grafana integration**: Deeply integrated. You can monitor Grafana right in an iframe from the UI via `mirza.local`.
- 🔧 **Multi-providers** and **Model Context Protocol (MCP)** support.

**Quickstart:**
```bash
mirza ui # On your local client
```
Hop onto `http://localhost:3333` and enjoy.

---

## ⌨ Nerd CLI Commands

| `mirza` Command | Heroic Action |
|---|---|
| `start` | Shoots a Wake-on-LAN packet to wake up the sleeping beauty. |
| `ssh` | Connect right to it like a boss. |
| `status` | Is it working or is it on fire? |
| `config` | View or regenerate the hw/sw configs for the remote endpoint. |
| `models` / `deploy` | Go shopping at HuggingFace. |
| `serve` / `stop` | Start/stop the MLX server directly. |
| `chat` | Interact in the terminal. |
| `ui` | Release the Web UI Kraken. |

---

## 📝 Roadmap

Because we get bored easily:
- [x] Mac Mini headless setup guide
- [x] CLI Tools for the lazy among us
- [x] Heavy duty monitoring (thanks Macmon)
- [x] OpenAI-compatible native server
- [x] WebUI without the bloated React boilerplate
- [x] Integrated Grafana right in the UI 😎
- [ ] Complete Agentic Workflows (MCP Agents, Web Search)
- [ ] Benchmarks (so you can justify buying the M4 Pro to your partner)

---

## 🤝 Contributing

Did you write a cleaner Bash script than me? (It's not that hard). Want to implement Tailscale? Throw us a **Pull Request**. We don't bite unless you forgot to rebase.

---

## 📄 License
**GPLv3** Licensed. Copy it, distribute it, mod it, but please keep the source open and quote where it came from, otherwise karma (and Richard Stallman) will come for you. 
