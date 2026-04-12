#!/bin/bash
# ==============================================================================
# Mirza AI — WebUI Local Server
# Lance un serveur HTTP local pour la WebUI de chat
# ==============================================================================

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)
PORT="${1:-3333}"

echo ""
echo -e "\033[0;34m  ╔══════════════════════════════════════════╗\033[0m"
echo -e "\033[0;34m  ║\033[0m    \033[1mMirza AI\033[0m — WebUI Chat Interface     \033[0;34m║\033[0m"
echo -e "\033[0;34m  ╚══════════════════════════════════════════╝\033[0m"
echo ""
echo -e "  Interface:  \033[1;33mhttp://localhost:${PORT}\033[0m"
echo -e "  API MLX:    \033[2mhttp://localhost:8080/v1\033[0m"
echo ""
echo -e "  \033[2mCtrl+C pour arrêter\033[0m"
echo ""

# Open browser (works on Linux and macOS)
if command -v xdg-open &>/dev/null; then
    xdg-open "http://localhost:${PORT}" 2>/dev/null &
elif command -v open &>/dev/null; then
    open "http://localhost:${PORT}" 2>/dev/null &
fi

# Start server
cd "$SCRIPT_DIR"
python3 -m http.server "$PORT"
