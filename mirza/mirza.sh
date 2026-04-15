#!/bin/bash
# ==============================================================================
# Mirza — Apple Silicon AI Server Manager
# CLI complet pour piloter une station d'IA locale sur Mac Mini
# ==============================================================================

# --- Colors ---
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

# --- Configuration ---
MAC_ADDR=$MIRZA_MAC_ADRESS
USER_SSH=$MIRZA_USER
HOST=$MIRZA_HOST
SSH_KEY="$HOME/.ssh/mirza_key"

# Resolve real path even when called via symlink
_REAL_SCRIPT=$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || realpath "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")
SCRIPT_DIR=$(cd "$(dirname "$_REAL_SCRIPT")" &> /dev/null && pwd)
REPO_DIR=$(cd "$SCRIPT_DIR/.." &> /dev/null && pwd)
CONF_FILE="$SCRIPT_DIR/mirza.conf"
MODELS_FILE="$REPO_DIR/mirzaServer/ai/models.json"
WEBUI_DIR="$REPO_DIR/webui"

API_PORT="${MIRZA_API_PORT:-8080}"
SSH_TARGET="${USER_SSH}@${HOST}"

# SSH options
SSH_OPTS="-o ConnectTimeout=5 -o StrictHostKeyChecking=no -o BatchMode=yes"
if [ -f "$SSH_KEY" ]; then
    SSH_OPTS="$SSH_OPTS -i $SSH_KEY"
fi

# Remote PATH fix (ensures uv, brew, etc. are found in non-interactive shells)
REMOTE_PATH_FIX="export PATH=\$PATH:/opt/homebrew/bin:~/.cargo/bin:~/.local/bin;"

# ==============================================================================
# Helper functions
# ==============================================================================

remote_exec() {
    ssh $SSH_OPTS "$SSH_TARGET" "${REMOTE_PATH_FIX} $1" 2>/dev/null
}

read_conf() {
    local key="$1"
    if [ -f "$CONF_FILE" ]; then
        grep "^${key}=" "$CONF_FILE" 2>/dev/null | cut -d'=' -f2-
    fi
}

show_header() {
    echo ""
    echo -e "${BLUE}  ╔════════════════════════════════════╗${NC}"
    echo -e "${BLUE}  ║${NC}   ${BOLD}Mirza${NC} ${DIM}— AI Server Manager${NC}      ${BLUE}║${NC}"
    echo -e "${BLUE}  ╚════════════════════════════════════╝${NC}"
    echo ""
}

# ==============================================================================
# Commands
# ==============================================================================

cmd_start() {
    echo -e "${GREEN}[↑] Waking up: $HOST ...${NC}"
    wakeonlan "$MAC_ADDR"
}

cmd_ssh() {
    echo -e "${BLUE}[→] SSH to: $HOST...${NC}"
    ssh $SSH_OPTS "$SSH_TARGET"
}

cmd_sleep() {
    echo -e "${YELLOW}[☾] Sleeping: $HOST...${NC}"
    ssh -t $SSH_OPTS "$SSH_TARGET" 'sudo pmset sleepnow'
}

cmd_reboot() {
    echo -e "${YELLOW}[!] Rebooting: $HOST...${NC}"
    ssh -t $SSH_OPTS "$SSH_TARGET" 'sudo shutdown -r now'
}

cmd_status() {
    echo -e "${BLUE}[?] Checking status: $HOST...${NC}"
    echo ""

    # Ping check
    ping -c 1 -W 1 "$HOST" > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo -e "  Server:      ${GREEN}● ONLINE${NC}"
    else
        echo -e "  Server:      ${RED}● OFFLINE${NC} (or deep sleep)"
        return 1
    fi

    # Llama-CPP server check (llama-server)
    if curl -sf --max-time 3 "http://${HOST}:${API_PORT}/v1/models" &>/dev/null; then
        ACTIVE=$(curl -sf --max-time 3 "http://${HOST}:${API_PORT}/v1/models" | python3 -c "
import json, sys
data = json.load(sys.stdin)
if 'data' in data and len(data['data']) > 0:
    print(data['data'][0].get('id', 'unknown'))
else:
    print('none')
" 2>/dev/null)
        echo -e "  API Llama:     ${GREEN}● RUNNING${NC} (port ${API_PORT})"
        echo -e "  Active model: ${CYAN}${ACTIVE}${NC}"
    else
        echo -e "  API Llama:     ${DIM}○ STOPPED${NC}"
    fi

    # Grafana check
    if curl -sf --max-time 2 "http://${HOST}:3000/api/health" &>/dev/null; then
        echo -e "  Grafana:      ${GREEN}● RUNNING${NC}"
    else
        echo -e "  Grafana:      ${DIM}○ STOPPED${NC}"
    fi

    echo ""
}

cmd_config() {
    if [ "$2" = "--refresh" ] || [ ! -f "$CONF_FILE" ]; then
        echo -e "${BLUE}[⟳] Regenerating configuration...${NC}"
        bash "$SCRIPT_DIR/gen_config.sh"
    else
        if [ -f "$CONF_FILE" ]; then
            echo -e "${BLUE}[☰] Mirza Configuration${NC}"
            echo -e "${DIM}  (file: ${CONF_FILE})${NC}"
            echo ""
            # Pretty-print the config
            while IFS= read -r line; do
                # Section headers
                if [[ "$line" =~ ^\[.*\]$ ]]; then
                    echo -e "\n  ${BOLD}${CYAN}${line}${NC}"
                # Comments
                elif [[ "$line" =~ ^# ]]; then
                    echo -e "  ${DIM}${line}${NC}"
                # Key=value
                elif [[ "$line" =~ = ]]; then
                    key=$(echo "$line" | cut -d'=' -f1)
                    val=$(echo "$line" | cut -d'=' -f2-)
                    printf "  ${YELLOW}%-25s${NC} %s\n" "$key" "$val"
                fi
            done < "$CONF_FILE"
            echo ""
        else
            echo -e "${YELLOW}No config file found.${NC}"
            echo -e "Generate it with: ${CYAN}mirza config --refresh${NC}"
        fi
    fi
}

cmd_models() {
    echo -e "${BLUE}[⊞] Llama.cpp Model Catalog${NC}"
    echo ""

    if [ ! -f "$MODELS_FILE" ]; then
        echo -e "${RED}  ✗ Catalog not found: ${MODELS_FILE}${NC}"
        return 1
    fi

    # Get RAM from config or default
    RAM=$(read_conf "ram_gb")
    RAM="${RAM:-16}"

    # Optional filter by category
    FILTER="$2"

    python3 -c "
import json, sys

with open('$MODELS_FILE') as f:
    data = json.load(f)

ram = int('$RAM')
cat_filter = '$FILTER'.lower() if '$FILTER' else None

categories = data.get('categories', {})
catalog = data.get('catalog', [])

# Print categories legend
if not cat_filter:
    print('  Available categories:')
    for key, cat in categories.items():
        print(f'    {cat[\"icon\"]}  {cat[\"label\"]}  ({key})')
    print()
    print(f'  RAM detected: {ram}GB — showing compatible models')
    print(f'  Filter: mirza models <category>')
    print()

# Filter and display models
compatible = [m for m in catalog if m['min_ram_gb'] <= ram]
if cat_filter:
    compatible = [m for m in compatible if cat_filter in m.get('categories', [])]

if not compatible:
    print('  No compatible models found.')
    sys.exit(0)

# Group by family
families = {}
for m in compatible:
    fam = m.get('family', 'Other')
    families.setdefault(fam, []).append(m)

for fam, models in sorted(families.items()):
    print(f'  --- {fam} ---')
    for m in sorted(models, key=lambda x: x['size_gb']):
        star = ' ★' if m.get('recommended') else ''
        cats = ' '.join(categories.get(c, {}).get('icon', '') for c in m.get('categories', []))
        print(f'    {m[\"id\"]:<40} {m[\"size_gb\"]:>5.1f}GB  {cats}{star}')
        print(f'      {m[\"description\"]}')
    print()
" 2>/dev/null

    echo ""
    echo -e "  ${DIM}★ = recommended for your config${NC}"
    echo -e "  ${DIM}Deploy: mirza deploy <model_id>${NC}"
}

cmd_deploy() {
    local REPO_ID="$2"
    local FILENAME="$3"

    if [ -z "$REPO_ID" ]; then
        echo -e "${RED}Usage: mirza deploy <hf_repo_gguf> [filename]${NC}"
        echo -e "${DIM}  Example: mirza deploy Bartowski/Llama-3.2-3B-Instruct-GGUF${NC}"
        return 1
    fi

    echo -e "${BLUE}[↓] Deploying llama.cpp on Mirza...${NC}"
    echo -e "  Repo: ${CYAN}${REPO_ID}${NC}"
    if [ -n "$FILENAME" ]; then echo -e "  File: ${CYAN}${FILENAME}${NC}"; fi
    echo ""

    # Deploy via SSH: using the custom deploy_llama.py in llmServe
    echo -e "${YELLOW}  Analyzing and downloading (via hf)...${NC}"
    remote_exec "cd ~/llmServe && uv run python deploy_llama.py '${REPO_ID}' '${FILENAME}'"

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}  ✓ Model deployed successfully!${NC}"
        echo -e "  Start: ${CYAN}mirza serve${NC}"
    else
        echo -e "${RED}  ✗ Deployment failed.${NC}"
    fi
}

cmd_remove() {
    local FILENAME="$2"
    if [ -z "$FILENAME" ]; then
        echo -e "${RED}Usage: mirza remove .gguf${NC}"
        echo -e "${DIM}  List models: mirza status (or ssh ls ~/mirza-models)${NC}"
        return 1
    fi

    echo -e "${YELLOW}[-] Removing model: ${FILENAME}...${NC}"
    remote_exec "rm -f ~/mirza-models/${FILENAME}"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}  ✓ Model removed.${NC}"
    else
        echo -e "${RED}  ✗ Removal failed.${NC}"
    fi
}

cmd_serve() {
    local PORT="$API_PORT"
    local KV_Q="f16"
    local CTX="4096"
    local FA="--flash-attn"
    local EXTRA_FLAGS=""

    # Parsing arguments
    shift # remove 'serve'
    while [[ $# -gt 0 ]]; do
        case $1 in
            --kv-q)       KV_Q="$2"; shift 2 ;;
            --ctx)        CTX="$2"; shift 2 ;;
            --no-fa)      FA=""; shift ;;
            --port)       PORT="$2"; shift 2 ;;
            --tune)       EXTRA_FLAGS="$EXTRA_FLAGS --tune"; shift ;;
            --trials)     EXTRA_FLAGS="$EXTRA_FLAGS --trials $2"; shift 2 ;;
            --metric)     EXTRA_FLAGS="$EXTRA_FLAGS --metric $2"; shift 2 ;;
            -*)           EXTRA_FLAGS="$EXTRA_FLAGS $1"; shift ;;
            *)            EXTRA_FLAGS="$EXTRA_FLAGS $1"; shift ;;
        esac
    done

    echo -e "${BLUE}[▶] Starting Llama-CPP server...${NC}"
    echo -e "  Port:      ${CYAN}${PORT}${NC}"
    echo -e "  Context:   ${CYAN}${CTX}${NC}"
    echo -e "  KV Cache:  ${CYAN}${KV_Q}${NC}"
    if [ -n "$FA" ]; then echo -e "  Optim:     ${GREEN}Flash Attention ON${NC}"; fi

    local SERVER_CMD="uv run python serve_llama.py --port $PORT --ctx $CTX --kv-q $KV_Q $FA"
    
    remote_exec "cd ~/llmServe && nohup $SERVER_CMD $EXTRA_FLAGS > /tmp/mirza-llm.stdout.log 2>/tmp/mirza-llm.stderr.log &"

    echo ""
    # Wait for server
    printf "  Waiting for server"
    for i in $(seq 1 30); do
        if curl -sf --max-time 1 "http://${HOST}:${PORT}/v1/models" &>/dev/null; then
            echo ""
            echo -e "${GREEN}  ✓ Server ready!${NC}"
            echo -e "  Endpoint: ${YELLOW}http://${HOST}:${PORT}/v1${NC}"
            return 0
        fi
        printf "."
        sleep 2
    done
    echo ""
    echo -e "${YELLOW}  ⏳ Server starting slowly...${NC}"
    echo -e "  ${DIM}Check: mirza ssh then tail -f /tmp/mirza-llm.stderr.log${NC}"
}

cmd_tune() {
    local TRIALS=25
    local METRIC="tg"
    local MODEL_FILE=""
    
    shift
    while [[ $# -gt 0 ]]; do
        case $1 in
            --trials) TRIALS="$2"; shift 2 ;;
            --metric) METRIC="$2"; shift 2 ;;
            --model) MODEL_FILE="$2"; shift 2 ;;
            *) shift ;;
        esac
    done
    
    if [ -z "$MODEL_FILE" ]; then
        MODEL_FILE=$(remote_exec "cat ~/llmServe/active_model.json 2>/dev/null | python3 -c 'import json,sys; print(json.load(sys.stdin).get(\"file\",\"\"))'" 2>/dev/null)
    fi
    
    echo -e "${CYAN}[⚡] Auto-tuning Llama-CPP...${NC}"
    echo -e "  Trials:    ${CYAN}${TRIALS}${NC}"
    echo -e "  Metric:   ${CYAN}${METRIC}${NC}"
    echo -e "  Model:    ${CYAN}${MODEL_FILE:-auto-detect}${NC}"
    echo ""
    echo -e "${YELLOW}  Using llama-bench to benchmark (server can be running or not)${NC}"
    
    local TUNE_CMD="uv run python serve_llama.py --tune --trials $TRIALS --metric $METRIC"
    if [ -n "$MODEL_FILE" ]; then
        TUNE_CMD="$TUNE_CMD --model ~/mirza-models/$MODEL_FILE"
    else
        TUNE_CMD="$TUNE_CMD --model ~/mirza-models/*.gguf"
    fi
    
    remote_exec "cd ~/llmServe && $TUNE_CMD"
}

cmd_stop_llm() {
    echo -e "${YELLOW}[■] Stopping Llama-CPP server...${NC}"
    remote_exec "pkill -f 'llama_cpp.server' 2>/dev/null"
    echo -e "${GREEN}  ✓ Server stopped.${NC}"
}

cmd_stop() {
    echo -e "${YELLOW}[■] Global Stop: Shutting down all Mirza services...${NC}"
    cmd_stop_llm
    cmd_stop_ui
    echo -e "${GREEN}✓ All services stopped.${NC}"
}

cmd_chat() {
    echo -e "${BLUE}[] Interactive chat with Mirza${NC}"
    echo -e "${DIM}  Endpoint: http://${HOST}:${API_PORT}/v1/chat/completions${NC}"
    echo -e "${DIM}  Type 'exit' to quit, 'clear' to reset${NC}"
    echo ""

    # Build conversation history
    MESSAGES='[]'

    while true; do
        echo -ne "${GREEN}You > ${NC}"
        read -r USER_INPUT

        [ "$USER_INPUT" = "exit" ] && echo -e "\n${DIM}Bye!${NC}" && break
        [ "$USER_INPUT" = "clear" ] && MESSAGES='[]' && echo -e "${DIM}  History cleared.${NC}\n" && continue
        [ -z "$USER_INPUT" ] && continue

        # Add user message to history
        MESSAGES=$(echo "$MESSAGES" | python3 -c "
import json, sys
msgs = json.load(sys.stdin)
msgs.append({'role': 'user', 'content': '''$USER_INPUT'''})
print(json.dumps(msgs))
")

        # Call API
        echo -ne "${CYAN}Mirza > ${NC}"
        RESPONSE=$(curl -sf --max-time 120 "http://${HOST}:${API_PORT}/v1/chat/completions" \
            -H "Content-Type: application/json" \
            -d "{
                \"messages\": $MESSAGES,
                \"max_tokens\": 2048,
                \"temperature\": 0.7,
                \"stream\": false
            }" 2>/dev/null)

        if [ -z "$RESPONSE" ]; then
            echo -e "${RED}  [Error: no response from server]${NC}"
            echo -e "${DIM}  Check server: mirza status${NC}"
            continue
        fi

        # Extract and display the assistant's reply
        REPLY=$(echo "$RESPONSE" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    print(data['choices'][0]['message']['content'])
except:
    print('[Parse error]')
" 2>/dev/null)

        echo "$REPLY"
        echo ""

        # Add assistant reply to history
        MESSAGES=$(echo "$MESSAGES" | python3 -c "
import json, sys
msgs = json.load(sys.stdin)
msgs.append({'role': 'assistant', 'content': '''$REPLY'''})
print(json.dumps(msgs))
")
    done
}

cmd_tunnel() {
    local PORT="${2:-$API_PORT}"
    echo -e "${BLUE}[⇋] Creating SSH tunnel...${NC}"
    echo -e "  Local ${CYAN}${PORT}${NC} → Mirza:${CYAN}${PORT}${NC}"
    echo -e "  API at: ${YELLOW}http://localhost:${PORT}/v1${NC}"
    echo -e "${DIM}  Ctrl+C to close${NC}"
    echo ""
    ssh $SSH_OPTS -N -L "${PORT}:localhost:${PORT}" "$SSH_TARGET"
}

cmd_ui() {
    local PORT="${2:-$API_PORT}"

    if [ ! -f "$WEBUI_DIR/index.html" ]; then
        echo -e "${RED}  ✗ WebUI not found: ${WEBUI_DIR}${NC}"
        return 1
    fi

    echo -e "${BLUE}[] Launching Mirza WebUI...${NC}"
    echo ""

    # Check if tunnel is needed (are we on the same machine as the server?)
    if ! curl -sf --max-time 2 "http://localhost:${PORT}/v1/models" &>/dev/null; then
        echo -e "${YELLOW}  Llama.cpp not accessible on localhost:${PORT}${NC}"
        echo -e "${YELLOW}  Creating SSH tunnel in background...${NC}"
        ssh $SSH_OPTS -N -f -L "${PORT}:localhost:${PORT}" "$SSH_TARGET"
        sleep 1
        echo -e "${GREEN}  ✓ Tunnel active.${NC}"
    fi

    echo -e "  API Llama.cpp:  ${YELLOW}http://localhost:${PORT}/v1${NC}"
    echo -e "  WebUI:    ${YELLOW}http://localhost:3333${NC}"
    echo ""

    # Start local web server
    cd "$WEBUI_DIR"
    python3 server.py

}

cmd_stop_ui() {
    echo -e "${YELLOW}[■] Stopping Mirza WebUI...${NC}"
    # Target common ways server.py might be running
    local pids=$(pgrep -f "python.*server.py" || true)
    
    # If no pids found by name, try port 3333 (if lsof is available)
    if [ -z "$pids" ] && command -v lsof >/dev/null 2>&1; then
        pids=$(lsof -t -i :3333 || true)
    fi

    if [ -n "$pids" ]; then
        kill $pids 2>/dev/null
        echo -e "${GREEN}  ✓ WebUI stopped.${NC}"
    else
        echo -e "${DIM}  No WebUI running.${NC}"
    fi
}

cmd_help() {
    show_header
    echo -e "  ${BOLD}Server Management${NC}"
    echo -e "    ${CYAN}mirza start${NC}              Wake server (Wake-on-LAN)"
    echo -e "    ${CYAN}mirza ssh${NC}                Interactive SSH session"
    echo -e "    ${CYAN}mirza status${NC}             Server and services status"
    echo -e "    ${CYAN}mirza sleep${NC}              Put to sleep"
    echo -e "    ${CYAN}mirza reboot${NC}             Reboot"
    echo ""
    echo -e "  ${BOLD}AI Inference (Llama.cpp)${NC}"
    echo -e "    ${CYAN}mirza models${NC} [category]    Model catalog"
    echo -e "    ${CYAN}mirza deploy${NC} <repo> [file] Deploy GGUF (via hf)"
    echo -e "    ${CYAN}mirza remove${NC}    Remove local model"
    echo -e "    ${CYAN}mirza serve${NC}              Start inference server"
    echo -e "    ${CYAN}mirza tune${NC} [--trials N]      Auto-tune parameters"
    echo -e "    ${CYAN}mirza stop-llm${NC}           Stop LLM server only"
    echo -e "    ${CYAN}mirza chat${NC}               Terminal chat"
    echo ""
    echo -e "  ${BOLD}Interface & Config${NC}"
    echo -e "    ${CYAN}mirza ui${NC}                 Launch WebUI"
    echo -e "    ${CYAN}mirza stop-ui${NC}            Stop local WebUI"
    echo -e "    ${CYAN}mirza tunnel${NC} [port]       SSH tunnel to API"
    echo -e "    ${CYAN}mirza config${NC}             Show configuration"
    echo -e "    ${CYAN}mirza config --refresh${NC}   Regenerate via SSH"
    echo ""
    echo -e "  ${DIM}Documentation: ${YELLOW}~/git/mirza.local/README.md${NC}"
}

# ==============================================================================
# Main Router
# ==============================================================================
case "$1" in
    start|up)       cmd_start ;;
    ssh|connect)    cmd_ssh ;;
    sleep)          cmd_sleep ;;
    reboot)         cmd_reboot ;;
    status)         cmd_status ;;
    config)         cmd_config "$@" ;;
    models)         cmd_models "$@" ;;
    deploy)         cmd_deploy "$@" ;;
    remove|rm-model) cmd_remove "$@" ;;
    serve)          cmd_serve "$@" ;;
    tune)           cmd_tune "$@" ;;
    stop-llm)       cmd_stop_llm ;;
    chat)           cmd_chat ;;
    tunnel)         cmd_tunnel "$@" ;;
    ui)             cmd_ui "$@" ;;
    stop-ui)        cmd_stop_ui ;;
    help|--help|-h) cmd_help ;;
    *)              cmd_help ;;
esac
