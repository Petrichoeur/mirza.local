#!/bin/bash

# --- Configuration ---
# Ajouter ces différentes variables récupérées au préalable en tant que variable d'environnement 
# Ajouter dans ~/.bashrc  -> 
#   export MIRZA_MAC_ADRESS=blablabla 
#   etc ...
MAC_ADDR=$MIRZA_MAC_ADRESS
USER=$MIRZA_USER
HOST=$MIRZA_HOST
# ---------------------

case "$1" in
    start|up)
        echo -e "\033[0;32m[+] wake up:  $HOST ...\033[0m"
        wakeonlan $MAC_ADDR
        ;;
    ssh|connect)
        echo -e "\033[0;34m[+]  SSH  remote connection to : $HOST...\033[0m"
        ssh ${USER}@${HOST}
        ;;
    sleep)
        echo -e "\033[1;33m[+] sleepmod: $HOST...\033[0m"
        # pmset sleepnow met le Mac en veille immédiatement
        ssh ${USER}@${HOST} 'pmset sleepnow'
        ;;
    reboot)
        echo -e "\033[1;33m[!] reboot :  $HOST...\033[0m"
        ssh -t ${USER}@${HOST} 'sudo shutdown -r now'
        ;;
    status)
        echo -e "\033[0;34m[+] Vérification statut :  $HOST...\033[0m"
        ping -c 1 -W 1 $HOST > /dev/null 2>&1
        if [ $? -eq 0 ]; then
            echo -e "Mirza  \033[0;32mONLINE\033[0m"
        else
            echo -e "Mirza est \033[0;31mOFFLINE\033[0m (ou en veille profonde)"
        fi
        ;;
    *)
	echo "Mirza command usage:"
        echo "  mirza start   : Wakes up the server (Wake-on-LAN)"
        echo "  mirza ssh     : Opens a terminal session"
        echo "  mirza sleep   : Puts the server to sleep"
        echo "  mirza status  : Checks if the server is responding"
        exit 1
esac
