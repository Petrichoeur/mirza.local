#!/bin/bash
# ==============================================================================
# Mirza AI — Station Control Panel Server
# Lance le backend Python qui sert l'UI et expose les commandes mirza en API
# ==============================================================================

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)
REPO_DIR=$(cd "$SCRIPT_DIR/.." &> /dev/null && pwd)

# Source environment variables from mirza.conf if available
CONF_FILE="$REPO_DIR/mirza/mirza.conf"
if [ -f "$CONF_FILE" ]; then
    export MIRZA_HOST=$(grep "^ip=" "$CONF_FILE" 2>/dev/null | head -1 | cut -d'=' -f2-)
    export MIRZA_HOST="${MIRZA_HOST:-mirza.local}"
fi

# Override port via argument
export MIRZA_WEBUI_PORT="${1:-3333}"

# Open browser
if command -v xdg-open &>/dev/null; then
    (sleep 1 && xdg-open "http://localhost:${MIRZA_WEBUI_PORT}" 2>/dev/null) &
elif command -v open &>/dev/null; then
    (sleep 1 && open "http://localhost:${MIRZA_WEBUI_PORT}" 2>/dev/null) &
fi

# Start server
cd "$SCRIPT_DIR"
python3 server.py

