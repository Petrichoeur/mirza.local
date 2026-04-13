#!/bin/bash
# ==============================================================================
# Mirza AI — MLX Inference Server Setup (uv edition)
# Run this ON the Mac server (directly or via SSH)
# ==============================================================================

# --- Colors ---
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

# Ensure Homebrew is in PATH (non-interactive SSH sessions don't load .zprofile)
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:$PATH"
eval "$(/opt/homebrew/bin/brew shellenv 2>/dev/null)" || true

# --- Configuration ---
MIRZA_AI_DIR="$HOME/mirza-ai"
PLIST_NAME="com.mirza.mlx-server"
PLIST_PATH="$HOME/Library/LaunchAgents/${PLIST_NAME}.plist"
DEFAULT_MODEL="mlx-community/Qwen3-4B-Instruct-2507-4bit"
API_PORT="${1:-8080}"

echo -e "${BLUE}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         Mirza AI — MLX Server Setup (uv)           ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

# ==============================================================================
# PHASE 1 — Prerequisites
# ==============================================================================
echo -e "${BLUE}--- Phase 1: Vérification des prérequis ---${NC}"
echo ""

# Check macOS
if [[ "$(uname)" != "Darwin" ]]; then
    echo -e "${RED}  ✗ Ce script doit être exécuté sur macOS.${NC}"
    exit 1
fi

# Check Apple Silicon
ARCH=$(uname -m)
if [[ "$ARCH" != "arm64" ]]; then
    echo -e "${RED}  ✗ Apple Silicon requis (détecté: ${ARCH}).${NC}"
    exit 1
fi
echo -e "${GREEN}  ✓ Apple Silicon détecté (${ARCH})${NC}"

# Check/Install Homebrew
if ! command -v brew &>/dev/null; then
    echo -e "${YELLOW}  → Installation de Homebrew...${NC}"
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    eval "$(/opt/homebrew/bin/brew shellenv)"
else
    echo -e "${GREEN}  ✓ Homebrew présent${NC}"
fi

# Check/Install uv
if ! command -v uv &>/dev/null; then
    echo -e "${YELLOW}  → Installation de uv via Homebrew...${NC}"
    brew install uv
else
    echo -e "${GREEN}  ✓ uv présent ($(uv --version 2>/dev/null | head -1))${NC}"
fi

echo ""

# ==============================================================================
# PHASE 2 — Python Environment with uv
# ==============================================================================
echo -e "${BLUE}--- Phase 2: Environnement Python avec uv ---${NC}"
echo ""

# Create project directory
mkdir -p "$MIRZA_AI_DIR"

# Initialize uv project if not already done
if [ ! -f "$MIRZA_AI_DIR/pyproject.toml" ]; then
    echo -e "${CYAN}  → Initialisation du projet uv...${NC}"
    cd "$MIRZA_AI_DIR"
    uv init --name mirza-ai --python ">=3.12"

    # Clean up the default hello.py created by uv init
    rm -f "$MIRZA_AI_DIR/hello.py" 2>/dev/null
else
    echo -e "${GREEN}  ✓ Projet uv déjà initialisé${NC}"
    cd "$MIRZA_AI_DIR"
fi

# Add mlx-lm dependency
echo -e "${CYAN}  → Installation de mlx-lm...${NC}"
uv add mlx-lm

# Verify installation
echo ""
echo -e "${CYAN}  → Vérification de l'installation...${NC}"
MLX_VER=$(uv run python -c "import mlx; print(mlx.__version__)" 2>/dev/null)
MLX_LM_VER=$(uv run python -c "import mlx_lm; print(mlx_lm.__version__)" 2>/dev/null)
PYTHON_VER=$(uv run python --version 2>/dev/null | awk '{print $2}')

if [ -z "$MLX_LM_VER" ]; then
    echo -e "${RED}  ✗ Échec de l'installation de mlx-lm.${NC}"
    exit 1
fi

echo -e "${GREEN}  ✓ Python:  ${PYTHON_VER}${NC}"
echo -e "${GREEN}  ✓ MLX:     ${MLX_VER}${NC}"
echo -e "${GREEN}  ✓ mlx-lm:  ${MLX_LM_VER}${NC}"
echo ""

# ==============================================================================
# PHASE 3 — Create the server launch script
# ==============================================================================
echo -e "${BLUE}--- Phase 3: Script de lancement du serveur ---${NC}"
echo ""

cat > "$MIRZA_AI_DIR/start_server.sh" <<'SCRIPT'
#!/bin/bash
# Mirza AI — MLX Server Launcher
# Usage: ./start_server.sh [model] [port]

MIRZA_AI_DIR="$HOME/mirza-ai"
MODEL="${1:-$(cat "$MIRZA_AI_DIR/.active_model" 2>/dev/null || echo "mlx-community/Qwen3-4B-Instruct-2507-4bit")}"
PORT="${2:-8080}"

cd "$MIRZA_AI_DIR"

echo "[Mirza AI] Starting MLX server..."
echo "  Model: $MODEL"
echo "  Port:  $PORT"
echo "  Time:  $(date)"

# Save active model
echo "$MODEL" > "$MIRZA_AI_DIR/.active_model"

# Start the server
exec uv run mlx_lm.server --model "$MODEL" --port "$PORT"
SCRIPT
chmod +x "$MIRZA_AI_DIR/start_server.sh"
echo -e "${GREEN}  ✓ start_server.sh créé${NC}"

# Create a stop script
cat > "$MIRZA_AI_DIR/stop_server.sh" <<'SCRIPT'
#!/bin/bash
# Mirza AI — Stop the MLX Server
PID=$(pgrep -f "mlx_lm.server")
if [ -n "$PID" ]; then
    kill "$PID"
    echo "[Mirza AI] Serveur arrêté (PID: $PID)"
else
    echo "[Mirza AI] Aucun serveur en cours d'exécution."
fi
SCRIPT
chmod +x "$MIRZA_AI_DIR/stop_server.sh"
echo -e "${GREEN}  ✓ stop_server.sh créé${NC}"

# Create a model switch helper
cat > "$MIRZA_AI_DIR/switch_model.sh" <<'SCRIPT'
#!/bin/bash
# Mirza AI — Switch active model
# Usage: ./switch_model.sh <model_id>

MIRZA_AI_DIR="$HOME/mirza-ai"
MODEL="$1"

if [ -z "$MODEL" ]; then
    echo "Usage: ./switch_model.sh <huggingface_model_id>"
    echo "Example: ./switch_model.sh mlx-community/Qwen3.5-9B-MLX-4bit"
    exit 1
fi

echo "[Mirza AI] Changement de modèle..."

# Stop current server if running
"$MIRZA_AI_DIR/stop_server.sh"
sleep 2

# Start with new model
"$MIRZA_AI_DIR/start_server.sh" "$MODEL" "${2:-8080}"
SCRIPT
chmod +x "$MIRZA_AI_DIR/switch_model.sh"
echo -e "${GREEN}  ✓ switch_model.sh créé${NC}"
echo ""

# ==============================================================================
# PHASE 4 — LaunchAgent (auto-start at boot)
# ==============================================================================
echo -e "${BLUE}--- Phase 4: Configuration du LaunchAgent ---${NC}"
echo ""

# Unload existing agent if present
if launchctl list | grep -q "$PLIST_NAME" 2>/dev/null; then
    launchctl unload "$PLIST_PATH" 2>/dev/null
    echo -e "${YELLOW}  → Ancien LaunchAgent déchargé.${NC}"
fi

mkdir -p "$HOME/Library/LaunchAgents"

# Resolve the full path to the uv binary
UV_BIN=$(which uv)

cat > "$PLIST_PATH" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${PLIST_NAME}</string>

    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>${MIRZA_AI_DIR}/start_server.sh</string>
    </array>

    <key>WorkingDirectory</key>
    <string>${MIRZA_AI_DIR}</string>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <dict>
        <key>SuccessfulExit</key>
        <false/>
    </dict>

    <key>StandardOutPath</key>
    <string>/tmp/mirza-mlx-server.stdout.log</string>

    <key>StandardErrorPath</key>
    <string>/tmp/mirza-mlx-server.stderr.log</string>

    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    </dict>

    <key>ThrottleInterval</key>
    <integer>10</integer>
</dict>
</plist>
PLIST

echo -e "${GREEN}  ✓ LaunchAgent créé: ${PLIST_PATH}${NC}"

# Load the agent
if ! launchctl load "$PLIST_PATH" 2>/dev/null; then
    echo -e "${YELLOW}  → launchctl failed (expected via non-interactive SSH).${NC}"
else
    echo -e "${GREEN}  ✓ LaunchAgent chargé — le serveur MLX démarrera automatiquement au boot.${NC}"
fi

# Force manual start in background if not running (crucial for SSH deployment)
if ! pgrep -f "mlx_lm.server" > /dev/null; then
    echo -e "${CYAN}  → Lancement manuel du serveur en arrière-plan...${NC}"
    nohup "$MIRZA_AI_DIR/start_server.sh" > /tmp/mirza-mlx-server.stdout.log 2> /tmp/mirza-mlx-server.stderr.log &
    sleep 2
fi
echo ""

# ==============================================================================
# PHASE 5 — Pre-download the default model
# ==============================================================================
echo -e "${BLUE}--- Phase 5: Pré-téléchargement du modèle par défaut ---${NC}"
echo ""
echo -e "${CYAN}  Modèle: ${DEFAULT_MODEL}${NC}"
echo -e "${YELLOW}  (Cela peut prendre quelques minutes selon la connexion)${NC}"
echo ""

# Save as active model
echo "$DEFAULT_MODEL" > "$MIRZA_AI_DIR/.active_model"

# Pre-download by doing a quick dry-run
cd "$MIRZA_AI_DIR"
uv run python -c "
from mlx_lm import load
print('Téléchargement et vérification du modèle...')
model, tokenizer = load('${DEFAULT_MODEL}')
print('Modèle chargé avec succès !')
del model, tokenizer
"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}  ✓ Modèle téléchargé et vérifié !${NC}"
else
    echo -e "${YELLOW}  ⚠ Le modèle sera téléchargé au premier démarrage du serveur.${NC}"
fi

echo ""

# ==============================================================================
# PHASE 6 — Health Check
# ==============================================================================
echo -e "${BLUE}--- Phase 6: Vérification du serveur ---${NC}"
echo ""

# Wait for server to start
printf "  Attente du serveur"
for i in $(seq 1 20); do
    if curl -sf --max-time 2 "http://localhost:${API_PORT}/v1/models" &>/dev/null; then
        echo ""
        echo -e "${GREEN}  ✓ Serveur MLX opérationnel !${NC}"
        echo ""
        echo -e "  API endpoint:   ${YELLOW}http://localhost:${API_PORT}/v1${NC}"
        echo -e "  Modèle actif:   ${YELLOW}${DEFAULT_MODEL}${NC}"
        break
    fi
    printf "."
    sleep 3
done

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              INSTALLATION TERMINÉE !                ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Le serveur MLX tourne sur:  ${YELLOW}http://localhost:${API_PORT}${NC}"
echo -e "  API compatible OpenAI:      ${YELLOW}/v1/chat/completions${NC}"
echo -e "  Modèle actif:               ${YELLOW}${DEFAULT_MODEL}${NC}"
echo ""
echo -e "  ${CYAN}Commandes utiles:${NC}"
echo -e "    ~/mirza-ai/start_server.sh [model] [port]"
echo -e "    ~/mirza-ai/stop_server.sh"
echo -e "    ~/mirza-ai/switch_model.sh <model_id>"
echo ""
echo -e "  ${CYAN}Logs:${NC}"
echo -e "    tail -f /tmp/mirza-mlx-server.stdout.log"
echo -e "    tail -f /tmp/mirza-mlx-server.stderr.log"
echo ""
