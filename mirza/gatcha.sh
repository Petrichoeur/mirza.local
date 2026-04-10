# Génération d'une clé SSH nommée mirza_key
ssh-keygen -t rsa -b 4096 -f ~/.ssh/mirza_key -C "mirza@local.com"

# Démarrage de l'agent SSH (si pas déjà actif)
eval "$(ssh-agent -s)"

# Ajout de la clé privée à l'agent SSH
ssh-add ~/.ssh/mirza_key

# Copie de la clé publique sur le serveur distant
ssh-copy-id -i ~/.ssh/mirza_key.pub <your-user>@mirza.local
