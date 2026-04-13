"""
Mirza AI — WebUI Backend Server
Sert l'interface web ET expose les commandes mirza en API REST.
Aucune dépendance externe — utilise uniquement la stdlib Python.
"""

import http.server
import json
import os
import subprocess
import socketserver
import urllib.parse
import mimetypes
import socket
import time
from pathlib import Path

# ═══════════════════════════════════════════════════════════════
# Configuration
# ═══════════════════════════════════════════════════════════════
WEBUI_DIR = Path(__file__).parent
REPO_DIR = WEBUI_DIR.parent
MIRZA_DIR = REPO_DIR / "mirza"
CONF_FILE = MIRZA_DIR / "mirza.conf"
MODELS_FILE = REPO_DIR / "mirzaServer" / "ai" / "models.json"

HOST_ENV = os.environ.get("MIRZA_HOST", "mirza.local")
USER_ENV = os.environ.get("MIRZA_USER", "")
MAC_ADDR = os.environ.get("MIRZA_MAC_ADRESS", "")
API_PORT = os.environ.get("MIRZA_API_PORT", "8080")
SSH_KEY = Path.home() / ".ssh" / "mirza_key"

# Remote PATH fix (ensures uv, brew, etc. are found in non-interactive shells)
PATH_FIX = "export PATH=$PATH:/opt/homebrew/bin:~/.cargo/bin:~/.local/bin;"
PORT = int(os.environ.get("MIRZA_WEBUI_PORT", "3333"))


def ssh_opts():
    opts = ["-o", "ConnectTimeout=5", "-o", "StrictHostKeyChecking=no", "-o", "BatchMode=yes"]
    if SSH_KEY.exists():
        opts += ["-i", str(SSH_KEY)]
    return opts


def ssh_target():
    return f"{USER_ENV}@{HOST_ENV}"


def remote_exec(cmd, timeout=15):
    """Execute a command on Mirza via SSH."""
    if not USER_ENV:
        return {"ok": False, "error": "MIRZA_USER non configuré"}
    try:
        remote_cmd = f"{PATH_FIX} {cmd}"
        result = subprocess.run(
            ["ssh"] + ssh_opts() + [ssh_target(), remote_cmd],
            capture_output=True, text=True, timeout=timeout
        )
        return {"ok": result.returncode == 0, "stdout": result.stdout.strip(), "stderr": result.stderr.strip()}
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": "Timeout SSH"}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def read_conf():
    """Parse mirza.conf into sections."""
    if not CONF_FILE.exists():
        return None
    sections = {}
    current = "general"
    for line in CONF_FILE.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("[") and line.endswith("]"):
            current = line[1:-1]
            sections.setdefault(current, {})
            continue
        if "=" in line:
            k, v = line.split("=", 1)
            sections.setdefault(current, {})[k.strip()] = v.strip()
    return sections


def read_models():
    """Read models.json catalog."""
    if not MODELS_FILE.exists():
        return None
    return json.loads(MODELS_FILE.read_text())


def check_ping(host, timeout=1):
    """Quick ping check."""
    try:
        result = subprocess.run(
            ["ping", "-c", "1", "-W", str(timeout), host],
            capture_output=True, timeout=timeout + 2
        )
        return result.returncode == 0
    except:
        return False


def check_port(host, port, timeout=2):
    """Check if a TCP port is open."""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        result = sock.connect_ex((host, int(port)))
        sock.close()
        return result == 0
    except:
        return False


# ═══════════════════════════════════════════════════════════════
# API Router
# ═══════════════════════════════════════════════════════════════

def handle_api(path, method, body=None):
    """Route API requests and return (status_code, response_dict)."""

    # ── Status ──────────────────────────────────────────
    if path == "/api/status" and method == "GET":
        online = check_ping(HOST_ENV)
        llm_api = check_port(HOST_ENV, API_PORT) if online else False
        grafana = check_port(HOST_ENV, 3000) if online else False

        active_model = None
        if llm_api:
            try:
                import urllib.request
                req = urllib.request.urlopen(f"http://{HOST_ENV}:{API_PORT}/v1/models", timeout=3)
                data = json.loads(req.read())
                if data.get("data"):
                    active_model = data["data"][0].get("id", "unknown")
            except:
                pass

        conf = read_conf()
        hardware = {}
        if conf:
            hw = conf.get("hardware", {})
            hardware = {
                "chip": hw.get("chip", "?"),
                "cpu_cores": hw.get("cpu_cores_total", "?"),
                "gpu_cores": hw.get("gpu_cores", "?"),
                "ram_gb": hw.get("ram_gb", "?"),
            }
            srv = conf.get("server", {})
            hardware["hostname"] = srv.get("hostname", HOST_ENV)
            hardware["ip"] = srv.get("ip", HOST_ENV)

        return 200, {
            "server_online": online,
            "llm_api": llm_api,
            "grafana": grafana,
            "active_model": active_model,
            "host": HOST_ENV,
            "api_port": API_PORT,
            "hardware": hardware,
            "config_available": conf is not None,
        }

    # ── Config ──────────────────────────────────────────
    if path == "/api/config" and method == "GET":
        conf = read_conf()
        if conf:
            return 200, {"config": conf}
        return 404, {"error": "mirza.conf not found. Run: mirza config --refresh"}

    if path == "/api/config/refresh" and method == "POST":
        gen_script = MIRZA_DIR / "gen_config.sh"
        if gen_script.exists():
            try:
                result = subprocess.run(
                    ["bash", str(gen_script)],
                    capture_output=True, text=True, timeout=30,
                    env={**os.environ}
                )
                if result.returncode == 0:
                    conf = read_conf()
                    return 200, {"ok": True, "config": conf}
                return 500, {"ok": False, "error": result.stderr[:500]}
            except subprocess.TimeoutExpired:
                return 500, {"ok": False, "error": "Timeout lors de la génération"}
        return 404, {"error": "gen_config.sh not found"}

    # ── Models catalog ──────────────────────────────────
    if path == "/api/models" and method == "GET":
        data = read_models()
        if data:
            return 200, data
        return 404, {"error": "models.json not found"}

    # ── Server controls ─────────────────────────────────
    if path == "/api/server/wake" and method == "POST":
        if not MAC_ADDR:
            return 400, {"ok": False, "error": "MIRZA_MAC_ADRESS non configuré"}
        try:
            result = subprocess.run(["wakeonlan", MAC_ADDR], capture_output=True, text=True, timeout=5)
            return 200, {"ok": result.returncode == 0, "output": result.stdout.strip()}
        except FileNotFoundError:
            return 500, {"ok": False, "error": "wakeonlan non installé (apt install wakeonlan)"}

    if path == "/api/server/sleep" and method == "POST":
        sudo_pwd = body.get("sudoAsk", "") if isinstance(body, dict) else ""
        cmd = f'echo "{sudo_pwd}" | sudo -S pmset sleepnow' if sudo_pwd else "sudo pmset sleepnow"
        r = remote_exec(cmd)
        return 200, r

    if path == "/api/server/reboot" and method == "POST":
        sudo_pwd = body.get("sudoAsk", "") if isinstance(body, dict) else ""
        cmd = f'echo "{sudo_pwd}" | sudo -S shutdown -r now' if sudo_pwd else "sudo shutdown -r now"
        r = remote_exec(cmd)
        return 200, r

    # ── LLM (Llama-CPP) server controls ─────────────────────────────
    if path == "/api/llm/stop" and method == "POST":
        # Use a more robust kill command
        cmd = "pkill -f 'llama_cpp.server' || true"
        r = remote_exec(cmd)
        return 200, {"ok": True, "message": "Server stopped", "detail": r}

    if path == "/api/llm/download-status" and method == "GET":
        r = remote_exec("cat /tmp/mirza-download.progress 2>/dev/null || echo 0")
        prog = r.get("stdout", "0").strip()
        return 200, {"progress": prog}

    if path == "/api/llm/serve" and method == "POST":
        model_path = (body or {}).get("model", "")
        if not model_path:
            # Fallback: find the active model if not specified
            r = remote_exec("cat ~/llmServe/active_model.json 2>/dev/null")
            try:
                active = json.loads(r.get("stdout", "{}"))
                model_path = active.get("path", "")
            except: pass
        
        if not model_path:
            return 400, {"ok": False, "error": "No model specified and no active model found."}

        perf = (body or {}).get("perf", {})
        kv_q  = perf.get("kv_q", "q8_0")   # Default: Q8_0 (best for Apple Silicon)
        ctx   = int(perf.get("ctx", 8192))
        fa    = "--flash_attn" if perf.get("flash_attn", True) else ""
        
        server_cmd = f"uv run python serve_llama.py --model '{model_path}' --port {API_PORT} --kv_q {kv_q} --ctx {ctx} {fa}"
        
        # Kill any previous server first
        remote_exec("pkill -f 'llama_cpp.server' 2>/dev/null || true")
        
        cmd = f"cd ~/llmServe && nohup {server_cmd} > /tmp/mirza-llm.log 2>&1 &"
        r = remote_exec(cmd)
        return 200, {"ok": True, "message": "Starting server...", "detail": r}

    if path == "/api/llm/deploy" and method == "POST":
        repo     = (body or {}).get("hf_repo", "")
        filename = (body or {}).get("filename", "")
        hf_token = (body or {}).get("hf_token", "")
        if not repo:
            return 400, {"ok": False, "error": "No repository specified"}
        
        # Build command, add token arg if provided
        token_arg = f"--token '{hf_token}'" if hf_token else ""
        # Clear previous log and run in background
        deploy_cmd = f"uv run python deploy_llama.py '{repo}' '{filename}' {token_arg}"
        cmd = f"rm -f /tmp/mirza-deploy.log && touch /tmp/mirza-deploy.log && cd ~/llmServe && nohup {deploy_cmd} > /tmp/mirza-deploy.log 2>&1 &"
        
        r = remote_exec(cmd)
        return 200, {
            "ok": r.get("ok", False), 
            "message": f"Deployment started for {repo}", 
            "detail": r
        }

    if path == "/api/llm/deploy-logs" and method == "GET":
        # Tail the deployment specific log
        cmd = "tail -100 /tmp/mirza-deploy.log 2>/dev/null || echo 'No deployment logs available yet'"
        r = remote_exec(cmd)
        return 200, {"logs": r.get("stdout", "")}

    if path == "/api/llm/remove" and method == "POST":
        filename = (body or {}).get("filename", "")
        if not filename:
            return 400, {"ok": False, "error": "No file specified"}
        # Basic security: ensure no path traversal
        filename = os.path.basename(filename)
        r = remote_exec(f"rm -f ~/mirza-models/{filename}")
        return 200, {"ok": r.get("ok", False), "message": f"Suppression de {filename}", "detail": r}

    if path == "/api/llm/logs" and method == "GET":
        cmd = "echo \"=== LOGS LLM (Remote Time: $(date '+%H:%M:%S')) ===\" && echo \"File: /tmp/mirza-llm.log\" && echo \"--------------------------------------------------\" && tail -100 /tmp/mirza-llm.log 2>/dev/null || echo 'Pas de logs disponibles'"
        r = remote_exec(cmd)
        return 200, {"logs": r.get("stdout", "")}

    if path == "/api/llm/installed" and method == "GET":
        # Check ~/mirza-models directory
        cmd = "ls -1 ~/mirza-models/ 2>/dev/null | grep '.gguf$'"
        r = remote_exec(cmd)
        installed = []
        if r.get("ok") and r.get("stdout"):
            for line in r["stdout"].split("\n"):
                if line.strip():
                    installed.append(line.strip())
        return 200, {"installed": installed}

    print(f"\n[DEBUG] 404 Triggered on path: '{path}' method: '{method}'")
    return 404, {"error": f"Route inconnue: {method} {path}"}


# ═══════════════════════════════════════════════════════════════
# HTTP Handler
# ═══════════════════════════════════════════════════════════════

class MirzaHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEBUI_DIR), **kwargs)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path.startswith("/api/"):
            self._handle_api(parsed.path, "GET")
        else:
            super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path.startswith("/api/"):
            body = None
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length:
                raw = self.rfile.read(content_length)
                try:
                    body = json.loads(raw)
                except:
                    body = {}
            self._handle_api(parsed.path, "POST", body)
        else:
            self.send_error(405, "Method Not Allowed")

    def _handle_api(self, path, method, body=None):
        status, data = handle_api(path, method, body)
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode())

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def log_message(self, format, *args):
        if "/api/" in str(args[0]):
            print(f"  \033[0;36m[API]\033[0m {args[0]}")
        elif not any(ext in str(args[0]) for ext in [".css", ".js", ".png", ".ico", ".woff"]):
            print(f"  \033[2m[GET]\033[0m {args[0]}")


# ═══════════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print()
    print("  \u2554" + "\u2550"*42 + "\u2557")
    print("  \u2551    Mirza AI \u2014 Station Control Panel     \u2551")
    print("  \u255a" + "\u2550"*42 + "\u255d")
    print()
    print(f"  Interface:  \033[1;33mhttp://localhost:{PORT}\033[0m")
    print(f"  Mirza:      \033[2m{HOST_ENV}:{API_PORT}\033[0m")
    print(f"  Config:     \033[2m{'✓' if CONF_FILE.exists() else '✗'} {CONF_FILE}\033[0m")
    print(f"  Modèles:    \033[2m{'✓' if MODELS_FILE.exists() else '✗'} {MODELS_FILE}\033[0m")
    print()
    print("  \033[2mCtrl+C pour arrêter\033[0m")
    print()

    with socketserver.TCPServer(("", PORT), MirzaHandler) as httpd:
        httpd.allow_reuse_address = True
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n\033[2m  Arrêt du serveur.\033[0m")
