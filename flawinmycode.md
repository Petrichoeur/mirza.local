# FLAWINMYCODE — Analyse Critique Complète du Codebase Mirza

> Document généré le 16 avril 2026
>Cette analyse est **sans concession**. Chaque défaut potentiel est documenté avec severity, impact et recommandations.

---

##══════════════════════════════════════════════════════════════════════════
## 🔴 CRITICAL — Sécurité
##══════════════════════════════════════════════════════════════════════════

### C1. Injection de Commande Shell via Proxy.Chat
**Fichier:** `webui/server.py:423-439`

```python
sudo_pwd = body.get("sudoAsk", "") if isinstance(body, dict) else ""
cmd = f'echo "{sudo_pwd}" | sudo -S pmset sleepnow'
```

**Problème:** Mot de passe injecté directement dans shell sans échappement. Un attacker peut ejecutar:
`"; rm -rf ~; echo"` → exécution de code arbitraire.

**Impact:** Compromission de la machine distante via REST proxy.

**Recommandation:** Supprimer cette fonctionnalité. Utiliser uniquement SSH keys.

---

### C2. Proxy.Chat Sans Validation de Requête
**Fichier:** `webui/server.py:318-345`

**Problème:** Corps de requête forwarded sans validation, pas de limite de taille.

**Impact:** DoS via payloads volumineux, champs inattendus exploitant llama.cpp.

**Recommandation:** Valider schema, limit size à 1MB max.

---

### C3. Secrets Codés en Dur
**Fichier:** `webui/server.py`, `mirza/mirza.sh`

```python
MAC_ADDR = os.environ.get("MIRZA_MAC_ADRESS", "")
SSH_KEY = Path.home() / ".ssh" / "mirza_key"
```

**Problème:** Paths et credentials dans code source. Si repo est public = leak.

**Recommandation:** Utiliser .env ou config externe, jamais dans code.

---

##══════════════════════════════════════════════════════════════════════════
## 🟠 HIGH — Bugs & Comportements Inattendus
##══════════════════════════════════════════════════════════════════════════

### H1. Debug Logs en Production
**Fichier:** `webui/app.js:2272-2283`

```javascript
console.log('[Mirza] Request settings:', { ... });
```

**Problème:** Logs debug visibles en production, leak informations.

**Recommandation:** Wrapper avec `if (DEBUG)` ou supprimer.

---

### H2. Qwen3.5 Thinking Non-Désactivable
**Fichier:** `webui/app.js:2266-2270`

**Problème:** `thinking_budget_tokens=0`, `chat_template_kwargs` ignorés par le modèle.

**Impact:** Lfeature "disable thinking" ne fonctionne pas.

**Recommandation:** Documenter que Qwen3.5 ne supporte pas esta feature via API.

---

### H3. Cache d'État Sans Expiration
**Fichier:** `webui/server.py:21-22`

```python
_STATUS_CACHE = {"time": 0, "data": None}
```

**Problème:** No TTL défini. Données peuvent être stale.

**Recommandation:** Ajouter `CACHE_TTL = 5` secondes.

---

### H4. getStopTokens Format Incomplet
**Fichier:** `webui/app.js:2181-2202`

**Problème:** Fichiers modèles manquants: phi, command-r, aya, pixtral.

**Impact:** Stop sequences incorrectes pour certains modèles.

**Recommandation:** Ajouter detection pour plus de formatos.

---

### H5. Excessive localStorage Writes
**Fichier:** `webui/app.js` - Multiples `saveSettings()`

**Problème:** Save sur chaque input change sans debounce.

**Impact:** Performance degrade, battery usage mobile.

**Recommandation:** Debounce 500ms avant save.

---

### H6. Pas de Graceful Shutdown
**Fichier:** `llmServe/serve_llama.py`

**Problème:** Si SIGTERM reçu, child process pas killé.

**Impact:** Zombie processes, resource leak.

**Recommandation:**
```python
import atexit
atexit.register(lambda: proc and proc.terminate())
```

---

## 🟡 MEDIUM — Qualité de Code
##══════════════════════════════════════════════════════════════════════════

### M1. top_p Default Inconsistent
**Fichier:** `webui/app.js:52`

```javascript
top_p: 1.0,  // Mais 0.95 utilisé ailleurs
```

**Problème:** Inconsistance de default entre code et UI.

**Recommandation:** Documenter ou aligner à 0.95.

---

### M2. SSH Key Path Non-Vérifié
**Fichier:** `webui/server.py:37`

```python
SSH_KEY = Path.home() / ".ssh" / "mirza_key"
```

**Problème:** Path peux ne pas exister → fail silencieux.

**Recommandation:** Vérifier existence avec message clair.

---

### M3. Inconsistent Naming Convention
**Fichiers:** `webui/app.js`, `index.html`

```
HTML:  setting-top-k, disable-thinking
JS:   topK, disableThinking
```

**Problème:** CamelCase vs kebab-case mix.

**Recommandation:** Standardiser (recommander: kebab HTML, camel JS).

---

### M4. Presets Have Unused Fields
**Fichier:** `webui/app.js:80-86`

```javascript
'thinking-general': { min_p: 0.0, ... }
// min_p nunca usado - leido de UI input
```

**Problème:** Champs définis mais ignorés.

**Recommandation:** Cleaner presets ou les utiliser.

---

### M5. No Error Boundaries in Fetch Calls
**Fichier:** `webui/app.js` - Multiples `await fetch()`

**Problème:** Pas de try/catch avec messages user-friendly.

**Impact:** UI crash ou messages cryptiques.

**Recommandation:** Wrapper tous les fetch avec try/catch.

---

### M6. detect_hardware() Incomplet
**Fichier:** `llmServe/serve_llama.py:24-35`

**Problème:** Solo Mac supportado. GPU detection NVIDIA/AMD manquant.

**Impact:** Mauvais paramétrages sur Linux/Windows.

**Recommandation:** Marquer comme "Mac-only" ou compléter.

---

### M7. Hardcoded Cache Timeout
**Fichier:** `webui/server.py:244`

```python
now - _STATUS_CACHE["time"] < 5000  # Magic number
```

**Problème:** Timeout codé en dur, pas de constante.

**Recommandation:**
```python
STATUS_CACHE_TTL = 5  # seconds
```

---

### M8. Python Variable Non-Init
**Fichier:** `llmServe/serve_llama.py:456`

```python
# proc = None nunca inicialisé
```

**Problème:** Variable référencée avant assignment possibility.

**Recommandation:** Initialiser `proc = None` au début.

---

### M9. PYTHONPATH Pas Configuré
**Fichier:** `llmServe/serve_llama.py:404-455`

```python
cmd = ["python", "-m", "llama_cpp.server", ...]
```

**Problème:** Ne garantit pas que llama-cpp-python est dans PATH.

**Recommandation:** Utiliser venv path complet.

---

### M10. Fichiers dupliqués
**Fichiers:** 
- `scratch/serve_llama.py`
- `llmServe/serve_llama.py`
- `scratch/deploy_llama.py`
- `llmServe/deploy_llama.py`

**Problème:** Duplication de code. Maintainability nightmare.

**Recommandation:** Consolidar en un seul fichier, supprimer scratch/.

---

### M11. No Request Size Limit
**Fichier:** `webui/server.py:318-345`

**Problème:** Corps de requête pas borné.

**Recommandation:** `MAX_BODY_SIZE = 1024 * 1024  # 1MB`

---

### M12. HTTP Server Timeout Manquant
**Fichier:** `webui/server.py`

```python
class QuietHandler(http.server.SimpleHTTPRequestHandler):
    # Pas de timeout défini
```

**Problème:** Connexions peuvent rester ouvertes indéfiniment.

**Recommandation:** Ajouter `timeout = 30` seconds.

---

### M13. Global Mutable State
**Fichier:** `webui/app.js:22-86`

```javascript
const state = { ... }
```

**Problème:** État global mutabl → race conditions potentiels.

**Recommandation:** Considered immutability ou state management lib.

---

### M14. HTML IDs Avant Scripts
**Fichier:** `webui/index.html`

**Problème:** IDs utilisés mais script failure = erreur silencieuse.

**Recommandation:** Ajouter `defer` sur le tag script.

---

### M15. No Input Sanitization
**Fichier:** `webui/server.py:318-345`

**Problème:** User input forwardé sans sanitization.

**Recommandation:** Valider et sanitiser avant envoi.

---

### M16. Logging Inconsistant
**Fichiers:** Multiples

```python
# server.py:Aucun logging structuré
# serve_llama.py: print() everywhere
# app.js: console.log() selectively
```

**Problème:** Pas de標準化Logging.

**Recommandation:** Logger unique pour tout le projet.

---

## 🟢 LOW — Info & Best Practices
##══════════════════════════════════════════════════════════════════════════

### L1. No Tests
**Problème:** Zéro fichier de test trouvé.

**Recommandation:** Ajouter tests (pytest + Vitest).

---

### L2. Documentation Incomplète
**Problème:** Fonctions sans docstrings.

**Recommandation:** Ajouter docstrings pour fonctions exportées.

---

### L3. Magic Numbers
**Fichiers:** Multiples

```python
# "5000" timeout cache
# "4096" max_tokens
# "20" default top_k
```

**Problème:** Nombres magiques sans commentaire.

**Recommandation:** Constants nommées.

---

### L4. Code Duplication
**Fichiers:** `webui/app.js` 

**Problème:** Patterns répétés (provider cards, model rendering).

**Recommandation:** Extraire en fonctions réutilisables.

---

### L5. No Code Style Enforcement
**Problème:** Pas de linting/formatting config.

**Recommandation:** Ajouter ruff (Python), eslint (JS).

---

### L6. No Type Hints
**Fichier:** `webui/server.py`

**Problème:** Python dynamique sans type hints.

**Recommandation:** Ajouter progressivement.

---

### L7. No CI/CD
**Problème:** Pas de pipeline d'intégration.

**Recommandation:** Ajouter GitHub Actions.

---

### L8. No Versioning
**Problème:** Version pas explicite.

**Recommandation:** Ajouter __version__ constant.

---

### L9. No Changelog
**Problème:** Historique des changements non documenté.

**Recommandation:** Ajouter CHANGELOG.md.

---

### L10. No CONTRIBUTING.md
**Problème:** Pas de guidelines pour contributors.

**Recommandation:** Ajouter CONTRIBUTING.md.

---

## 📊 Résumé par Sévérité

| Severity | Count | Fichiers Concernés |
|----------|-------|-----------------|
| 🔴 CRITICAL | 3 | server.py, mirza.sh |
| 🟠 HIGH | 6 | app.js, server.py, serve_llama.py |
| 🟡 MEDIUM | 16 | Multiples |
| 🟢 LOW | 10 | Projet entier |

**Total: 35 Issues Documentés**

---

## 🎯 Plan d'Action Recommandé

### Sprint 1: Sécurité (1 semaine)
- [ ] C1: Supprimer injection commande shell
- [ ] C2: Valider requête proxy
- [ ] C3: Move secrets vers .env

### Sprint 2: Bugs Critiques (1 semaine)
- [ ] H1: Supprimer debug logs
- [ ] H2: Documenter limitation Qwen
- [ ] H3: Ajouter cache TTL
- [ ] H6: Ajouter graceful shutdown

### Sprint 3: Quality (2 semaines)
- [ ] M1-M16: Nettoyage Medium issues

### Sprint 4: Bonnes Pratiques (2 semaines)
- [ ] L1-L10: Tests, docs, linting

---

*Document généré par analyse automatisée + revue manuelle*
*Dernière mise à jour: 2026-04-16*