# Génération d'une clé SSH nommée mirza_key
ssh-keygen -t rsa -b 4096 -f ~/.ssh/mirza_key -C "mirza@local.com"

# Démarrage de l'agent SSH (si pas déjà actif)
eval "$(ssh-agent -s)"

# Ajout de la clé privée à l'agent SSH
ssh-add ~/.ssh/mirza_key

# Copie de la clé publique sur le serveur distant
ssh-copy-id -i ~/.ssh/mirza_key.pub <your-user>@mirza.local

# === Configuration ===
REMOTE_USER="mirza"        # Utilisateur SSH du Mac distant
REMOTE_HOST="mirza.local"   # Hostname ou IP du Mac distant (ex: macbook.local, 192.168.1.42)
BASHRC="$HOME/.bashrc"

# === Récupération des infos via SSH ===

echo "Connexion SSH à ${REMOTE_USER}@${REMOTE_HOST}..."

# Récupérer l'adresse IP principale du Mac distant
MIRZA_HOST=$(ssh "${REMOTE_USER}@${REMOTE_HOST}" \
  "ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null")

# Récupérer l'adresse MAC de l'interface réseau active
MIRZA_MAC_ADRESS=$(ssh "${REMOTE_USER}@${REMOTE_HOST}" \
  'ifconfig en0 2>/dev/null | awk "/ether/{print \$2}" || ifconfig en1 2>/dev/null | awk "/ether/{print \$2}"')


# Récupérer le nom d'utilisateur distant
MIRZA_USER=$(ssh "${REMOTE_USER}@${REMOTE_HOST}" "whoami")


echo ""
echo "Valeurs récupérées :"
echo "  MIRZA_HOST       = ${MIRZA_HOST}"
echo "  MIRZA_MAC_ADRESS = ${MIRZA_MAC_ADRESS}"
echo "  MIRZA_USER       = ${MIRZA_USER}"

if [[ -z "$MIRZA_HOST" || -z "$MIRZA_MAC_ADRESS" || -z "$MIRZA_USER" ]]; then
  echo ""
  echo "ERREUR : Certaines valeurs sont vides. Vérifie ta connexion SSH."
  exit 1
fi

# Injection dans le .bashrc local 

# Supprimer les anciennes entrées si elles existent déjà
sed -i.bak '/^export MIRZA_HOST=/d'       "$BASHRC"
sed -i.bak '/^export MIRZA_MAC_ADRESS=/d' "$BASHRC"
sed -i.bak '/^export MIRZA_USER=/d'       "$BASHRC"

# Ajouter les nouvelles valeurs
{
  echo ""
  echo "# --- Variables Mirza (Mac distant) ---"
  echo "export MIRZA_HOST=\"${MIRZA_HOST}\""
  echo "export MIRZA_MAC_ADRESS=\"${MIRZA_MAC_ADRESS}\""
  echo "export MIRZA_USER=\"${MIRZA_USER}\""
} >> "$BASHRC"

echo ""
echo "Variables ajoutées dans ${BASHRC} avec succès."
echo "Pour les charger immédiatement, lance :"
echo "  source ${BASHRC}"
