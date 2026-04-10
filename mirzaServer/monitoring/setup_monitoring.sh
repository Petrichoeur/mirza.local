#!/bin/bash
# ==============================================================================
# Mirza's Ultimate Monitoring Bootstrap Script - MacOs Edition !
# (No Docker, No Cry — Now with Apple Silicon Superpowers via macmon)
# ==============================================================================
# --- ANSI Colors for maximum hacker aesthetics ---
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# --- 100% Dynamic Variables (Look, no hardcoding!) ---
SERVER_NAME=$(scutil --get LocalHostName 2>/dev/null | tr '[:upper:]' '[:lower:]' || echo "mac-server")
SERVER_NAME_UPPER=$(echo "$SERVER_NAME" | tr '[:lower:]' '[:upper:]')
LOCAL_DOMAIN="${SERVER_NAME}.local"
LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "localhost")
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)
BREW_PREFIX=$(brew --prefix)

# --- Ports ---
MACMON_PORT=9091
NODE_EXP_PORT=9100

# --- Paths (Homebrew mapping) ---
PROM_YML="$BREW_PREFIX/etc/prometheus.yml"
PLIST_FILE="$BREW_PREFIX/opt/prometheus/homebrew.mxcl.prometheus.plist"
GRAFANA_INI="$BREW_PREFIX/etc/grafana/grafana.ini"
GRAFANA_DB="$BREW_PREFIX/var/lib/grafana/grafana.db"
GRAFANA_DS_DIR="$BREW_PREFIX/etc/grafana/provisioning/datasources"
GRAFANA_DASH_PROV_DIR="$BREW_PREFIX/etc/grafana/provisioning/dashboards"
GRAFANA_DASH_DIR="$BREW_PREFIX/etc/grafana/dashboards"

echo -e "${BLUE}======================================================${NC}"
echo -e "${BLUE}   Summoning the Monitoring Gods for ${SERVER_NAME_UPPER}...${NC}"
echo -e "${BLUE}======================================================${NC}"
echo -e "Primary Target:   ${YELLOW}${LOCAL_DOMAIN}${NC}"
echo -e "Fallback IP:      ${YELLOW}${LOCAL_IP}${NC}"
echo -e "Apple Silicon:    ${CYAN}macmon on :${MACMON_PORT}${NC}"
echo "Strap in. This will only take a few seconds."
echo ""

# ==============================================================================
# PHASE 1 — INSTALLATION
# ==============================================================================
echo -e "${BLUE}--- Phase 1: Installing all required packages via Homebrew ---${NC}"
echo ""

brew_install() {
    local package=$1
    local label=$2
    if brew list "$package" &>/dev/null; then
        echo -e "${YELLOW} -> ${label} already installed. Skipping.${NC}"
    else
        echo " -> Installing ${label}..."
        brew install "$package"
        echo -e "${GREEN} -> ${label} installed successfully.${NC}"
    fi
}

echo -e "${GREEN}[1/4]${NC} Prometheus — the metrics vacuum cleaner..."
brew_install prometheus "Prometheus"

echo -e "${GREEN}[2/4]${NC} Node Exporter — the OS gossip columnist..."
brew_install node_exporter "Node Exporter"

echo -e "${GREEN}[3/4]${NC} Grafana — the pretty face of the operation..."
brew_install grafana "Grafana"

echo -e "${GREEN}[4/4]${NC} ${CYAN}macmon — the Apple Silicon whisperer (no sudo!)...${NC}"
brew_install macmon "macmon"

echo ""
echo -e "${GREEN} -> All packages present and accounted for. Moving on!${NC}"
echo ""

# ==============================================================================
# PHASE 2 — CONFIGURATION
# ==============================================================================
echo -e "${BLUE}--- Phase 2: Configuring all services ---${NC}"
echo ""

# ---------------------------------------------------------
# STEP 1: macmon — nohup + crontab @reboot
# ---------------------------------------------------------
echo -e "${GREEN}[1/6]${NC} ${CYAN}Wiring up macmon (nohup + crontab @reboot)...${NC}"

MACMON_BIN=$(which macmon)
MACMON_CMD="nohup ${MACMON_BIN} serve --port ${MACMON_PORT} --interval 1000 > /tmp/macmon.stdout.log 2>/tmp/macmon.stderr.log &"

# Kill any existing macmon instance
pkill -f "macmon serve" 2>/dev/null
sleep 1

# Start macmon now
eval "$MACMON_CMD"
echo " -> macmon started (PID $!)."

# Register in crontab @reboot (remove old entry first)
( crontab -l 2>/dev/null | grep -v "macmon serve" ; echo "@reboot ${MACMON_CMD}" ) | crontab -
echo " -> macmon registered in crontab @reboot. Survives reboots. 🔁"

# ---------------------------------------------------------
# STEP 2: Prometheus Scrape Config
# ---------------------------------------------------------
echo -e "${GREEN}[2/6]${NC} Teaching Prometheus who to spy on..."
cat > "$PROM_YML" <<PROMYML
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: "prometheus"
    static_configs:
      - targets: ["localhost:9090"]

  # Standard OS metrics (CPU, disk, network, filesystem...)
  - job_name: "${SERVER_NAME}_node"
    static_configs:
      - targets: ["localhost:${NODE_EXP_PORT}"]
    scrape_interval: 15s

  # Apple Silicon metrics (CPU/GPU/ANE power, temps, RAM, clusters)
  # Powered by macmon — no sudo required!
  - job_name: "${SERVER_NAME}_apple_silicon"
    static_configs:
      - targets: ["localhost:${MACMON_PORT}"]
    scrape_interval: 5s
PROMYML
echo " -> Targets acquired. node_exporter + macmon on the radar."

# ---------------------------------------------------------
# STEP 3: Prometheus Storage Limits (The Disk Saver)
# ---------------------------------------------------------
echo -e "${GREEN}[3/6]${NC} Taming the TSDB Storage Monster (5GB / 30 Days max)..."
if ! grep -q "retention.time" "$PLIST_FILE"; then
    perl -pi -e 's/<\/array>/  <string>--storage.tsdb.retention.time=30d<\/string>\n    <string>--storage.tsdb.retention.size=5GB<\/string>\n  <\/array>/' "$PLIST_FILE"
    echo " -> Limits injected! Your SSD breathes a sigh of relief."
else
    echo -e "${YELLOW} -> Storage limits already exist. Moving on!${NC}"
fi

# ---------------------------------------------------------
# STEP 4: Grafana — patch grafana.ini provisioning path
# ---------------------------------------------------------
echo -e "${GREEN}[4/6]${NC} Patching Grafana config to enable IaC provisioning..."

# Uncomment and set the provisioning path to our Homebrew directory
# This is the key fix: by default Grafana looks at conf/provisioning (relative)
# which doesn't exist in a Homebrew install — we point it to the right place.
if grep -q "^provisioning" "$GRAFANA_INI"; then
    # Already set — update it
    sed -i '' "s|^provisioning = .*|provisioning = $BREW_PREFIX/etc/grafana/provisioning|" "$GRAFANA_INI"
else
    # Commented out — uncomment and set
    sed -i '' "s|;provisioning = conf/provisioning|provisioning = $BREW_PREFIX/etc/grafana/provisioning|" "$GRAFANA_INI"
fi
echo " -> grafana.ini patched: provisioning → $BREW_PREFIX/etc/grafana/provisioning"

# ---------------------------------------------------------
# STEP 5: Grafana Data Source Provisioning
# ---------------------------------------------------------
echo -e "${GREEN}[5/6]${NC} Introducing Grafana to Prometheus (Blind Date)..."
mkdir -p "$GRAFANA_DS_DIR"
cat > "$GRAFANA_DS_DIR/prometheus.yaml" <<GRAFANADS
apiVersion: 1
datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://localhost:9090
    isDefault: true
    editable: false
GRAFANADS
echo " -> Datasource file written."

# ---------------------------------------------------------
# STEP 6: Grafana Dashboard Provisioning
# ---------------------------------------------------------
echo -e "${GREEN}[6/6]${NC} Feeding Grafana its favorite JSON treats..."
mkdir -p "$GRAFANA_DASH_PROV_DIR"
mkdir -p "$GRAFANA_DASH_DIR"

cat > "$GRAFANA_DASH_PROV_DIR/default.yaml" <<GRAFANADASH
apiVersion: 1
providers:
  - name: '${SERVER_NAME_UPPER}_Dashboards'
    orgId: 1
    folder: ''
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    options:
      path: ${GRAFANA_DASH_DIR}
GRAFANADASH

count_json=$(ls -1 "$SCRIPT_DIR"/*.json 2>/dev/null | wc -l | tr -d ' ')
if [ "$count_json" -gt 0 ]; then
    cp "$SCRIPT_DIR"/*.json "$GRAFANA_DASH_DIR/"
    echo " -> Yummy! $count_json dashboard(s) swallowed whole."
else
    echo -e "${RED} -> Warning: No .json file found next to this script.${NC}"
    echo " -> (Grafana is sad, but will survive. Put a dashboard in the folder later!)"
fi

# ==============================================================================
# PHASE 3 — START SERVICES
# ==============================================================================
echo ""
echo -e "${BLUE}--- Phase 3: Starting all services ---${NC}"
echo ""

brew services restart node_exporter
brew services restart prometheus

# Wipe Grafana DB to enforce IaC — provisioning files are the single source of truth.
# This removes any manually created datasources/dashboards that would conflict.
echo " -> Wiping Grafana DB to enforce IaC (provisioning files = source of truth)..."
brew services stop grafana
rm -f "$GRAFANA_DB"
brew services start grafana

echo " -> node_exporter, Prometheus and Grafana are back online."
echo " -> macmon running via nohup (auto-restart at boot via crontab)."

# ==============================================================================
# PHASE 4 — HEALTH CHECK
# ==============================================================================
echo ""
echo -e "${BLUE}--- Phase 4: Sanity check — waiting for services to wake up ---${NC}"

check_endpoint() {
    local name=$1
    local url=$2
    local max_attempts=15
    local attempt=0
    printf "  Waiting for %-18s" "${name}..."
    while [ $attempt -lt $max_attempts ]; do
        if curl -sf --max-time 2 "$url" > /dev/null 2>&1; then
            echo -e "  ${GREEN}✓ UP${NC}  →  ${YELLOW}${url}${NC}"
            return 0
        fi
        attempt=$((attempt + 1))
        sleep 2
    done
    echo -e "  ${RED}✗ DOWN${NC} (timed out after $((max_attempts * 2))s)  →  ${url}"
    return 1
}

check_endpoint "Prometheus"      "http://localhost:9090/-/healthy"
check_endpoint "node_exporter"   "http://localhost:${NODE_EXP_PORT}/metrics"
check_endpoint "macmon (M-chip)" "http://localhost:${MACMON_PORT}/metrics"
check_endpoint "Grafana"         "http://localhost:3000/api/health"

echo ""
echo -e "${BLUE}======================================================${NC}"
echo -e "${GREEN}               MISSION ACCOMPLISHED!                  ${NC}"
echo -e "${BLUE}======================================================${NC}"
echo -e "Your BadAss Mac Server '${SERVER_NAME_UPPER}' is now fully monitored."
echo ""
echo -e "${CYAN}  Apple Silicon metrics available via macmon:${NC}"
echo -e "   • CPU Power (E-cores / P-cores) + ANE Power"
echo -e "   • GPU Power & residency"
echo -e "   • CPU/GPU Temperature"
echo -e "   • RAM & Swap usage"
echo -e "   • CPU utilisation per cluster"
echo ""
echo -e "Behold the beautiful charts here:  ${YELLOW}http://${LOCAL_DOMAIN}:3000${NC}"
echo -e "Fallback (if DNS is acting up):    ${YELLOW}http://${LOCAL_IP}:3000${NC}"
echo -e "(Default login: admin / admin)"
echo ""
echo ""
echo -e "To stop everything:"
echo -e "  ${YELLOW}brew services stop grafana prometheus node_exporter && pkill -f 'macmon serve'${NC}"
echo ""
echo -e "Now go build some A.I. trending stuff! "