#  Mirza - Mac Mini Apple Silicon Server

Bienvenue dans le dépôt de **Mirza** ! 
Ce guide documente la transformation complète d'un Mac Mini Apple Silicon (M1, M2, M3, M4 ou M5) d'une simple machine de bureau en un serveur d'inférence IA dédié, robuste et monitoré de bout en bout.

L'objectif : Brancher le Mac sur le réseau, le débrancher de son écran, et tout gérer à distance via SSH tout en gardant un œil sur ses constantes vitales via Grafana.

---

##  Phase 1 : Préparation de macOS (Depuis l'interface graphique)

Avant de débrancher l'écran et le clavier, il faut dire à macOS d'agir comme un serveur.

### 1. Paramètres d'Énergie (Ne jamais dormir)
Allez dans **Réglages Système** > **Écrans** > **Avancé...**
* Activer : *Empêcher la suspension d’activité automatique lorsque l’écran est éteint*.

Allez dans **Réglages Système** > **Énergie** (ou Batterie/Énergie) :
* Activer : *Démarrer automatiquement après une panne de courant* (Crucial pour un serveur).
* Activer : *Réactiver lors d'un accès réseau* (Wake on LAN).

### 2. Identité Réseau
Allez dans **Réglages Système** > **Général** > **Partage** :
* Tout en bas, dans **Nom d'hôte local**, cliquez sur *Modifier...*
* Définissez le nom : `mirza` (Cela créera l'adresse mDNS `mirza.local`).

### 3. Accès à distance (Le Cordon Ombilical)
Toujours dans **Réglages Système** > **Général** > **Partage** :
* Activer **Session à distance** (C'est le serveur SSH). Autorisez votre utilisateur.
* Activer **Partage d'écran** (Pour garder un accès VNC au bureau macOS au cas où). Autorisez votre utilisateur.

Vous pouvez maintenant débrancher l'écran de Mirza !

---

##  Phase 2 : Configuration du Routeur / Box Internet

Un serveur qui change d'IP à chaque redémarrage est un cauchemar.

1. Connectez-vous à l'interface d'administration de votre Box ou Routeur (souvent `192.168.1.1` ou `192.168.0.1`).
2. Cherchez la section **DHCP** ou **Baux Statiques / Adresses IP Fixes**.
3. Associez l'adresse MAC de Mirza (port Ethernet de préférence) à une adresse IP fixe (ex: `192.168.1.87`).
4. *Optionnel mais recommandé* : Si votre routeur a une option "IGMP Snooping" ou "Multicast Routing", assurez-vous qu'elle ne bloque pas le trafic pour que la résolution Bonjour/mDNS (`mirza.local`) fonctionne bien sur votre réseau.
5. Avant de pouvoir installer quoi que ce soit, macOS a besoin de ses outils de développement de base. Téléchargez Xcode sur l'AppStore ! 

## Phase 3 : La Stack de Monitoring (Le Cerveau de Mirza)
Connectez-vous à Mirza via SSH : ssh votre_user@mirza.local