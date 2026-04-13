#!/bin/bash
# ==============================================================================
# Mirza AI -- Installation du poste client
# Installe les dependances necessaires sur CE poste Linux/Ubuntu pour piloter
# le Mac Mini distant, et configure la commande globale "mirza".
# ==============================================================================

# --- Couleurs ---
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo -e "${BLUE}======================================================${NC}"
echo -e "${BLUE}   Installation de l'environnement client MirzAI      ${NC}"
echo -e "${BLUE}======================================================${NC}"
echo ""

# 1. Verification du systeme de paquets
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
    echo -e "${RED}[x] Gestionnaire de paquets non reconnu. Installez manuellement: jq, curl, wakeonlan, python3.${NC}"
    exit 1
fi

# 2. Installation des dependances
echo -e "${YELLOW}[1/4] Verification des dependances locales...${NC}"
DEPS="jq curl wakeonlan python3 ssh"
MISSING_DEPS=""

for dep in $DEPS; do
    if ! command -v "$dep" >/dev/null 2>&1; then
        MISSING_DEPS="$MISSING_DEPS $dep"
    fi
done

if [ -n "$MISSING_DEPS" ]; then
    echo -e " -> Dependances manquantes detectees :$MISSING_DEPS"
    echo -e " -> Installation en cours (un mot de passe sudo peut etre requis)..."
    eval "$UPDATE_CMD" >/dev/null 2>&1
    eval "$PKG_MGR $MISSING_DEPS"
    echo -e "${GREEN} -> Dependances installees avec succes.${NC}"
else
    echo -e "${GREEN} -> Toutes les dependances (jq, curl, wakeonlan, python3, ssh) sont deja presentes.${NC}"
fi

# 3. Creation du lien symbolique pour la commande "mirza"
echo ""
echo -e "${YELLOW}[2/4] Configuration de la commande globale 'mirza'...${NC}"

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)
MIRZA_SH="$SCRIPT_DIR/mirza/mirza.sh"
BIN_DIR="$HOME/.local/bin"

if [ ! -f "$MIRZA_SH" ]; then
    echo -e "${RED}[x] Fichier introuvable: $MIRZA_SH${NC}"
    echo -e "    Assurez-vous d'executer ce script depuis la racine du depot."
    exit 1
fi

chmod +x "$MIRZA_SH"
mkdir -p "$BIN_DIR"

if [ -L "$BIN_DIR/mirza" ]; then
    rm "$BIN_DIR/mirza"
fi

ln -s "$MIRZA_SH" "$BIN_DIR/mirza"
echo -e "${GREEN} -> Lien symbolique cree : $BIN_DIR/mirza -> $MIRZA_SH${NC}"

# Verifier si ~/.local/bin est dans le PATH
if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
    echo -e "${YELLOW} -> Attention: $BIN_DIR n'est pas dans votre \$PATH.${NC}"
    BASHRC="$HOME/.bashrc"
    ZSHRC="$HOME/.zshrc"
    
    if [ -f "$BASHRC" ]; then
        echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$BASHRC"
        echo -e " -> Ajoute au PATH dans $BASHRC"
    fi
    if [ -f "$ZSHRC" ]; then
        echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$ZSHRC"
        echo -e " -> Ajoute au PATH dans $ZSHRC"
    fi
    echo -e " -> ${RED}Veuillez redemarrer votre terminal ou taper : source ~/.bashrc${NC}"
fi

# 4. Gatcha (sans execution bloquante via SSH)
echo ""
echo -e "${YELLOW}[3/4] Connectivite & Autorisation SSH (Gatcha)...${NC}"
TARGET_HOST="mirza.local"

if command -v nc >/dev/null 2>&1; then
    if nc -z -w 2 "$TARGET_HOST" 22 2>/dev/null; then
         echo -e " ${GREEN}[+] Serveur Mac joignable en SSH sur ${TARGET_HOST}:22${NC}"
    else
         echo -e " ${RED}[!] Impossible de joindre ${TARGET_HOST}:22. Assurez-vous que le Mac est allume.${NC}"
    fi
else
    if ping -c 1 -W 2 "$TARGET_HOST" >/dev/null 2>&1; then
         echo -e " ${GREEN}[+] Serveur Mac joignable via ping sur ${TARGET_HOST}${NC}"
    else
         echo -e " ${RED}[!] Impossible de pinger ${TARGET_HOST}. Assurez-vous que le Mac est allume.${NC}"
    fi
fi

echo -e " -> Info: L'etape d'echange de cles (gatcha.sh) est ignoree pour"
echo -e "    ne pas bloquer l'installation. Vous pourrez configurer vos cles"
echo -e "    plus tard en executant : ./mirza/gatcha.sh"


# 5. Deploiement du dossier serveur et MLX/uv backend
echo ""
echo -e "${YELLOW}[4/4] Deploiement des scripts vers le Mac & Setup Backend...${NC}"
echo -e " Voulez-vous copier la logique serveur vers le Mac et y activer le monitoring (Grafana/Prometheus) maintenant ? (O/n)"
read -r deploy_resp
if [[ "$deploy_resp" =~ ^([oO][uU][iI]|[oO]|yes|y|Y)$ ]] || [[ -z "$deploy_resp" ]]; then
    
    if [ -f "$HOME/.bashrc" ]; then
        source "$HOME/.bashrc"
    fi
    
    TARGET_USER="${MIRZA_USER}"
    TARGET_HOST="${MIRZA_HOST:-mirza.local}"
    
    if [[ -z "$TARGET_USER" ]]; then
        echo -e " -> Quel est l'utilisateur SSH du Mac distant ? (ex: petrichoeur)"
        read -r TARGET_USER
    fi
    
    if [ -n "$TARGET_USER" ] && [ -n "$TARGET_HOST" ]; then
        echo -e "\n --- PUSH DES FICHIERS ---"
        if command -v rsync >/dev/null 2>&1; then
            echo -e " ${CYAN}Synchronisation (rsync) vers ${TARGET_USER}@${TARGET_HOST}:~/mirzaServer/...${NC}"
            rsync -avz "$SCRIPT_DIR/mirzaServer/" "${TARGET_USER}@${TARGET_HOST}:~/mirzaServer/"
            echo -e " ${GREEN}[+] Fichiers copies avec succes !${NC}"
        else
            echo -e " ${CYAN}Copie (scp) vers ${TARGET_USER}@${TARGET_HOST}:~/...${NC}"
            scp -r "$SCRIPT_DIR/mirzaServer" "${TARGET_USER}@${TARGET_HOST}:~/"
            echo -e " ${GREEN}[+] Fichiers copies avec succes !${NC}"
        fi
        
        echo -e "\n --- CONFIGURATION DU MONITORING (Grafana / Prometheus) ---"
        echo -e " Execution de setup_monitoring.sh en distant...\n"
        ssh "${TARGET_USER}@${TARGET_HOST}" "bash -l -c 'bash ~/mirzaServer/monitoring/setup_monitoring.sh'"
        
    else
        echo -e "${RED} -> Utilisateur ou hote manquant, deploiement annule.${NC}"
    fi
else
    echo " -> Deploiement et installation ignoree."
fi

echo ""
echo -e "${GREEN}======================================================${NC}"
echo -e "${GREEN}     Installation Complete Validee !                  ${NC}"
echo -e "${GREEN}======================================================${NC}"
echo -e "Vous pouvez maintenant piloter votre Mac depuis n'importe ou :"
echo ""
echo -e "${YELLOW} -> Rechargement de l'environnement Bash...${NC}"

if [ -f "$HOME/.bashrc" ]; then
    source "$HOME/.bashrc"
fi

echo -e "  -> ${BOLD}IMPORTANT${NC}: Pour activer les commandes immediatement, tapez : ${CYAN}source ~/.bashrc${NC}"
echo -e "                     ou redemarrez votre terminal."
