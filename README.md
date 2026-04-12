# Mirza -- Local AI Station on Apple Silicon

> Turn a Mac Mini into a headless AI inference server, piloted remotely from any Linux box.
> No screen, no keyboard, no cloud subscription. Just SSH, bash, and unified memory.

---

## Table of Contents

- [What Is This](#what-is-this)
- [Prerequisites](#prerequisites)
- [Project Structure](#project-structure)
- [Phase 1 -- macOS Preparation (GUI Required)](#phase-1----macos-preparation-gui-required)
- [Phase 2 -- Network Configuration](#phase-2----network-configuration)
- [Phase 3 -- Client Installation](#phase-3----client-installation)
- [Phase 4 -- First Contact](#phase-4----first-contact)
- [Phase 5 -- Monitoring (Grafana + Prometheus)](#phase-5----monitoring-grafana--prometheus)
- [Phase 6 -- AI Deployment (MLX)](#phase-6----ai-deployment-mlx)
- [Phase 7 -- The WebUI](#phase-7----the-webui)
- [CLI Reference](#cli-reference)
- [API Reference](#api-reference)
- [Key File Locations](#key-file-locations)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)
- [License](#license)

---

## What Is This

Mirza is a complete toolkit for turning a Mac Mini (or any Apple Silicon Mac, really) into a **dedicated, headless AI inference server** that you control entirely from a remote Linux machine.

The Mac sits on your local network, plugged into Ethernet, with no display attached. You manage it through a CLI (`mirza`) and/or a WebUI served from your client machine. Models run locally using Apple's MLX framework, which takes full advantage of the unified memory architecture. No data leaves your network. No API key required. Just math and silicon.

It also deploys a full monitoring stack (Grafana + Prometheus + Macmon) so you can watch your hardware sweat in real time. Because if you're going to push 24 GB of unified memory to its limits, you might as well look at a graph while you do it.

---

## Prerequisites

| Component | Requirement |
|---|---|
| **Target Machine** | Any Mac with Apple Silicon (M1, M2, M3, M4). Intel Macs are paperweights for this use case. |
| **macOS Version** | Tahoe 26.x |
| **Client Machine** | Linux (Ubuntu 24.04 LTS tested). WSL2 works but will remind you it's Windows at every opportunity. |
| **Bash** | 5.2+ |
| **SSH** | OpenSSH 9.x |
| **Network** | Wired Ethernet, CAT6 minimum. Wi-Fi is for watching YouTube, not serving 9 billion parameters. |
| **Patience** | Non-trivial. Xcode is 12 GB. Model downloads can take hours. |

---

## Project Structure

```text
mirza.local/
|
|-- mirza/                           Client-side tools (your Linux machine)
|   |-- mirza.sh                     Main CLI (15 commands)
|   |-- gatcha.sh                    SSH key exchange and environment setup
|   |-- gen_config.sh                Remote config generator (populates mirza.conf via SSH)
|   |-- mirza.conf                   Auto-generated config file (do not edit manually)
|
|-- mirzaServer/                     Server-side scripts (deployed TO the Mac)
|   |-- monitoring/
|   |   |-- setup_monitoring.sh      Installs Grafana, Prometheus, Macmon, configures crontab
|   |   |-- *.json                   Pre-built Grafana dashboard definitions
|   |-- ai/
|   |   |-- setup_mlx.sh             Installs uv, MLX, mlx-lm, creates LaunchAgent
|   |   |-- models.json              Curated model catalog with RAM tiers and categories
|   |-- utils/
|       |-- baptism.sh               Renames the Mac hostname
|       |-- .zshrc                   Recommended shell config for the server
|
|-- webui/                           WebUI (runs on your client machine)
|   |-- index.html                   Layout: dashboard, chat, models, config, monitoring, docs
|   |-- style.css                    Design system (dark theme, violet accents)
|   |-- app.js                       Full application logic, HuggingFace API integration
|   |-- server.py                    Python backend (REST API, SSH relay, static file serving)
|   |-- serve.sh                     Quick-start script for the WebUI
|
|-- docs/
|   |-- MCP_ROADMAP.md               Roadmap for Model Context Protocol integration
|
|-- installation.sh                  One-command client setup (deps, symlink, SSH keys, deploy)
|-- README.md                        This file
|-- readmeFR.md                      French version
|-- LICENSE                          GPLv3
```

---

## Phase 1 -- macOS Preparation (GUI Required)

This is the only time you need a monitor plugged into the Mac. Make the most of it.

### 1. Prevent Sleep

**System Settings > Displays > Advanced...** -- Check "Prevent automatic sleeping when the display is off."

**System Settings > Energy** -- Enable "Start up automatically after a power failure" and "Wake for network access."

The Mac must never sleep on its own. It's a server now.

### 2. Set the Hostname

**System Settings > General > Sharing** -- At the bottom, under "Local hostname", click "Edit..." and set it to `mirza`.

This creates `mirza.local` on the local network via mDNS/Bonjour. No more memorizing IP addresses.

### 3. Enable Remote Login

Still in Sharing: enable **Remote Login** (this is SSH). Add your user account to the allowed users list.

Optional: Enable **Screen Sharing** (VNC) if you want a safety net for the first few days. You'll stop using it once you trust the CLI. Probably.

### 4. Install Xcode

Open the App Store and download Xcode. It's around 12 GB. Go do something else for a while.

Xcode is required because Apple ships their compiler toolchain inside it. `setup_mlx.sh` needs it to compile Python packages with Metal support.

After Xcode installs, accept the license from the terminal:

```bash
sudo xcodebuild -license accept
```

You can now unplug the monitor. The Mac is on its own.

---

## Phase 2 -- Network Configuration

A server that changes IP at every reboot is a server you'll grow to hate.

1. Log into your router's admin interface (usually `192.168.1.1`).
2. Navigate to DHCP settings / Static Leases.
3. Assign a fixed IP (for example, `192.168.1.87`) to the Mac's Ethernet MAC address.
4. To find the MAC address, run this on the Mac (before unplugging the screen):
   ```bash
   networksetup -getmacaddress Ethernet
   ```
5. If `mirza.local` doesn't resolve after a reboot, your router may be doing IGMP Snooping. Disable it.

---

## Phase 3 -- Client Installation

Clone the repo on your Linux machine:

```bash
git clone <repo-url> ~/git/mirza.local
cd ~/git/mirza.local
```

Run the installation script:

```bash
chmod +x installation.sh
./installation.sh
```

This script does four things, in order:

| Step | What it does |
|---|---|
| **1. Dependencies** | Installs `jq`, `curl`, `wakeonlan`, `python3`, `ssh` via your package manager. |
| **2. CLI Symlink** | Creates `~/.local/bin/mirza` pointing to `mirza/mirza.sh`. Adds `~/.local/bin` to your PATH if needed. |
| **3. SSH Keys** | Optionally runs `gatcha.sh` to generate a dedicated SSH keypair (`~/.ssh/mirza_key`) and copy it to the Mac. Also injects `MIRZA_HOST`, `MIRZA_USER`, and `MIRZA_MAC_ADRESS` into your `~/.bashrc`. |
| **4. Server Deployment** | Optionally copies `mirzaServer/` to `~/mirzaServer/` on the Mac via rsync. |

After the script finishes:

```bash
source ~/.bashrc
mirza status
```

If you see "ONLINE", you're in business.

---

## Phase 4 -- First Contact

```bash
mirza ssh
```

You're now on the Mac. Run the server-side setup scripts in order.

### Rename the host (optional, if not already done)

```bash
chmod +x ~/mirzaServer/utils/baptism.sh
~/mirzaServer/utils/baptism.sh
```

---

## Phase 5 -- Monitoring (Grafana + Prometheus)

Running inference without monitoring is denial. The stack:

| Component | Port | Role |
|---|---|---|
| **Grafana** | 3000 | Dashboard visualization |
| **Prometheus** | 9090 | Metrics collection and storage |
| **Macmon** | 9091 | Apple Silicon metrics exporter (CPU, GPU, ANE, thermal, power) |

### Installation (on the Mac, via SSH)

```bash
chmod +x ~/mirzaServer/monitoring/setup_monitoring.sh
~/mirzaServer/monitoring/setup_monitoring.sh
```

This script:
- Installs Grafana, Prometheus, and Macmon via Homebrew.
- Configures Prometheus to scrape Macmon metrics.
- Imports a pre-built Grafana dashboard ("Mirza Monitor Lite").
- Adds `@reboot` crontab entries so all services start automatically after a reboot. No manual intervention needed.

### Grafana database location

The Grafana database (dashboards, users, preferences) is stored at:

```
/opt/homebrew/var/lib/grafana/grafana.db
```

If you need to back it up or reset Grafana, that's the file.

### Accessing Grafana

From your browser: `http://mirza.local:3000`

From the WebUI: the Monitoring tab embeds Grafana directly via iframe in kiosk mode.

---

## Phase 6 -- AI Deployment (MLX)

MLX is Apple's machine learning framework, optimized for Apple Silicon. It uses unified memory, which means the GPU, CPU, and Neural Engine all share the same RAM pool. No PCIe bottleneck. No VRAM limit separate from system RAM.

### Installation (on the Mac, via SSH)

```bash
chmod +x ~/mirzaServer/ai/setup_mlx.sh
~/mirzaServer/ai/setup_mlx.sh
```

This installs:
- **uv**: A Rust-based Python package manager. Fast. Very fast.
- **MLX and mlx-lm**: The inference engine and its LLM serving layer.
- A LaunchAgent for automatic server startup.

### Where are models stored?

`mlx-lm` uses the Hugging Face cache. All downloaded models land in:

```
~/.cache/huggingface/hub/
```

on the Mac. This is where your disk space goes.

### Managing models from the CLI

```bash
mirza models              # List compatible models from the curated catalog
mirza models code         # Filter by category
mirza deploy qwen3.5-9b-4bit  # Download a model to the Mac
mirza serve qwen3.5-9b-4bit   # Start the inference server with this model
mirza stop                # Stop the inference server
```

### The inference API

`mlx-lm` serves an **OpenAI-compatible REST API** on port 8080. You can use it with any tool that speaks OpenAI's protocol:

```bash
curl http://mirza.local:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "mlx-community/Qwen3.5-9B-MLX-4bit", "messages": [{"role": "user", "content": "Hello"}]}'
```

---

## Phase 7 -- The WebUI

The WebUI is a single-page application served from your client machine. It communicates with the Mac via the Python backend (`server.py`), which relays commands over SSH.

### Starting the WebUI

```bash
mirza ui
```

This starts `server.py` on port 3333 and opens an SSH tunnel to the MLX API if needed.

Open `http://localhost:3333` in your browser.

### Stopping the WebUI

```bash
mirza stop-ui
```

### WebUI Features

| Tab | What it does |
|---|---|
| **Dashboard** | Server status, hardware info, active model, quick actions (wake, sleep, reboot, stop MLX), live logs. |
| **Chat** | Full chat interface with streaming, multi-provider support (local MLX, OpenAI, Anthropic, Groq, Mistral, Ollama), conversation history, MCP tools. |
| **Models** | Live catalog fetched from the HuggingFace API (mlx-community, top 100 by downloads). Each model card shows: estimated size, KV cache overhead, 6 GB OS overhead, estimated tok/s for your specific chip, Flash/Paged Attention support, and compatibility warnings. |
| **Config** | Displays the contents of `mirza.conf`. Can regenerate the config via SSH. |
| **Monitoring** | Embedded Grafana dashboard in kiosk mode. |
| **Documentation** | Built-in usage guide. |

### How model recommendations work

The WebUI parses each model's name to extract parameters (e.g., "9B") and quantization (e.g., "4bit"), then calculates:

1. **Model weight size** = Parameters x (Bits / 8)
2. **KV Cache estimate** = 1.5 GB (small models) or 3 GB (models > 15B params)
3. **OS overhead** = 6 GB (reserved for macOS and background processes)
4. **Minimum RAM required** = Weight size + KV Cache + OS overhead
5. **Estimated tok/s** = Chip memory bandwidth / Model weight size

Models that don't fit in your RAM are grayed out with disabled buttons. Models that are a good fit for your hardware are tagged "Optimized for this Mac."

---

## CLI Reference

All commands use the format `mirza <command> [arguments]`.

### Server Management

| Command | Description |
|---|---|
| `mirza start` | Send a Wake-on-LAN packet to the Mac. |
| `mirza ssh` | Open an interactive SSH session. |
| `mirza status` | Check if the server, MLX API, and Grafana are running. |
| `mirza sleep` | Put the Mac to sleep via `pmset sleepnow`. |
| `mirza reboot` | Reboot the Mac via `sudo shutdown -r now`. |

### AI Management

| Command | Description |
|---|---|
| `mirza models [category]` | Display the curated model catalog, filtered by RAM compatibility. Categories: `general`, `code`, `reasoning`, `multimodal`, `light`, `french`. |
| `mirza deploy <model_id>` | Download a model to the Mac (accepts catalog IDs or full HuggingFace repo paths). |
| `mirza serve [model_id]` | Start the MLX inference server. Uses the last deployed model if none specified. |
| `mirza stop` | Kill the MLX inference server. |
| `mirza chat` | Interactive terminal chat session. |

### Interface and Config

| Command | Description |
|---|---|
| `mirza ui` | Launch the WebUI on port 3333. Creates an SSH tunnel if needed. |
| `mirza stop-ui` | Kill the WebUI process. |
| `mirza tunnel [port]` | Create an SSH tunnel to the MLX API (default: port 8080). |
| `mirza config` | Display the current configuration. |
| `mirza config --refresh` | Regenerate `mirza.conf` by querying the Mac via SSH. |

---

## API Reference

The WebUI backend (`server.py`) exposes these endpoints:

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/status` | Server status, hardware info, active model. |
| GET | `/api/config` | Contents of `mirza.conf` as JSON. |
| POST | `/api/config/refresh` | Regenerate `mirza.conf` via SSH. |
| GET | `/api/models` | Curated model catalog from `models.json`. |
| POST | `/api/server/wake` | Send Wake-on-LAN packet. |
| POST | `/api/server/sleep` | Put the Mac to sleep. |
| POST | `/api/server/reboot` | Reboot the Mac. |
| POST | `/api/mlx/serve` | Start MLX server with `{"model": "repo/name"}`. |
| POST | `/api/mlx/stop` | Stop the MLX server. |
| POST | `/api/mlx/deploy` | Download a model with `{"hf_repo": "repo/name"}`. |
| GET | `/api/mlx/logs` | Last 30 lines of the MLX server log. |

---

## Key File Locations

| What | Where | Machine |
|---|---|---|
| CLI script | `mirza/mirza.sh` | Client (Linux) |
| CLI symlink | `~/.local/bin/mirza` | Client (Linux) |
| Configuration | `mirza/mirza.conf` | Client (Linux) |
| SSH private key | `~/.ssh/mirza_key` | Client (Linux) |
| Environment variables | `~/.bashrc` (MIRZA_HOST, MIRZA_USER, MIRZA_MAC_ADRESS) | Client (Linux) |
| WebUI backend | `webui/server.py` | Client (Linux) |
| Model catalog | `mirzaServer/ai/models.json` | Both |
| Downloaded models | `~/.cache/huggingface/hub/` | Server (Mac) |
| Grafana database | `/opt/homebrew/var/lib/grafana/grafana.db` | Server (Mac) |
| Prometheus data | `/opt/homebrew/var/prometheus/` | Server (Mac) |
| MLX server logs | `/tmp/mirza-mlx.log` | Server (Mac) |
| Monitoring setup | `~/mirzaServer/monitoring/setup_monitoring.sh` | Server (Mac) |

---

## Troubleshooting

### "mirza: command not found"

The symlink at `~/.local/bin/mirza` isn't in your PATH. Run:
```bash
source ~/.bashrc
```

### "Catalogue non trouve: .../.local/mirzaServer/ai/models.json"

You're running an old version of `mirza.sh` that doesn't resolve symlinks correctly. Pull the latest version and re-run `installation.sh`.

### "Address already in use" when starting the WebUI

A previous `server.py` process is still running. Kill it:
```bash
mirza stop-ui
```

### mirza.local doesn't resolve

- Make sure the Mac is on and connected to Ethernet.
- Make sure your router isn't filtering mDNS (check IGMP Snooping).
- As a fallback, use the Mac's static IP directly.

### Grafana is blank after a reboot

The `setup_monitoring.sh` script installs `@reboot` crontab entries. If they're missing, re-run the script. It will not wipe existing Grafana data.

### Models are too slow

Check `mirza status` to confirm the model is running. Then check Grafana for memory pressure. If the Mac is swapping, the model is too large for your RAM. Use a smaller quantization or a smaller model.

---

## Roadmap

- [x] CLI for remote Mac management
- [x] Monitoring stack (Grafana + Prometheus + Macmon)
- [x] OpenAI-compatible inference API (mlx-lm)
- [x] WebUI with chat, dashboard, model catalog
- [x] Grafana embedded in the WebUI
- [x] Dynamic model catalog from HuggingFace API
- [x] Hardware-aware model recommendations with tok/s estimation
- [ ] MCP server for agentic workflows (filesystem, web search, code execution)
- [ ] Model benchmarking across chip variants (M1 through M4 Ultra)
- [ ] Multi-model serving (serve several models on different ports)

---

## License

GPLv3. Copy it, distribute it, modify it. Keep it open.
