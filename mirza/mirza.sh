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
    echo -e "${GREEN}[↑] Wake up: $HOST ...${NC}"
    wakeonlan "$MAC_ADDR"
}

cmd_ssh() {
    echo -e "${BLUE}[→] SSH remote connection to: $HOST...${NC}"
    ssh $SSH_OPTS "$SSH_TARGET"
}

cmd_sleep() {
    echo -e "${YELLOW}[☾] Sleep mode: $HOST...${NC}"
    ssh -t $SSH_OPTS "$SSH_TARGET" 'sudo pmset sleepnow'
}

cmd_reboot() {
    echo -e "${YELLOW}[!] Reboot: $HOST...${NC}"
    ssh -t $SSH_OPTS "$SSH_TARGET" 'sudo shutdown -r now'
}

cmd_status() {
    echo -e "${BLUE}[?] Vérification statut: $HOST...${NC}"
    echo ""

    # Ping check
    ping -c 1 -W 1 "$HOST" > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo -e "  Serveur:      ${GREEN}● ONLINE${NC}"
    else
        echo -e "  Serveur:      ${RED}● OFFLINE${NC} (ou en veille profonde)"
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
        echo -e "  Modèle actif: ${CYAN}${ACTIVE}${NC}"
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
        echo -e "${BLUE}[⟳] Régénération de la configuration...${NC}"
        bash "$SCRIPT_DIR/gen_config.sh"
    else
        if [ -f "$CONF_FILE" ]; then
            echo -e "${BLUE}[☰] Configuration Mirza${NC}"
            echo -e "${DIM}  (fichier: ${CONF_FILE})${NC}"
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
            echo -e "${YELLOW}Aucun fichier de configuration trouvé.${NC}"
            echo -e "Génère-le avec: ${CYAN}mirza config --refresh${NC}"
        fi
    fi
}

cmd_models() {
    echo -e "${BLUE}[⊞] Catalogue de modèles MLX${NC}"
    echo ""

    if [ ! -f "$MODELS_FILE" ]; then
        echo -e "${RED}  ✗ Catalogue non trouvé: ${MODELS_FILE}${NC}"
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
    print('  Catégories disponibles:')
    for key, cat in categories.items():
        print(f'    {cat[\"icon\"]}  {cat[\"label\"]}  ({key})')
    print()
    print(f'  RAM détectée: {ram} Go — modèles compatibles affichés')
    print(f'  Filtrer: mirza models <catégorie>')
    print()

# Filter and display models
compatible = [m for m in catalog if m['min_ram_gb'] <= ram]
if cat_filter:
    compatible = [m for m in compatible if cat_filter in m.get('categories', [])]

if not compatible:
    print('  Aucun modèle compatible trouvé.')
    sys.exit(0)

# Group by family
families = {}
for m in compatible:
    fam = m.get('family', 'Autre')
    families.setdefault(fam, []).append(m)

for fam, models in sorted(families.items()):
    print(f'  ─── {fam} ───')
    for m in sorted(models, key=lambda x: x['size_gb']):
        star = ' ★' if m.get('recommended') else ''
        cats = ' '.join(categories.get(c, {}).get('icon', '') for c in m.get('categories', []))
        print(f'    {m[\"id\"]:<40} {m[\"size_gb\"]:>5.1f} Go  {cats}{star}')
        print(f'      {m[\"description\"]}')
    print()
" 2>/dev/null

    echo ""
    echo -e "  ${DIM}★ = recommandé pour votre config${NC}"
    echo -e "  ${DIM}Déployer: mirza deploy <model_id>${NC}"
}

cmd_deploy() {
    local REPO_ID="$2"
    local FILENAME="$3"

    if [ -z "$REPO_ID" ]; then
        echo -e "${RED}Usage: mirza deploy <hf_repo_gguf> [filename]${NC}"
        echo -e "${DIM}  Exemple: mirza deploy Bartowski/Llama-3.2-3B-Instruct-GGUF${NC}"
        return 1
    fi

    echo -e "${BLUE}[↓] Déploiement llama.cpp sur Mirza...${NC}"
    echo -e "  Dépôt: ${CYAN}${REPO_ID}${NC}"
    if [ -n "$FILENAME" ]; then echo -e "  Fichier: ${CYAN}${FILENAME}${NC}"; fi
    echo ""

    # Deploy via SSH: using the custom deploy_llama.py in llmServe
    echo -e "${YELLOW}  Analyse et téléchargement (via hf)...${NC}"
    remote_exec "cd ~/llmServe && uv run python deploy_llama.py '${REPO_ID}' '${FILENAME}'"

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}  ✓ Modèle déployé avec succès !${NC}"
        echo -e "  Lancer: ${CYAN}mirza serve${NC}"
    else
        echo -e "${RED}  ✗ Erreur lors du déploiement.${NC}"
    fi
}

cmd_remove() {
    local FILENAME="$2"
    if [ -z "$FILENAME" ]; then
        echo -e "${RED}Usage: mirza remove <filename.gguf>${NC}"
        echo -e "${DIM}  Liste des modèles: mirza status (ou ssh ls ~/mirza-models)${NC}"
        return 1
    fi

    echo -e "${YELLOW}[-] Suppression du modèle: ${FILENAME}...${NC}"
    remote_exec "rm -f ~/mirza-models/${FILENAME}"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}  ✓ Modèle supprimé.${NC}"
    else
        echo -e "${RED}  ✗ Erreur lors de la suppression.${NC}"
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
            -*)           EXTRA_FLAGS="$EXTRA_FLAGS $1"; shift ;;
            *)            EXTRA_FLAGS="$EXTRA_FLAGS $1"; shift ;;
        esac
    done

    echo -e "${BLUE}[▶] Démarrage du serveur Llama-CPP...${NC}"
    echo -e "  Port:      ${CYAN}${PORT}${NC}"
    echo -e "  Context:   ${CYAN}${CTX}${NC}"
    echo -e "  KV Cache:  ${CYAN}${KV_Q}${NC}"
    if [ -n "$FA" ]; then echo -e "  Optim:     ${GREEN}Flash Attention ON${NC}"; fi

    local SERVER_CMD="uv run python serve_llama.py --port $PORT --ctx $CTX --kv-q $KV_Q $FA"
    
    remote_exec "cd ~/llmServe && nohup $SERVER_CMD $EXTRA_FLAGS > /tmp/mirza-llm.stdout.log 2>/tmp/mirza-llm.stderr.log &"

    echo ""
    # Wait for server
    printf "  Attente du serveur"
    for i in $(seq 1 30); do
        if curl -sf --max-time 1 "http://${HOST}:${PORT}/v1/models" &>/dev/null; then
            echo ""
            echo -e "${GREEN}  ✓ Serveur opérationnel !${NC}"
            echo -e "  Endpoint: ${YELLOW}http://${HOST}:${PORT}/v1${NC}"
            return 0
        fi
        printf "."
        sleep 2
    done
    echo ""
    echo -e "${YELLOW}  ⏳ Le serveur démarre lentement...${NC}"
    echo -e "  ${DIM}Vérifier: mirza ssh puis tail -f /tmp/mirza-llm.stderr.log${NC}"
}

cmd_stop_llm() {
    echo -e "${YELLOW}[■] Arrêt du serveur Llama-CPP...${NC}"
    remote_exec "pkill -f 'llama_cpp.server' 2>/dev/null"
    echo -e "${GREEN}  ✓ Serveur arrêté.${NC}"
}

cmd_stop() {
    echo -e "${YELLOW}[■] Global Stop: Shutting down all Mirza services...${NC}"
    cmd_stop_llm
    cmd_stop_ui
    echo -e "${GREEN}✓ All services stopped.${NC}"
}

cmd_chat() {
    echo -e "${BLUE}[] Chat interactif avec Mirza${NC}"
    echo -e "${DIM}  Endpoint: http://${HOST}:${API_PORT}/v1/chat/completions${NC}"
    echo -e "${DIM}  Tapez 'exit' pour quitter, 'clear' pour réinitialiser${NC}"
    echo ""

    # Build conversation history
    MESSAGES='[]'

    while true; do
        echo -ne "${GREEN}Vous > ${NC}"
        read -r USER_INPUT

        [ "$USER_INPUT" = "exit" ] && echo -e "\n${DIM}Au revoir !${NC}" && break
        [ "$USER_INPUT" = "clear" ] && MESSAGES='[]' && echo -e "${DIM}  Historique réinitialisé.${NC}\n" && continue
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
            echo -e "${RED}  [Erreur: pas de réponse du serveur]${NC}"
            echo -e "${DIM}  Vérifiez que le serveur tourne: mirza status${NC}"
            continue
        fi

        # Extract and display the assistant's reply
        REPLY=$(echo "$RESPONSE" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    print(data['choices'][0]['message']['content'])
except:
    print('[Erreur de parsing]')
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
    echo -e "${BLUE}[⇋] Création du tunnel SSH...${NC}"
    echo -e "  Port local ${CYAN}${PORT}${NC} → Mirza:${CYAN}${PORT}${NC}"
    echo -e "  API accessible sur: ${YELLOW}http://localhost:${PORT}/v1${NC}"
    echo -e "${DIM}  Ctrl+C pour fermer le tunnel${NC}"
    echo ""
    ssh $SSH_OPTS -N -L "${PORT}:localhost:${PORT}" "$SSH_TARGET"
}

cmd_ui() {
    local PORT="${2:-$API_PORT}"

    if [ ! -f "$WEBUI_DIR/index.html" ]; then
        echo -e "${RED}  ✗ WebUI non trouvée: ${WEBUI_DIR}${NC}"
        return 1
    fi

    echo -e "${BLUE}[] Lancement de la WebUI Mirza...${NC}"
    echo ""

    # Check if tunnel is needed (are we on the same machine as the server?)
    if ! curl -sf --max-time 2 "http://localhost:${PORT}/v1/models" &>/dev/null; then
        echo -e "${YELLOW}  Le serveur MLX n'est pas accessible sur localhost:${PORT}${NC}"
        echo -e "${YELLOW}  Lancement du tunnel SSH en arrière-plan...${NC}"
        ssh $SSH_OPTS -N -f -L "${PORT}:localhost:${PORT}" "$SSH_TARGET"
        sleep 1
        echo -e "${GREEN}  ✓ Tunnel actif.${NC}"
    fi

    echo -e "  API MLX:  ${YELLOW}http://localhost:${PORT}/v1${NC}"
    echo -e "  WebUI:    ${YELLOW}http://localhost:3333${NC}"
    echo ""

    # Start local web server
    cd "$WEBUI_DIR"
    python3 server.py

}

cmd_stop_ui() {
    echo -e "${YELLOW}[■] Arrêt de la WebUI Mirza...${NC}"
    # Target common ways server.py might be running
    local pids=$(pgrep -f "python.*server.py" || true)
    
    # If no pids found by name, try port 3333 (if lsof is available)
    if [ -z "$pids" ] && command -v lsof >/dev/null 2>&1; then
        pids=$(lsof -t -i :3333 || true)
    fi

    if [ -n "$pids" ]; then
        kill $pids 2>/dev/null
        echo -e "${GREEN}  ✓ WebUI arrêtée.${NC}"
    else
        echo -e "${DIM}  Aucune WebUI Mirza en cours d'exécution.${NC}"
    fi
}

cmd_help() {
    show_header
    echo -e "  ${BOLD}Gestion du serveur${NC}"
    echo -e "    ${CYAN}mirza start${NC}              Réveiller le serveur (Wake-on-LAN)"
    echo -e "    ${CYAN}mirza ssh${NC}                Session SSH interactive"
    echo -e "    ${CYAN}mirza status${NC}             État du serveur et des services"
    echo -e "    ${CYAN}mirza sleep${NC}              Mettre en veille"
    echo -e "    ${CYAN}mirza reboot${NC}             Redémarrer"
    echo ""
    echo -e "  ${BOLD}Intelligence Artificielle (llama.cpp)${NC}"
    echo -e "    ${CYAN}mirza models${NC} [catégorie]  Catalogue de modèles"
    echo -e "    ${CYAN}mirza deploy${NC} <repo> [file] Déployer un GGUF (via hf)"
    echo -e "    ${CYAN}mirza remove${NC} <filename>   Supprimer un modèle local"
    echo -e "    ${CYAN}mirza serve${NC}              Lancer le serveur d'inférence"
    echo -e "    ${CYAN}mirza stop${NC}               Arrêter tous les services (LLM + UI)"
    echo -e "    ${CYAN}mirza stop-llm${NC}           Arrêter uniquement le serveur LLM"
    echo -e "    ${CYAN}mirza chat${NC}               Chat interactif en terminal"
    echo ""
    echo -e "  ${BOLD}Interface & Config${NC}"
    echo -e "    ${CYAN}mirza ui${NC}                 Lancer la WebUI de chat"
    echo -e "    ${CYAN}mirza stop-ui${NC}            Arrêter la WebUI locale"
    echo -e "    ${CYAN}mirza tunnel${NC} [port]       Tunnel SSH vers l'API MLX"
    echo -e "    ${CYAN}mirza config${NC}             Afficher la configuration"
    echo -e "    ${CYAN}mirza config --refresh${NC}   Régénérer la configuration via SSH"
    echo ""
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
    stop-llm)       cmd_stop_llm ;;
    chat)           cmd_chat ;;
    tunnel)         cmd_tunnel "$@" ;;
    ui)             cmd_ui "$@" ;;
    stop-ui)        cmd_stop_ui ;;
    help|--help|-h) cmd_help ;;
    *)              cmd_help ;;
esac
