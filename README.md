# Mirza — Local AI Inference Station on Apple Silicon

![Mirza Logo](mirzalogo.jpeg)

> Turn a Mac Mini (or any Apple Silicon Mac) into a headless, dedicated AI inference server.  
> Controlled entirely from a remote Linux machine via CLI and a full-featured WebUI.  
> No cloud. No API keys. No display required. Just SSH, unified memory, and Metal acceleration.

---

## Table of Contents

- [What Is This](#what-is-this)
- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Project Structure](#project-structure)
- [Phase 1 — macOS Preparation (GUI Required)](#phase-1--macos-preparation-gui-required)
- [Phase 2 — Network Configuration](#phase-2--network-configuration)
- [Phase 3 — Client Installation](#phase-3--client-installation)
- [Phase 4 — First Contact & Server Setup](#phase-4--first-contact--server-setup)
- [Phase 5 — Monitoring Stack (Grafana + Prometheus)](#phase-5--monitoring-stack-grafana--prometheus)
- [Phase 6 — AI Inference (Llama.cpp / GGUF)](#phase-6--ai-inference-llamacpp--gguf)
- [Phase 7 — The WebUI](#phase-7--the-webui)
- [CLI Reference](#cli-reference)
- [API Reference](#api-reference)
- [Inference Configuration](#inference-configuration)
- [Key File Locations](#key-file-locations)
- [Troubleshooting](#troubleshooting)
- [Why the Name? Why Mirza?](#why-the-name-why-mirza)
- [Roadmap](#roadmap)
- [License](#license)

---

## What Is This

Mirza is a complete remote management and AI inference toolkit. The Mac sits headless on your local network (Ethernet, no monitor), and you control it entirely from a Linux client machine through:

- **`mirza` CLI** — A bash CLI with 16 commands for server management, model downloads, inference control, and chat.
- **WebUI** — A full single-page application with Dashboard, Chat, Model Catalog, Config, Monitoring, and Documentation tabs.
- **REST API** — A Python backend (`server.py`) that relays commands over SSH and exposes a clean JSON API.

Inference runs via **llama-cpp-python** with Metal acceleration, serving an **OpenAI-compatible API** on port 8080. Any tool, library, or application that speaks the OpenAI protocol works out of the box.

---

## Architecture Overview

```
┌─────────────────────────────────┐          ┌──────────────────────────────────────┐
│        Linux Client             │          │         Mac Mini (mirza.local)        │
│                                 │          │                                       │
│  ┌───────────┐   ┌───────────┐  │   SSH    │  ┌──────────────────────────────┐    │
│  │  mirza    │   │ WebUI     │  │ ◄──────► │  │  llama-cpp-python (uv venv)  │    │
│  │  CLI      │   │ server.py │  │          │  │  ┌──────────────────────────┐│    │
│  │ (mirza.sh)│   │ :3333     │  │   API    │  │  │ llama_cpp.server  :8080  ││    │
│  └───────────┘   │ + app.js  │  │ ◄──────► │  │  │ OpenAI-compatible API    ││    │
│                  └───────────┘  │          │  │  └──────────────────────────┘│    │
│                                 │          │  │  GGUF Models: ~/mirza-models/ │    │
│                  Browser        │          │  └──────────────────────────────┘    │
│                  localhost:3333 │          │                                       │
│                                 │          │  ┌──────────────────────────────┐    │
│                  HuggingFace API│          │  │  Monitoring Stack             │    │
│                  (live catalog) │          │  │  Grafana :3000                │    │
│                                 │          │  │  Prometheus :9090             │    │
└─────────────────────────────────┘          │  │  Macmon :9091 (Apple Silicon) │    │
                                             │  └──────────────────────────────┘    │
                                             └──────────────────────────────────────┘
```

---

## Prerequisites

| Component | Requirement |
|-----------|-------------|
| **Target Machine** | Any Mac with Apple Silicon (M1, M2, M3, M4 — all variants). Intel Macs not supported. |
| **macOS Version** | macOS 13 Ventura or later. macOS 15 Sequoia / 26 Tahoe tested. |
| **Client Machine** | Linux (Ubuntu 24.04 LTS recommended). WSL2 works but is slower. |
| **Bash** | 5.2+ on the client |
| **Python** | 3.11+ on the client (for `server.py`) |
| **SSH** | OpenSSH 9.x on both ends |
| **Network** | Wired Ethernet (CAT6 minimum). Wi-Fi is for video, not 26B-parameter inference. |
| **Xcode** | Required on the Mac for Metal-accelerated compilation of llama-cpp-python |

---

## Project Structure

```text
mirza.local/
│
├── mirza/                          Client-side tools (your Linux machine)
│   ├── mirza.sh                    Main CLI — 16 commands
│   ├── gatcha.sh                   SSH key exchange and env var injection
│   ├── gen_config.sh               Connects to the Mac via SSH and populates mirza.conf
│   └── mirza.conf                  Auto-generated config file (do not edit manually)
│
├── mirzaServer/                    Server-side scripts (deployed TO the Mac via rsync)
│   ├── monitoring/
│   │   ├── setup_monitoring.sh     Installs Grafana, Prometheus, Macmon, configures crontab @reboot
│   │   └── *.json                  Pre-built Grafana dashboard definitions
│   ├── ai/
│   │   └── models.json             Local model catalog fallback (WebUI now uses live HF API)
│   └── utils/
│       ├── baptism.sh              Renames the Mac hostname to "mirza"
│       └── .zshrc                  Recommended Zsh config for the server
│
├── llmServe/                       AI backend (deployed TO the Mac, managed by uv)
│   ├── pyproject.toml              Python dependencies: llama-cpp-python, huggingface-hub, tqdm
│   ├── serve_llama.py              Wraps llama_cpp.server with advanced inference flags
│   ├── deploy_llama.py             Downloads GGUF models from HuggingFace with progress tracking
│   └── active_model.json           Written on each download; tracks the currently active model
│
├── webui/                          WebUI (runs on your client machine, port 3333)
│   ├── index.html                  SPA layout: Dashboard, Chat, Models, Config, Monitoring, Docs
│   ├── style.css                   Design system: dark theme, violet accents, glass morphism
│   ├── app.js                      Full application logic, HuggingFace live API integration
│   └── server.py                   Python backend: REST API, SSH relay, static file serving
│
├── docs/
│   └── MCP_ROADMAP.md              Roadmap for Model Context Protocol integration
│
├── installation.sh                 One-command client setup: deps, CLI symlink, SSH keys, deploy
├── README.md                       This file (English)
├── readmeFR.md                     French version
└── LICENSE                         GPLv3
```

---

## Phase 1 — macOS Preparation (GUI Required)

This is the only time you need a monitor plugged into the Mac.

### 1. Prevent Sleep

**System Settings → Displays → Advanced...** — Enable "Prevent automatic sleeping when the display is off."

**System Settings → Energy** — Enable "Start up automatically after a power failure" and "Wake for network access."

The Mac must **never sleep on its own**. It is a server now.

### 2. Set the Hostname

**System Settings → General → Sharing** — Under "Local hostname", click "Edit..." and set it to `mirza`.

This makes the Mac reachable at `mirza.local` via mDNS/Bonjour on your LAN.

### 3. Enable Remote Login (SSH)

Still in Sharing — enable **Remote Login**. Add your user account to the allowed list.

Optionally enable **Screen Sharing** (VNC) as a safety net for initial setup.

### 4. Install Xcode

Download Xcode from the App Store (~12–16 GB). Accept the license:

```bash
sudo xcodebuild -license accept
```

Xcode is required to compile **llama-cpp-python** with Metal GPU support.

After Xcode is done, unplug the monitor. The Mac is now a server.

---

## Phase 2 — Network Configuration

Assign a **static DHCP lease** to the Mac's Ethernet MAC address in your router's admin interface. This ensures the IP never changes.

```bash
# On the Mac (before unplugging the screen):
networksetup -getmacaddress Ethernet
```

> If `mirza.local` doesn't resolve, check that your router isn't filtering mDNS (disable IGMP Snooping if needed).

---

## Phase 3 — Client Installation

```bash
git clone <repo-url> ~/git/mirza.local
cd ~/git/mirza.local
chmod +x installation.sh
./installation.sh
```

The installation script does the following in order:

| Step | What it does |
|------|-------------|
| **1. System Dependencies** | Installs `jq`, `curl`, `wakeonlan`, `python3`, `ssh`, `rsync` via apt/pacman/dnf |
| **2. CLI Symlink** | Creates `~/.local/bin/mirza → mirza/mirza.sh`. Adds `~/.local/bin` to `$PATH` if missing |
| **3. Connectivity Check** | Verifies SSH reachability on `mirza.local:22` |
| **4. Server Deployment** | `rsync` the `mirzaServer/` **and** `llmServe/` directories to the Mac |
| **5. AI Environment Init** | SSH into the Mac and runs `cd ~/llmServe && uv sync` to install Python dependencies |
| **Monitoring (optional)** | Runs `setup_monitoring.sh` remotely to install Grafana, Prometheus, Macmon |

After installation:

```bash
source ~/.bashrc
mirza status
```

---

## Phase 4 — First Contact & Server Setup

```bash
# Interactive SSH session
mirza ssh

# On the Mac — rename the hostname (if not already done via System Settings)
chmod +x ~/mirzaServer/utils/baptism.sh
~/mirzaServer/utils/baptism.sh
```

Generate or refresh the local configuration file:

```bash
mirza config --refresh
```

This connects to the Mac via SSH, collects hardware info (chip, RAM, GPU cores, macOS version), and writes it to `mirza/mirza.conf`.

---

## Phase 5 — Monitoring Stack (Grafana + Prometheus)

The monitoring stack is installed automatically during `installation.sh`. It can also be triggered manually:

```bash
# On the Mac via SSH
bash ~/mirzaServer/monitoring/setup_monitoring.sh
```

| Component | Port | Role |
|-----------|------|------|
| **Grafana** | 3000 | Dashboard visualization |
| **Prometheus** | 9090 | Metrics collection and storage |
| **Macmon** | 9091 | Apple Silicon-specific exporter: CPU/GPU/ANE power, temps, RAM, core clusters |
| **node_exporter** | 9100 | Standard OS metrics: disk, network, filesystem |

All services auto-start after reboot via `crontab @reboot` entries.

**Accessing Grafana:**
- Direct: `http://mirza.local:3000`
- Via WebUI: The Monitoring tab embeds Grafana in kiosk mode via iframe

![Grafana Monitoring](grafanamonitoring.png)

---

## Phase 6 — AI Inference (Llama.cpp / GGUF)

Mirza uses **llama-cpp-python** with Metal acceleration. The backend runs in a `uv`-managed virtual environment at `~/llmServe` on the Mac.

### Model Storage

All downloaded GGUF files are stored in:
```
~/mirza-models/           (on the Mac)
```

Active model metadata is tracked in `~/llmServe/active_model.json`.

### Downloading Models

```bash
# Via CLI (auto-selects best quantization)
mirza deploy ggml-org/gemma-3-4b-it-GGUF

# Via CLI (specify exact file)
mirza deploy ggml-org/Qwen2.5-Coder-7B-Q8_0-GGUF Qwen2.5-Coder-7B-Q8_0.gguf

# Via WebUI — Models tab → "↓ Télécharger"
# Shows real-time download progress bar
```

### Starting the Inference Server

```bash
# Default: 8k context, Q8_0 KV cache, Flash Attention ON
mirza serve

# Advanced options
mirza serve --ctx 32768 --kv-q q8_0 --no-fa --port 8080
```

The server exposes an **OpenAI-compatible REST API**:

```bash
curl http://mirza.local:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "auto", "messages": [{"role": "user", "content": "Hello"}]}'
```

### Managing Models

```bash
mirza models                        # List all compatible models (from local catalog)
mirza deploy <hf-repo> [filename]   # Download a GGUF model from HuggingFace
mirza remove              # Delete a model file from ~/mirza-models
mirza stop-llm                      # Kill the inference server
```

![Installed Models](installedmodels.png)

---

## Phase 7 — The WebUI

The WebUI is a single-page application served from your Linux machine, communicating with the Mac via the Python REST backend.

![Dashboard View](dashboardpage.png)

### Starting the WebUI

```bash
mirza ui
# Opens http://localhost:3333
```

### Stopping the WebUI

```bash
mirza stop-ui
```

### WebUI Tabs

| Tab | Description |
|-----|-------------|
| **Dashboard** | Server status (online/offline), hardware info (chip, CPU, GPU, RAM), active model, quick action buttons (Wake, Stop LLM, Sleep, Reboot), live LLM logs |
| **Chat** | Full streaming chat interface. Multi-provider (local LLM, OpenAI, Anthropic, Groq, Mistral, Ollama). Conversation history, MCP tool integration. Settings for temperature, top-p, system prompt, max tokens. |

![Chat Example](chat-exemple.png)

![Chat Settings](settinghyperparameters.png)

| **Models** | Live catalog from `ggml-org` on HuggingFace. Capability badges (MoE, Vision, Audio, Embedding, Tools, Long Context, Code, Reasoning). RAM filtering, family/category filters, Top 10 recommendations, download progress bar |

![Model Catalog](modelcatalog.png)
| **Config** | Displays `mirza.conf` contents. "Refresh" button re-runs `gen_config.sh` remotely |

![Configuration](configuration.png)
| **Monitoring** | Grafana dashboard embedded in kiosk mode via iframe |
| **Documentation** | Built-in usage guide |



### Model Catalog — How It Works

The WebUI fetches real-time data from `huggingface.co/api/models?author=ggml-org`. For each model, it:

1. Detects capabilities from the repo name and HuggingFace tags: MoE, Vision/Multimodal, Audio, Embedding/RAG, Function Calling, Long Context, Code, Reasoning
2. Extracts parameters (e.g., `26B`, `E4B → 4B`, `0.5B`) and quantization (e.g., `Q4_K_M`, `Q8_0`)
3. Estimates RAM usage: `model_size_gb + kv_cache_gb + 4 GB (OS overhead)`  
   → MoE models use only ~20% active parameters, so memory estimates are adjusted accordingly
4. Estimates tokens/sec based on chip memory bandwidth (`M4 ~120 GB/s`, `M4 Pro ~200 GB/s`, `M4 Max ~400 GB/s`, `M4 Ultra ~800 GB/s`)
5. Models that exceed your RAM are grayed out. Models fitting your hardware get a **⭐ Top Mirza** recommendation.

### Inference Configuration Modal

When clicking "▶ Servir" on any model card, a modal opens with:

| Parameter | Options | Default |
|-----------|---------|---------|
| **Context Window (n_ctx)** | 2k / 4k / 8k / 16k / 32k / 128k | 8k |
| **KV Cache Quantization** | F16 (max precision), Q8_0 (recommended), Q4_0 (max savings) | Q8_0 |
| **Flash Attention** | On/Off | On |

---

## CLI Reference

All commands use the format `mirza <command> [options]`.

![Mirza CLI](mirzash.png)

### Server Management

| Command | Description |
|---------|-------------|
| `mirza start` | Send a Wake-on-LAN magic packet to the Mac |
| `mirza ssh` | Open an interactive SSH session on the Mac |
| `mirza status` | Check server ping, LLM API (port 8080), Grafana (port 3000), active model |
| `mirza sleep` | Put the Mac to sleep via `pmset sleepnow` |
| `mirza reboot` | Reboot the Mac via `sudo shutdown -r now` |

### AI Model Management

| Command | Description |
|---------|-------------|
| `mirza models [category]` | Display the local model catalog, filtered by RAM. Categories: `general`, `code`, `reasoning`, `multimodal`, `light` |
| `mirza deploy <hf-repo> [file]` | Download a GGUF model from HuggingFace. Auto-selects best quantization if no file specified |
| `mirza remove <filename>` | Delete a model file from `~/mirza-models` on the Mac |
| `mirza serve [options]` | Start the llama.cpp inference server |
| `mirza stop-llm` | Kill the inference server (`pkill -f llama_cpp.server`) |
| `mirza chat` | Interactive terminal chat (multi-turn, conversation history) |

#### `mirza serve` Options

| Flag | Default | Description |
|------|---------|-------------|
| `--ctx <n>` | `4096` | Context window size (tokens) |
| `--kv-q <type>` | `f16` | KV cache quantization: `f16`, `q8_0`, `q4_0` |
| `--no-fa` | *(Flash Attention ON)* | Disable Flash Attention |
| `--port <n>` | `8080` | API port |

### Interface & Config

| Command | Description |
|---------|-------------|
| `mirza ui` | Launch the WebUI on port 3333. Auto-creates SSH tunnel to LLM API if needed |
| `mirza stop-ui` | Kill the WebUI server process |
| `mirza tunnel [port]` | Create an SSH local tunnel to the inference API |
| `mirza config` | Display the current `mirza.conf` |
| `mirza config --refresh` | Regenerate `mirza.conf` by querying the Mac via SSH |

---

## API Reference

The WebUI backend (`webui/server.py`) runs on port 3333 and exposes:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/status` | Server ping, LLM API status, Grafana status, active model, hardware info from mirza.conf |
| `GET` | `/api/config` | Contents of `mirza.conf` as JSON |
| `POST` | `/api/config/refresh` | Run `gen_config.sh` remotely and return updated config |
| `GET` | `/api/models` | Local model catalog (from `models.json`) — used as fallback/metadata |
| `POST` | `/api/server/wake` | Send Wake-on-LAN packet via `wakeonlan` |
| `POST` | `/api/server/sleep` | `pmset sleepnow` on the Mac |
| `POST` | `/api/server/reboot` | `sudo shutdown -r now` on the Mac |
| `POST` | `/api/llm/serve` | Start the llama.cpp server with inference params (model, ctx, kv_q, flash_attn) |
| `POST` | `/api/llm/stop` | Kill the inference server |
| `GET` | `/api/llm/download-status` | Poll download progress from `/tmp/mirza-download.progress` on the Mac |
| `POST` | `/api/llm/deploy` | Download a GGUF model. Body: `{hf_repo, filename?, hf_token?}` |
| `POST` | `/api/llm/remove` | Delete a model file. Body: `{filename}` |
| `GET` | `/api/llm/logs` | Last 100 lines of `/tmp/mirza-llm.log` from the Mac |
| `GET` | `/api/llm/installed` | List `.gguf` files in `~/mirza-models/` on the Mac |

---

## Inference Configuration

### KV Cache Quantization (via `--kv_q`)

| Type | Memory Savings | Quality | When to use |
|------|----------------|---------|-------------|
| `f16` | Baseline | Full precision | Always enough RAM, research use |
| `q8_0` | ~50% | Negligible loss | **Default recommendation** for Apple Silicon |
| `q4_0` | ~75% | Slight degradation | Very tight RAM (e.g., 8 GB Mac running a 7B model) |

### Flash Attention

Enabled by default. Dramatically reduces KV cache memory footprint during long contexts. Always use it on Apple Silicon (Metal-accelerated).

### Context Window

Set via `--ctx`. Larger context uses more KV cache RAM:
- 8k tokens ≈ `~1–2 GB` additional RAM
- 32k tokens ≈ `~4–8 GB` additional RAM (model-dependent)
- 128k tokens: only recommended on 64–192 GB systems

---

## Key File Locations

| What | Where | Machine |
|------|-------|---------|
| CLI script | `mirza/mirza.sh` | Linux client |
| CLI symlink | `~/.local/bin/mirza` | Linux client |
| Configuration | `mirza/mirza.conf` | Linux client |
| SSH private key | `~/.ssh/mirza_key` | Linux client |
| Env vars | `~/.bashrc` — `MIRZA_HOST`, `MIRZA_USER`, `MIRZA_MAC_ADRESS` | Linux client |
| WebUI backend | `webui/server.py` | Linux client |
| WebUI frontend | `webui/{index.html,style.css,app.js}` | Linux client |
| AI backend env | `~/llmServe/` (uv project with pyproject.toml) | Mac server |
| Inference script | `~/llmServe/serve_llama.py` | Mac server |
| Deploy script | `~/llmServe/deploy_llama.py` | Mac server |
| Active model | `~/llmServe/active_model.json` | Mac server |
| Downloaded models | `~/mirza-models/*.gguf` | Mac server |
| Download progress | `/tmp/mirza-download.progress` | Mac server |
| LLM server logs | `/tmp/mirza-llm.log` | Mac server |
| Monitoring scripts | `~/mirzaServer/monitoring/` | Mac server |
| Grafana database | `/opt/homebrew/var/lib/grafana/grafana.db` | Mac server |
| Prometheus data | `/opt/homebrew/var/prometheus/` | Mac server |

---

## Troubleshooting

### "mirza: command not found"

The symlink `~/.local/bin/mirza` isn't in your PATH yet. Fix:

```bash
source ~/.bashrc
```

### "MIRZA_USER non configuré" in server.py

The environment variable `MIRZA_USER` is missing. Run:

```bash
mirza config --refresh
source ~/.bashrc
```

Or set it manually: `export MIRZA_USER=youruser`

### Download timeout

The inference scripts have a max SSH timeout of 10 minutes (`timeout=600`). For very large models (>30 GB), consider downloading directly on the Mac:

```bash
mirza ssh
cd ~/llmServe
uv run python deploy_llama.py ggml-org/gemma-4-31B-it-GGUF
```

### "Address already in use" on port 3333

A previous `server.py` is still running:

```bash
mirza stop-ui
```

### `mirza.local` doesn't resolve

1. Confirm the Mac is on and Ethernet-connected
2. Check your router for IGMP Snooping — disable it
3. Fallback: use the Mac's static IP directly (e.g., `export MIRZA_HOST=192.168.1.87`)

### Inference server doesn't start

Check the logs:

```bash
# On the Mac
tail -50 /tmp/mirza-llm.log
tail -50 /tmp/mirza-llm.stderr.log

# Or via mirza CLI
mirza ssh -t "tail -50 /tmp/mirza-llm.log"
```

### Models are very slow / Mac is swapping

Check Grafana for memory pressure. If RAM usage exceeds 90%, the model is too large. Try:
- A smaller quantization (`Q4_K_M` instead of `Q8_0`)
- A smaller parameter count (7B instead of 14B)
- Enable `Q4_0` KV cache quantization in the serve modal

---

## Environment Variables

| Variable | Description | Set by |
|----------|-------------|--------|
| `MIRZA_HOST` | Mac hostname or IP (`mirza.local` or `192.168.1.87`) | `gatcha.sh` / manual |
| `MIRZA_USER` | SSH username on the Mac | `gatcha.sh` / manual |
| `MIRZA_MAC_ADRESS` | Ethernet MAC address (for Wake-on-LAN) | `gatcha.sh` / manual |
| `MIRZA_API_PORT` | LLM inference API port (default: `8080`) | Optional override |
| `MIRZA_WEBUI_PORT` | WebUI port (default: `3333`) | Optional override |

---

## Configuration: Connecting Your Mac

This section explains how to configure your Apple Silicon Mac to work with Mirza.

### Network Setup

1. **Connect via Ethernet**: Use a wired connection (CAT6 recommended) for maximum stability
2. **Set a static DHCP lease**: In your router's admin interface, assign a static IP to your Mac's Ethernet MAC address
3. **Verify hostname**: Ensure your Mac is reachable as `mirza.local` (or update `MIRZA_HOST`)

### SSH Configuration

```bash
# On your Mac, enable SSH:
# System Settings → General → Sharing → Remote Login

# Add your SSH public key to the Mac:
ssh-copy-id your_username@mirza.local
```

### Environment Variables

Mirza requires these variables on your **Linux client**:

```bash
export MIRZA_HOST=mirza.local        # Mac hostname or IP
export MIRZA_USER=your_username      # SSH username on Mac
export MIRZA_MAC_ADDRESS=xx:xx:xx:xx:xx:xx  # For Wake-on-LAN
```

### First Connection Test

```bash
# Test SSH connection
ssh your_username@mirza.local

# If successful, run configuration
mirza config --refresh
```

---

## Is This Vibe Coded or What?

*Confessions of a hobbyist who ran before they could walk*

### The Origin Story

This project started as a way to avoid paying OpenAI $20/month for API access. 
It evolved into a full local AI inference station that would make Geoffrey Hinton 
cry tears of joy—or horror. We're not sure which.

### The Vibe Code Chronicles

Mirza is what happens when an MLOps engineer meets a 24GB Apple Silicon Mac 
at 2AM and thinks "what if I just run the whole AI locally?"

- **Frontend**: ~90% generated by **MiniMax2.5** — the AI that actually understands 
  what "make it pop" and "fix the spacing" actually means in proper flexbox rules
- **Backend**: ~10% vibe-coded by **Petrichoeur** (Florian Bobo — AI & MLOps Engineer) — 
  mostly at 2AM, with lots of coffee and questionable life decisions
- **VRAM Optimization**: Learned the hard way that Metal really does prefer being 
  fed properly, and that `n_ubatch` is not just a random number generator

### Credits

- **MiniMax2.5**: For understanding that "make it look professional" actually means 
  "use CSS variables properly and don't hardcode hex colors everywhere"
- **Apple Silicon**: For making us believe 24GB is enough (it's never enough)
- **Llama.cpp**: For being the only library that doesn't require a PhD in CUDA 
  to run locally on consumer hardware
- **The Community**: For inspiring us to keep optimizing, tweaking, and break things 
  in creative new ways

### Disclaimer

If your Mac starts sounding like a jet engine, that's normal. 
If your wife asks why you're running a 8B parameter model on a laptop 
instead of going outside, that's between you and your therapist.

---

## Why the Name? Why Mirza?

The name **Mirza** is an homage to **Maryam Mirzakhani** (1977–2017), the brilliant Iranian mathematician who became the first woman—and first Iranian—to receive the **Fields Medal**, often described as the "Nobel Prize of Mathematics."

She made groundbreaking contributions to the geometry of curved spaces, dynamical systems, and the mathematics of billiards. Her work reshaped our understanding of complex shapes and the spaces between them.

So why name an AI inference server after her? Because the AI field—open-source models especially—has been overwhelmingly dominated by names like **Llama**, **Mistral**, **GPT**, **BERT**, **Falcon**, **Falcon**, and countless variations of "male-coded" monikers. It's 2026, and somehow we're still surprised when a model or project carries a woman's name.

Mirza is here to stand alongside the LLaMAs and Mistrals—not to replace them, but to remind us that women's contributions to science, mathematics, and technology deserve just as much space on the shelf. Maryam Mirzakhani changed the world of mathematics. This little server merely runs inference on Apple Silicon.

Maybe the next great model will carry a woman's name too. Until then, Mirza keeps the memory alive.

---

## Roadmap

- [x] CLI for complete remote Mac management (16 commands)
- [x] Monitoring stack: Grafana + Prometheus + Macmon (Apple Silicon metrics)
- [x] OpenAI-compatible inference API via llama-cpp-python + Metal
- [x] WebUI: Dashboard, Chat, Models, Config, Monitoring, Docs
- [x] Live model catalog from HuggingFace (`ggml-org` organization)
- [x] Hardware-aware model recommendations with tok/s estimation
- [x] Rich capability badges: MoE, Vision, Audio, Embedding, Tools, Long Context
- [x] Advanced inference configuration: n_ctx, KV cache quantization, Flash Attention
- [x] Real-time download progress bar
- [x] HuggingFace token support for gated models
- [x] Model deletion from CLI and WebUI
- [x] Auto-kill previous server on new serve request
- [ ] MCP server integration for agentic workflows (filesystem, web search, code execution)
- [ ] Multi-model serving (multiple models on different ports simultaneously)
- [ ] Model benchmarking harness across chip variants (M1 → M4 Ultra)
- [ ] TurboQuant integration for post-hoc quantization
- [ ] Conversation export (Markdown, JSON)

---

## License

GPLv3. Copy it, fork it, modify It. Keep it open.

---

## P.S.

Hey, it's awesome right?
