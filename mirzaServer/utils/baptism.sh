#!/bin/bash

# ==============================================================================
# Configuration
# ==============================================================================
# NEW_HOSTNAME: Used for SSH and .local network access (NO spaces allowed)
NEW_HOSTNAME="mirza"

# PRETTY_NAME: Used for Finder, AirDrop, and UI display (Spaces are allowed)
PRETTY_NAME="Serveur Mirza"
# ==============================================================================

# --- Colors for terminal output ---
BLUE='\033[0;34m'
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${BLUE}=== AI Server Renaming Utility ===${NC}"
echo "Applying new name: '$NEW_HOSTNAME'..."

# 1. Set the Bonjour/mDNS network name (e.g., mirza.local)
sudo scutil --set LocalHostName "$NEW_HOSTNAME"

# 2. Set the Terminal/SSH hostname (e.g., user@mirza ~ %)
sudo scutil --set HostName "$NEW_HOSTNAME"

# 3. Set the user-friendly name (Finder / Local Network / AirDrop)
sudo scutil --set ComputerName "$PRETTY_NAME"

# 4. Flush the DNS cache to enforce changes immediately across the system
sudo dscacheutil -flushcache

echo -e "${GREEN}=== Operation completed successfully! ===${NC}"
echo "Your Mac Mini M4 is now officially named: $PRETTY_NAME"
echo "You can reconnect via SSH using: ssh <your_user>@${NEW_HOSTNAME}.local"
