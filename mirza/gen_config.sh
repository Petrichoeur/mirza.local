#!/bin/bash
# ==============================================================================
# Mirza — Configuration Auto-Generator
# Connects to the Mac server via SSH and populates mirza.conf
# ==============================================================================

# --- Colors ---
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

# --- Paths ---
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)
CONF_FILE="$SCRIPT_DIR/mirza.conf"

# --- Load environment ---
HOST="${MIRZA_HOST:-mirza.local}"
USER_SSH="${MIRZA_USER:-mirza}"
MAC_ADDR="${MIRZA_MAC_ADRESS:-unknown}"
SSH_TARGET="${USER_SSH}@${HOST}"
SSH_KEY="$HOME/.ssh/mirza_key"

# SSH options for non-interactive, fast connection
SSH_OPTS="-o ConnectTimeout=5 -o StrictHostKeyChecking=no -o BatchMode=yes"
if [ -f "$SSH_KEY" ]; then
    SSH_OPTS="$SSH_OPTS -i $SSH_KEY"
fi

# ==============================================================================
# Helper: Run a command on the remote Mac
# ==============================================================================
remote_exec() {
    ssh $SSH_OPTS "$SSH_TARGET" "$1" 2>/dev/null
}

# ==============================================================================
# MAIN
# ==============================================================================
echo -e "${BLUE}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       Mirza — Configuration Auto-Generator         ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

# --- Check connectivity ---
echo -e "${CYAN}[1/5]${NC} Vérification de la connexion SSH..."
if ! ssh $SSH_OPTS "$SSH_TARGET" "echo ok" &>/dev/null; then
    echo -e "${RED}  ✗ Impossible de se connecter à ${SSH_TARGET}${NC}"
    echo -e "${YELLOW}  Vérifie que Mirza est allumé et que SSH est configuré.${NC}"
    exit 1
fi
echo -e "${GREEN}  ✓ Connexion établie.${NC}"
echo ""

# --- Collect server info ---
echo -e "${CYAN}[2/5]${NC} Récupération des informations serveur..."

HOSTNAME=$(remote_exec "scutil --get LocalHostName 2>/dev/null || hostname -s")
IP=$(remote_exec "ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null")
MACOS_VERSION=$(remote_exec "sw_vers -productVersion")
MACOS_BUILD=$(remote_exec "sw_vers -buildVersion")
MACOS_NAME=$(remote_exec "sw_vers -productName")

echo -e "  Hostname:     ${YELLOW}${HOSTNAME}${NC}"
echo -e "  IP:           ${YELLOW}${IP}${NC}"
echo -e "  macOS:        ${YELLOW}${MACOS_NAME} ${MACOS_VERSION} (${MACOS_BUILD})${NC}"

# --- Collect hardware info ---
echo ""
echo -e "${CYAN}[3/5]${NC} Récupération des informations matériel..."

CHIP=$(remote_exec "sysctl -n machdep.cpu.brand_string 2>/dev/null")
CPU_CORES=$(remote_exec "sysctl -n hw.ncpu")
# Performance + Efficiency cores (Apple Silicon specific)
PERF_CORES=$(remote_exec "sysctl -n hw.perflevel0.logicalcpu 2>/dev/null || echo 'N/A'")
EFF_CORES=$(remote_exec "sysctl -n hw.perflevel1.logicalcpu 2>/dev/null || echo 'N/A'")
# GPU cores via system_profiler
GPU_CORES=$(remote_exec "system_profiler SPDisplaysDataType 2>/dev/null | grep -i 'Total Number of Cores' | awk -F': ' '{print \$2}' | head -1 || echo 'N/A'")
# Neural Engine cores (fixed per chip generation, extracted from chip name)
RAM_BYTES=$(remote_exec "sysctl -n hw.memsize")
RAM_GB=$((RAM_BYTES / 1073741824))
DISK_TOTAL=$(remote_exec "df -g / | tail -1 | awk '{print \$2}'")
DISK_AVAIL=$(remote_exec "df -g / | tail -1 | awk '{print \$4}'")

echo -e "  Puce:         ${YELLOW}${CHIP}${NC}"
echo -e "  CPU:          ${YELLOW}${CPU_CORES} cœurs (${PERF_CORES}P + ${EFF_CORES}E)${NC}"
echo -e "  GPU:          ${YELLOW}${GPU_CORES} cœurs${NC}"
echo -e "  RAM:          ${YELLOW}${RAM_GB} Go (unifiée)${NC}"
echo -e "  Disque:       ${YELLOW}${DISK_AVAIL} Go libres / ${DISK_TOTAL} Go total${NC}"

# --- Collect AI environment info ---
echo ""
echo -e "${CYAN}[4/5]${NC} Vérification de l'environnement IA..."

UV_INSTALLED=$(remote_exec "command -v uv &>/dev/null && echo 'true' || echo 'false'")
UV_VERSION=$(remote_exec "uv --version 2>/dev/null | head -1 || echo 'N/A'")

VENV_PATH="$HOME/mirza-ai"
MLX_INSTALLED="false"
MLX_VERSION="N/A"
MLX_LM_VERSION="N/A"
PYTHON_VERSION="N/A"

# Check if mirza-ai venv exists and has mlx-lm
if [ "$UV_INSTALLED" = "true" ]; then
    PYTHON_VERSION=$(remote_exec "cd ~/mirza-ai 2>/dev/null && uv run python --version 2>/dev/null | awk '{print \$2}' || echo 'N/A'")
    MLX_VERSION=$(remote_exec "cd ~/mirza-ai 2>/dev/null && uv run python -c 'import mlx; print(mlx.__version__)' 2>/dev/null || echo 'N/A'")
    MLX_LM_VERSION=$(remote_exec "cd ~/mirza-ai 2>/dev/null && uv run python -c 'import mlx_lm; print(mlx_lm.__version__)' 2>/dev/null || echo 'N/A'")
    if [ "$MLX_LM_VERSION" != "N/A" ]; then
        MLX_INSTALLED="true"
    fi
fi

# Check if MLX server is running
ACTIVE_MODEL="none"
API_PORT="8080"
API_STATUS="stopped"
MLX_PID=$(remote_exec "pgrep -f 'mlx_lm.server' 2>/dev/null")
if [ -n "$MLX_PID" ]; then
    API_STATUS="running"
    # Try to extract the model from the process command line
    ACTIVE_MODEL=$(remote_exec "ps -p $MLX_PID -o args= 2>/dev/null | grep -oP '(?<=--model )\S+' || echo 'unknown'")
    # Try to extract the port
    DETECTED_PORT=$(remote_exec "ps -p $MLX_PID -o args= 2>/dev/null | grep -oP '(?<=--port )\d+' || echo '8080'")
    API_PORT="${DETECTED_PORT:-8080}"
fi

echo -e "  uv:           ${YELLOW}${UV_INSTALLED} (${UV_VERSION})${NC}"
echo -e "  Python:       ${YELLOW}${PYTHON_VERSION}${NC}"
echo -e "  MLX:          ${YELLOW}${MLX_INSTALLED} (${MLX_VERSION})${NC}"
echo -e "  mlx-lm:       ${YELLOW}${MLX_LM_VERSION}${NC}"
echo -e "  Serveur API:  ${YELLOW}${API_STATUS}${NC}"
echo -e "  Modèle actif: ${YELLOW}${ACTIVE_MODEL}${NC}"

# --- Collect monitoring info ---
echo ""
echo -e "${CYAN}[5/5]${NC} Vérification du monitoring..."

GRAFANA_STATUS=$(remote_exec "curl -sf --max-time 2 http://localhost:3000/api/health &>/dev/null && echo 'running' || echo 'stopped'")
PROMETHEUS_STATUS=$(remote_exec "curl -sf --max-time 2 http://localhost:9090/-/healthy &>/dev/null && echo 'running' || echo 'stopped'")
MACMON_STATUS=$(remote_exec "curl -sf --max-time 2 http://localhost:9091/metrics &>/dev/null && echo 'running' || echo 'stopped'")

echo -e "  Grafana:      ${YELLOW}${GRAFANA_STATUS}${NC}"
echo -e "  Prometheus:   ${YELLOW}${PROMETHEUS_STATUS}${NC}"
echo -e "  macmon:       ${YELLOW}${MACMON_STATUS}${NC}"

# ==============================================================================
# Generate mirza.conf
# ==============================================================================
echo ""
echo -e "${BLUE}Génération de ${CONF_FILE}...${NC}"

cat > "$CONF_FILE" <<CONF
# ═══════════════════════════════════════════════════════════
# Mirza Configuration — Auto-generated $(date '+%Y-%m-%d %H:%M:%S')
# Régénérer avec : mirza config --refresh
# ═══════════════════════════════════════════════════════════

[server]
hostname=${HOSTNAME}
domain=${HOSTNAME}.local
ip=${IP}
mac_address=${MAC_ADDR}
user=${USER_SSH}
ssh_key=${SSH_KEY}

[system]
macos_name=${MACOS_NAME}
macos_version=${MACOS_VERSION}
macos_build=${MACOS_BUILD}

[hardware]
chip=${CHIP}
cpu_cores_total=${CPU_CORES}
cpu_cores_performance=${PERF_CORES}
cpu_cores_efficiency=${EFF_CORES}
gpu_cores=${GPU_CORES}
ram_gb=${RAM_GB}
disk_total_gb=${DISK_TOTAL}
disk_available_gb=${DISK_AVAIL}

[ai]
uv_installed=${UV_INSTALLED}
uv_version=${UV_VERSION}
python_version=${PYTHON_VERSION}
mlx_installed=${MLX_INSTALLED}
mlx_version=${MLX_VERSION}
mlx_lm_version=${MLX_LM_VERSION}
active_model=${ACTIVE_MODEL}
api_port=${API_PORT}
api_status=${API_STATUS}

[monitoring]
grafana_url=http://${HOSTNAME}.local:3000
grafana_status=${GRAFANA_STATUS}
prometheus_url=http://${HOSTNAME}.local:9090
prometheus_status=${PROMETHEUS_STATUS}
macmon_status=${MACMON_STATUS}
CONF

echo -e "${GREEN}  ✓ Configuration écrite dans ${CONF_FILE}${NC}"
echo ""
echo -e "${BLUE}══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}              Configuration terminée !                ${NC}"
echo -e "${BLUE}══════════════════════════════════════════════════════${NC}"
