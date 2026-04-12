#!/bin/bash
# ==============================================================================
# Mirza AI — Installation du poste client
# Installe les dépendances nécessaires sur CE poste Linux/Ubuntu pour piloter
# le Mac Mini distant, et configure la commande globale "mirza".
# ==============================================================================

# --- Couleurs ---
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}======================================================${NC}"
echo -e "${BLUE}   Installation de l'environnement client Mirza AI    ${NC}"
echo -e "${BLUE}======================================================${NC}"
echo ""

# 1. Vérification du système de paquets
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
    echo -e "${RED}[✗] Gestionnaire de paquets non reconnu. Installez manuellement: jq, curl, wakeonlan, python3.${NC}"
    exit 1
fi

# 2. Installation des dépendances
echo -e "${YELLOW}[1/3] Vérification des dépendances locales...${NC}"
DEPS="jq curl wakeonlan python3 ssh"
MISSING_DEPS=""

for dep in $DEPS; do
    if ! command -v "$dep" >/dev/null 2>&1; then
        MISSING_DEPS="$MISSING_DEPS $dep"
    fi
done

if [ -n "$MISSING_DEPS" ]; then
    echo -e " -> Dépendances manquantes détectées :$MISSING_DEPS"
    echo -e " -> Installation en cours (un mot de passe sudo peut être requis)..."
    eval "$UPDATE_CMD" >/dev/null 2>&1
    eval "$PKG_MGR $MISSING_DEPS"
    echo -e "${GREEN} -> Dépendances installées avec succès.${NC}"
else
    echo -e "${GREEN} -> Toutes les dépendances (jq, curl, wakeonlan, python3, ssh) sont déjà présentes.${NC}"
fi

# 3. Création du lien symbolique pour la commande "mirza"
echo ""
echo -e "${YELLOW}[2/3] Configuration de la commande globale 'mirza'...${NC}"

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)
MIRZA_SH="$SCRIPT_DIR/mirza/mirza.sh"
BIN_DIR="$HOME/.local/bin"

if [ ! -f "$MIRZA_SH" ]; then
    echo -e "${RED}[✗] Fichier introuvable: $MIRZA_SH${NC}"
    echo -e "    Assurez-vous d'exécuter ce script depuis la racine du dépôt."
    exit 1
fi

chmod +x "$MIRZA_SH"
mkdir -p "$BIN_DIR"

if [ -L "$BIN_DIR/mirza" ]; then
    rm "$BIN_DIR/mirza"
fi

ln -s "$MIRZA_SH" "$BIN_DIR/mirza"
echo -e "${GREEN} -> Lien symbolique créé : $BIN_DIR/mirza -> $MIRZA_SH${NC}"

# Vérifier si ~/.local/bin est dans le PATH
if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
    echo -e "${YELLOW} -> Attention: $BIN_DIR n'est pas dans votre \$PATH.${NC}"
    BASHRC="$HOME/.bashrc"
    ZSHRC="$HOME/.zshrc"
    
    if [ -f "$BASHRC" ]; then
        echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$BASHRC"
        echo -e " -> Ajouté au PATH dans $BASHRC"
    fi
    if [ -f "$ZSHRC" ]; then
        echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$ZSHRC"
        echo -e " -> Ajouté au PATH dans $ZSHRC"
    fi
    echo -e " -> ${RED}Veuillez redémarrer votre terminal ou taper : source ~/.bashrc${NC}"
fi

# 4. Gatcha (Configuration des clés SSH si nécessaire)
echo ""
echo -e "${YELLOW}[3/3] Autorisation SSH (Gatcha)...${NC}"
GATCHA_SH="$SCRIPT_DIR/mirza/gatcha.sh"
if [ -f "$GATCHA_SH" ]; then
    chmod +x "$GATCHA_SH"
    echo -e " Voulez-vous exécuter l'échange de clés SSH distant maintenant ? (O/n)"
    read -r response
    if [[ "$response" =~ ^([oO][uU][iI]|[oO]|yes|y|Y)$ ]] || [[ -z "$response" ]]; then
        "$GATCHA_SH"
    else
        echo " -> Étape ignorée. Vous pourrez l'exécuter avec : ./mirza/gatcha.sh"
    fi
fi

echo ""
echo -e "${GREEN}======================================================${NC}"
echo -e "${GREEN}     Installation Client Validée ! 🚀                 ${NC}"
echo -e "${GREEN}======================================================${NC}"
echo -e "Vous pouvez maintenant piloter votre Mac depuis n'importe où :"
echo -e "  Tapez:  ${CYAN}mirza status${NC}"
echo -e "  Tapez:  ${CYAN}mirza ui${NC}       (pour lancer l'interface)"
