#!/bin/bash
# ==============================================================================
# Mirza AI -- Client workstation setup
# Installs required dependencies on this Linux machine to control the remote
# Apple Silicon Mac, and registers the global "mirza" command.
# ==============================================================================

# --- Colors ---
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo -e "${BLUE}======================================================${NC}"
echo -e "${BLUE}   Mirza AI -- Client Environment Setup               ${NC}"
echo -e "${BLUE}======================================================${NC}"
echo ""

# 1. Detect package manager
if command -v apt-get >/dev/null 2>&1; then
    PKG_MGR="sudo apt-get install -y"
    UPDATE_CMD="sudo apt-get update"
elif command -v pacman >/dev/null 2>&1; then
    PKG_MGR="sudo pacman -S --noconfirm"
    UPDATE_CMD="sudo pacman -Sy"
elif command -v dnf >/dev/null 2>&1; then
    PKG_MGR="sudo dnf install -y"
    UPDATE_CMD="echo 'Skipping dnf update'"
else
    echo -e "${RED}[x] Unknown package manager. Please install manually: jq, curl, wakeonlan, python3.${NC}"
    exit 1
fi

# 2. Install local dependencies
echo -e "${YELLOW}[1/4] Checking local dependencies...${NC}"
DEPS="jq curl wakeonlan python3 ssh"
MISSING_DEPS=""

for dep in $DEPS; do
    if ! command -v "$dep" >/dev/null 2>&1; then
        MISSING_DEPS="$MISSING_DEPS $dep"
    fi
done

if [ -n "$MISSING_DEPS" ]; then
    echo -e " -> Missing dependencies detected:$MISSING_DEPS"
    echo -e " -> Installing now (sudo password may be required)..."
    eval "$UPDATE_CMD" >/dev/null 2>&1
    eval "$PKG_MGR $MISSING_DEPS"
    echo -e "${GREEN} -> Dependencies installed successfully.${NC}"
else
    echo -e "${GREEN} -> All dependencies (jq, curl, wakeonlan, python3, ssh) are already present.${NC}"
fi

# 3. Create the global "mirza" symlink
echo ""
echo -e "${YELLOW}[2/4] Registering the global 'mirza' command...${NC}"

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)
MIRZA_SH="$SCRIPT_DIR/mirza/mirza.sh"
BIN_DIR="$HOME/.local/bin"

if [ ! -f "$MIRZA_SH" ]; then
    echo -e "${RED}[x] File not found: $MIRZA_SH${NC}"
    echo -e "    Make sure you run this script from the root of the repository."
    exit 1
fi

chmod +x "$MIRZA_SH"
mkdir -p "$BIN_DIR"

if [ -L "$BIN_DIR/mirza" ]; then
    rm "$BIN_DIR/mirza"
fi

ln -s "$MIRZA_SH" "$BIN_DIR/mirza"
echo -e "${GREEN} -> Symlink created: $BIN_DIR/mirza -> $MIRZA_SH${NC}"

# Check if ~/.local/bin is in PATH
if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
    echo -e "${YELLOW} -> Warning: $BIN_DIR is not in your \$PATH.${NC}"
    BASHRC="$HOME/.bashrc"
    ZSHRC="$HOME/.zshrc"

    if [ -f "$BASHRC" ]; then
        echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$BASHRC"
        echo -e " -> Added to PATH in $BASHRC"
    fi
    if [ -f "$ZSHRC" ]; then
        echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$ZSHRC"
        echo -e " -> Added to PATH in $ZSHRC"
    fi
    echo -e " -> ${RED}Please restart your terminal or run: source ~/.bashrc${NC}"
fi

# 4. Connectivity & SSH authorization check
echo ""
echo -e "${YELLOW}[3/4] Connectivity & SSH Authorization Check...${NC}"
TARGET_HOST="mirza.local"

if command -v nc >/dev/null 2>&1; then
    if nc -z -w 2 "$TARGET_HOST" 22 2>/dev/null; then
         echo -e " ${GREEN}[+] Mac server reachable via SSH at ${TARGET_HOST}:22${NC}"
    else
         echo -e " ${RED}[!] Cannot reach ${TARGET_HOST}:22. Make sure the Mac is powered on.${NC}"
    fi
else
    if ping -c 1 -W 2 "$TARGET_HOST" >/dev/null 2>&1; then
         echo -e " ${GREEN}[+] Mac server reachable via ping at ${TARGET_HOST}${NC}"
    else
         echo -e " ${RED}[!] Cannot ping ${TARGET_HOST}. Make sure the Mac is powered on.${NC}"
    fi
fi

echo -e " -> Info: SSH key exchange (gatcha.sh) is skipped to avoid blocking the install."
echo -e "    You can configure keys later by running: ./mirza/gatcha.sh"


# 5. Deploy server components, monitoring stack and LLM backend to the Mac
echo ""
echo -e "${YELLOW}[4/5] Deploying components to the Mac...${NC}"
echo -e " Do you want to sync the logic (Monitoring + LLM Backend) to the Mac? (y/N)"
read -r deploy_resp
if [[ "$deploy_resp" =~ ^([yY][eE][sS]|[yY]|[oO][uU][iI]|[oO])$ ]] || [[ -z "$deploy_resp" ]]; then

    TARGET_USER="${MIRZA_USER}"
    TARGET_HOST="${MIRZA_HOST:-mirza.local}"

    if [[ -z "$TARGET_USER" ]]; then
        echo -e " -> What is the SSH username of the remote Mac? (e.g. john)"
        read -r TARGET_USER
    fi

    if [ -n "$TARGET_USER" ] && [ -n "$TARGET_HOST" ]; then
        echo -e "\n --- PUSHING FILES ---"
        if command -v rsync >/dev/null 2>&1; then
            echo -e " ${CYAN}Syncing (rsync) to ${TARGET_USER}@${TARGET_HOST}...${NC}"
            rsync -avz "$SCRIPT_DIR/mirzaServer/" "${TARGET_USER}@${TARGET_HOST}:~/mirzaServer/"
            rsync -avz "$SCRIPT_DIR/llmServe/" "${TARGET_USER}@${TARGET_HOST}:~/llmServe/"
            echo -e " ${GREEN}[+] Files (Server & LLM backend) synced successfully!${NC}"
        else
            echo -e " ${CYAN}Copying (scp) to ${TARGET_USER}@${TARGET_HOST}:~/...${NC}"
            scp -r "$SCRIPT_DIR/mirzaServer" "${TARGET_USER}@${TARGET_HOST}:~/"
            scp -r "$SCRIPT_DIR/llmServe" "${TARGET_USER}@${TARGET_HOST}:~/"
            echo -e " ${GREEN}[+] Files copied successfully!${NC}"
        fi

        echo -e "\n --- SETTING UP MONITORING (Grafana / Prometheus) ---"
        ssh "${TARGET_USER}@${TARGET_HOST}" "bash -l -c 'bash ~/mirzaServer/monitoring/setup_monitoring.sh'"

        echo -e "\n --- INITIALIZING AI ENVIRONMENT (uv / llama-cpp-python) ---"
        echo -e " ${CYAN}Installing Llama.cpp dependencies on the Mac...${NC}"
        ssh "${TARGET_USER}@${TARGET_HOST}" "bash -l -c 'cd ~/llmServe && uv sync'"
        echo -e " ${GREEN}[+] Llama.cpp environment ready.${NC}"

    else
        echo -e "${RED} -> Missing username or host — deployment cancelled.${NC}"
    fi
else
    echo " -> Deployment skipped."
fi

echo ""
echo -e "${GREEN}======================================================${NC}"
echo -e "${GREEN}     Setup Complete!                                  ${NC}"
echo -e "${GREEN}======================================================${NC}"
echo -e "You can now control your Mac from anywhere:"
echo ""
echo -e "${YELLOW} -> Reloading Bash environment...${NC}"

if [ -f "$HOME/.bashrc" ]; then
    source "$HOME/.bashrc"
fi

echo -e "  -> ${BOLD}IMPORTANT${NC}: To activate the 'mirza' command immediately, run: ${CYAN}source ~/.bashrc${NC}"
echo -e "               or restart your terminal."
