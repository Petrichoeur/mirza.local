# FLOW — Correctifs Documentés pour Mirza

> Ce document détail每个修复方案 pour chaque issue identifié dans flawinmycode.md

---

## ═══════════════════════════════════════════════════════════════════════════════════
## 🔴 CORRECTIFS CRITIQUES
## ═══════════════════════════════════════════════════════════════════════════════════

### C1: Injection de Commande Shell via Proxy.Chat

**Fichier:** `webui/server.py:423-439`

**Code Problématique:**
```python
sudo_pwd = body.get("sudoAsk", "") if isinstance(body, dict) else ""
cmd = f'echo "{sudo_pwd}" | sudo -S pmset sleepnow'
subprocess.run(cmd, shell=True, ...)
```

**Correction:**
```python
# Supprimer complètement cette fonctionnalité
# OU utiliser uniquement SSH sans mot de passe

# Option 1: Supprimer le endpoint
elif path == "/api/sleep" and method == "POST":
    return 501, {"error": "Not implemented - use SSH key authentication"}

# Option 2: SSH keyOnly (recommandé)
elif path == "/api/sleep" and method == "POST":
    ssh_cmd = ["ssh", "-i", str(SSH_KEY), f"{USER}@{HOST}", "pmset sleepnow"]
    try:
        result = subprocess.run(ssh_cmd, capture_output=True, timeout=10)
        return 200 if result.returncode == 0 else 500, {"error": result.stderr.decode()}
    except Exception as e:
        return 500, {"error": str(e)}
```

---

### C2: Proxy.chat Sans Validation

**Fichier:** `webui/server.py:318-345`

**Code Actuel:**
```python
if path == "/v1/chat/completions" and method == "POST":
    body = json.loads(payload)
    # Forward sans validation
    conn.request("POST", "/v1/chat/completions", body=payload, ...)
```

**Correction:**
```python
# Ajouter en haut du fichier
MAX_BODY_SIZE = 1024 * 1024  # 1MB
ALLOWED_FIELDS = {"model", "messages", "temperature", "top_p", "max_tokens", ...}

# Dans le proxy
if path == "/v1/chat/completions" and method == "POST":
    if len(payload) > MAX_BODY_SIZE:
        return 413, {"error": "Payload too large"}

    try:
        body = json.loads(payload)
    except json.JSONDecodeError:
        return 400, {"error": "Invalid JSON"}

    # Valider les champs
    for key in body.keys():
        if key not in ALLOWED_FIELDS:
            return 400, {"error": f"Unknown field: {key}"}

    # Forward...
```

---

### C3: Secrets Codés en Dur

**Fichiers:** `webui/server.py`, `mirza/mirza.sh`

**Code Actuel:**
```python
MAC_ADDR = os.environ.get("MIRZA_MAC_ADRESS", "")
SSH_KEY = Path.home() / ".ssh" / "mirza_key"
```

**Correction:**

Créer `.env` à la racine:
```bash
# .env (ne pas commiter)
MIRZA_MAC_ADRESS=AA:BB:CC:DD:EE:FF
MIRZA_USER=admin
MIRZA_SSH_KEY=/Users/user/.ssh/mirza_key
MIRZA_WEBUI_PORT=3333
MIRZA_API_PORT=8080
```

Charger dans Python:
```python
from dotenv import load_dotenv
load_dotenv()

MAC_ADDR = os.environ.get("MIRZA_MAC_ADRESS", "")
SSH_KEY = Path(os.environ.get("MIRZA_SSH_KEY", Path.home() / ".ssh" / "mirza_key"))
```

**Note:** Ajouter `python-dotenv` dans `pyproject.toml`

---

## ════════════════════════════════════════════��══════════════════════════════
## 🟠 CORRECTIFS HIGH
## ═══════════════════════════════════════════════════════════════════════════

### H1: Debug Logs en Production

**Fichier:** `webui/app.js:2272-2283`

**Code Actuel:**
```javascript
console.log('[Mirza] Request settings:', { ... });
```

**Correction:**
```javascript
// En haut du fichier
const DEBUG = false;

// Remplacer
if (DEBUG) {
    console.log('[Mirza] Request settings:', { ... });
}
```

---

### H2: Qwen3.5 Thinking Non-Désactivable

**Fichier:** `webui/app.js:2266-2270`, `index.html:566-569`

**Problème:** API parameters ignorés par le modèle.

**Correction:** Documenter et offrir alternative:

```javascript
// Dans la fonction sendMessage(), ajouter:
// Log warning only once
if (state.settings.disable_thinking && !state._warnedThinking) {
    console.warn('[Mirza] Warning: disable_thinking may not work with Qwen3.5 via API. Use a different model or accept thinking.');
    state._warnedThinking = true;
}
```

Dans `index.html` - ajouter tooltip:
```html
<span class="setting-hint">Note: Certain models (Qwen3.5) ignore this parameter.</span>
```

---

### H3: Cache d'État Sans Expiration

**Fichier:** `webui/server.py:21-22`

**Correction:**
```python
# Ajouter
CACHE_TTL = 5  # seconds

_STATUS_CACHE = {"time": 0, "data": None}
_CACHE_LOCK = threading.Lock()

# Dans la fonction qui utilise le cache:
def get_cached_status():
    now = time.time()
    with _CACHE_LOCK:
        if now - _STATUS_CACHE["time"] < CACHE_TTL and _STATUS_CACHE["data"]:
            return _STATUS_CACHE["data"]
        # Fetch new data...
```

---

### H4: getStopTokens Incomplet

**Fichier:** `webui/app.js:2181-2202`

**Ajouter nouveaux formats:**
```javascript
function getStopTokens(format, modelName = "") {
    // ... existant ...

    // Ajouter
    if (f === 'phi') return ["<|end|>", "<|disc|>"];
    if (f === 'command-r') return ["<|eot|>", "<|eom|>"];
    if (f === 'aya') return ["<|endoftext|>", "<|done|>"];
    if (f === 'pixtral') return ["<|im_end|>", "[/INST]"];
    if (f === 'qwen2') return ["<|im_end|>", "<|endoftext|>"];
    
    // Fallback
    return ["<|im_end|>", "</s>", "<|eot_id|>"];
}
```

---

### H5: Excessive localStorage Writes

**Fichier:** `webui/app.js:409-423`

**Ajouter debounce:**
```javascript
let _saveSettingsTimeout = null;

// Remplacer l'event listener d'auto-save
settingInputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        const eventType = el.type === 'checkbox' ? 'change' : 'change';
        el.addEventListener(eventType, () => {
            // Cancel previous timeout
            if (_saveSettingsTimeout) clearTimeout(_saveSettingsTimeout);
            // Debounce 500ms
            _saveSettingsTimeout = setTimeout(() => {
                saveSettings();
            }, 500);
        });
    }
});
```

---

### H6: Pas de Graceful Shutdown

**Fichier:** `llmServe/serve_llama.py`

**Ajouter après les imports:**
```python
import signal
import atexit

# Déclarer variable globale
proc = None

def cleanup():
    """Clean up child process on exit."""
    global proc
    if proc and proc.poll() is None:
        print("  [Info] Terminating llama.cpp server...")
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait()
        print("  [Info] Server terminated.")

# Register cleanup functions
atexit.register(cleanup)
signal.signal(signal.SIGTERM, lambda s, f: cleanup())
signal.signal(signal.SIGINT, lambda s, f: cleanup())
```

---

## 🟡 CORRECTIFS MEDIUM
## ═══════════════════════════════════════════════════════════════════════════

### M1: top_p Default Inconsistent

**Fichier:** `webui/app.js:52`

**Correction:**
```javascript
top_p: 0.95,  // Changé de 1.0 à 0.95
```

---

### M2: SSH Key Path Non-Vérifié

**Fichier:** `webui/server.py:37`

**Ajouter validation:**
```python
SSH_KEY = Path.home() / ".ssh" / "mirza_key"

if not SSH_KEY.exists():
    print(f"[Warning] SSH key not found: {SSH_KEY}")
    print("[Warning] SSH operations will fail. Run: ssh-keygen -t ed25519 -f {SSH_KEY}")
```

---

### M4: Presets Cleanup

**Fichier:** `webui/app.js:80-86`

**Simplifier - utiliser que les champs nécessaires:**
```javascript
presets: {
    'thinking-general': { temperature: 1.0, top_p: 0.95, top_k: 20, presence_penalty: 1.5 },
    // min_p et disable_thinking lus depuis UI/checkbox
},
```

---

### M6: detect_hardware() Cross-Platform

**Fichier:** `llmServe/serve_llama.py:24-35`

**Ajouter documentation:**
```python
def detect_hardware():
    """
    Detect hardware (Mac only for now).
    
    Note: Currently only supports Apple Silicon.
    Linux/Windows support pending.
    """
    # ... existing code ...
```

---

### M8: Python Variable Initialization

**Fichier:** `llmServe/serve_llama.py:456`

**Ajouter au début de main():
```python
proc = None  # Initialize before any reference
```

---

### M10: Supprimer Fichiers Dupliqués

**Action:** Supprimer scratch/ files
```bash
rm -rf scratch/serve_llama.py scratch/deploy_llama.py
```

**Alternative:** Créer symlinks
```bash
cd scratch
ln -s ../llmServe/serve_llama.py serve_llama.py
ln -s ../llmServe/deploy_llama.py deploy_llama.py
```

---

### M11: Request Size Limit

**Fichier:** `webui/server.py`

**Ajouter au début:**
```python
MAX_REQUEST_SIZE = 1024 * 1024  # 1MB
```

**Dans chaque POST handler:**
```python
if len(payload) > MAX_REQUEST_SIZE:
    return 413, {"error": "Request too large"}
```

---

### M12: HTTP Server Timeout

**Fichier:** `webui/server.py`

**Dans main():**
```python
server = http.server.HTTPServer((host, port), QuietHandler)
server.timeout = 30  # seconds
```

---

### M16: Logging Standardisé

**Créer module de logging commun:**
```python
# mirza/server_utils.py
import logging
import sys

def setup_logging(level=logging.INFO):
    logging.basicConfig(
        level=level,
        format='[%(asctime)s] %(levelname)s: %(message)s',
        datefmt='%H:%M:%S',
        stream=sys.stdout
    )
    return logging.getLogger('mirza')

log = setup_logging()

# Utiliser: log.info("message"), log.error("message")
```

---

## 🟢 CORRECTIFS LOW
## ═══════════════════════════════════════════════════════════════════════════

### L1: Ajouter Tests

**Structure:**
```
/tests
  __init__.py
  test_server.py
  test_api.py
  /fixtures
    sample_config.json
```

**Exemple test_server.py:**
```python
import pytest
import sys
sys.path.insert(0, '/path/to/webui')
from server import get_status

def test_status_cache():
    result = get_status()
    assert 'server_online' in result or 'error' in result
```

**Configuration pytest:**
```toml
# pyproject.toml
[tool.pytest.ini_options]
testpaths = ["tests"]
python_files = "test_*.py"
```

---

### L3: Magic Numbers → Constants

**Fichier:** `webui/app.js`

**Ajouter:**
```javascript
// Constants
const CACHE_DEBOUNCE_MS = 500;
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TOP_K = 20;
const DEFAULT_TEMPERATURE = 0.7;
```

---

### L5: Ajouter ESLint

**fichier:** `.eslintrc.json`
```json
{
  "env": {"browser": true, "es2021": true},
  "extends": "eslint:recommended",
  "parserOptions": {"ecmaVersion": "latest", "sourceType": "module"},
  "rules": {
    "no-unused-vars": "warn",
    "no-console": "warn"
  }
}
```

---

### L8: Versioning

**fichier:** `webui/__init__.py`
```python
__version__ = "0.1.0"
__author__ = "Mirza Team"

def get_version():
    return __version__
```

---

## 📋 Checklist Récapitulative

- [ ] C1: Supprimer commande shell (sudo_pwd)
- [ ] C2: Ajouter validation + size limit
- [ ] C3: Migration vers .env
- [ ] H1: Guard debug logs
- [ ] H2: Documenter limitation Qwen
- [ ] H3: Ajouter CACHE_TTL
- [ ] H4: Ajouter model formats
- [ ] H5: Debounce saveSettings
- [ ] H6: Graceful shutdown
- [ ] M1-M16: Apply medium fixes
- [ ] L1-L10: Apply low fixes

---

*Document généré le 16 avril 2026*
*Pour application: suivre l'ordre dans flawinmycode.md*