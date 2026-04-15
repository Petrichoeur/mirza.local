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
import time
import threading
import re
from datetime import datetime
from pathlib import Path

# API Cache to prevent flooding
_STATUS_CACHE = {"time": 0, "data": None}
_CACHE_LOCK = threading.Lock()

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
    opts = [
        "-o",
        "ConnectTimeout=5",
        "-o",
        "StrictHostKeyChecking=no",
        "-o",
        "BatchMode=yes",
    ]
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
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        return {
            "ok": result.returncode == 0,
            "stdout": result.stdout.strip(),
            "stderr": result.stderr.strip(),
        }
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
            capture_output=True,
            timeout=timeout + 2,
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


def get_vram_metrics():
    """Extract VRAM/Unified Memory metrics from mirza-llm logs on the station."""
    cmd = "cat /tmp/mirza-llm.log 2>/dev/null | tail -500"
    r = remote_exec(cmd)

    metrics = {
        "weights": 0.0,
        "kv": 0.0,
        "compute": 0.0,
        "os_ram_used": 0.0,
        "total": 0.0,
        "metal_active": False,
    }

    r_ram = remote_exec("sysctl -n hw.memsize 2>/dev/null")
    if r_ram.get("ok"):
        total_bytes = int(r_ram.get("stdout", 0))
        metrics["total_ram_gb"] = round(total_bytes / (1024**3), 1)

    r_used = remote_exec("vm_stat | grep '^Pages free:' | awk '{print $3}' | tr -d '.'")
    r_active = remote_exec(
        "vm_stat | grep '^Pages active:' | awk '{print $3}' | tr -d '.'"
    )
    r_wired = remote_exec(
        "vm_stat | grep '^Pages wired down:' | awk '{print $4}' | tr -d '.'"
    )

    if r_used.get("ok") and r_active.get("ok") and r_wired.get("ok"):
        page_size = 16384
        try:
            free_pages = int(r_used.get("stdout", "0").strip())
            active_pages = int(r_active.get("stdout", "0").strip())
            wired_pages = int(r_wired.get("stdout", "0").strip())
            used_bytes = (active_pages + wired_pages) * page_size
            metrics["total_ram_used"] = round(used_bytes / (1024**3), 2)
            metrics["os_ram_used"] = round(used_bytes / (1024**3), 2)
        except (ValueError, TypeError):
            pass

    if not r.get("ok") or not r.get("stdout"):
        return metrics

    content = r["stdout"]

    # Check for Metal GPU
    if "MTL0" in content or "Apple" in content:
        metrics["metal_active"] = True

    # Parse all lines - more flexible regex
    for line in content.splitlines():
        line = line.strip()

        # Weights/Model: "load_tensors: MTL0 model buffer size = X.XX MiB"
        m = re.search(
            r"(?:load_tensors:[\s]*)?MTL0[_ ]?model[_ ]?buffer[_ ]?size\s*[:=]\s*([\d\.]+)",
            line,
            re.IGNORECASE,
        )
        if m:
            val = float(m.group(1))
            if val > 100:
                val = val / 1024
            if val > metrics["weights"]:
                metrics["weights"] = round(val, 2)

        # KV Cache: "MTL0 KV buffer size = X.XX MiB"
        m = re.search(
            r"MTL0[_ ]?KV[_ ]?buffer[_ ]?size\s*[:=]\s*([\d\.]+)",
            line,
            re.IGNORECASE,
        )
        if m:
            val = float(m.group(1))
            if val > 100:
                val = val / 1024
            if val > metrics["kv"]:
                metrics["kv"] = round(val, 2)

        # Compute: "MTL0 compute buffer size = X.XX MiB"
        m = re.search(
            r"MTL0[_ ]?compute[_ ]?buffer[_ ]?size\s*[:=]\s*([\d\.]+)",
            line,
            re.IGNORECASE,
        )
        if m:
            val = float(m.group(1))
            if val > 100:
                val = val / 1024
            if val > metrics["compute"]:
                metrics["compute"] = round(val, 2)

    metrics["total"] = round(metrics["weights"] + metrics["kv"] + metrics["compute"], 2)
    return metrics


def handle_api(path, method, body=None):
    """Route API requests and return (status_code, response_dict)."""

    if path == "/api/status" and method == "GET":
        global _STATUS_CACHE
        with _CACHE_LOCK:
            now = time.time()
            if _STATUS_CACHE["data"] and now - _STATUS_CACHE["time"] < 2.0:
                return 200, _STATUS_CACHE["data"]

        online = check_ping(HOST_ENV)

        # Robust status check via SSH (bypasses network/firewall issues)
        llm_api = False
        grafana = False
        active_model = None

        if online:
            # Batch remote checks with robust separator
            # - pgrep -f "llama_cpp.server"
            # - pgrep -f "grafana"
            # - cat ~/llmServe/active_model.json
            remote_check = remote_exec(
                "pgrep -f 'llama_cpp.server' || echo '0'; echo '###'; pgrep -f 'grafana' || echo '0'; echo '###'; cat ~/llmServe/active_model.json 2>/dev/null || echo '{}'"
            )
            if remote_check.get("ok") and remote_check.get("stdout"):
                sections = remote_check["stdout"].split("###")
                if len(sections) >= 1:
                    llm_api = sections[0].strip() != "0"
                if len(sections) >= 2:
                    grafana = sections[1].strip() != "0"
                if len(sections) >= 3:
                    try:
                        state_data = json.loads(sections[2].strip() or "{}")
                        active_model = (
                            state_data.get(
                                "repo", state_data.get("file", "Active Session")
                            )
                            if llm_api
                            else None
                        )
                    except:
                        active_model = "Active Session" if llm_api else None

                # Ultimate fallback
                if llm_api and not active_model:
                    active_model = "Active Session"

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

        vram = get_vram_metrics() if llm_api else None

        result = {
            "server_online": online,
            "llm_api": llm_api,
            "grafana": grafana,
            "active_model": active_model,
            "host": HOST_ENV,
            "api_port": API_PORT,
            "hardware": hardware,
            "config_available": conf is not None,
            "vram_metrics": vram,
        }

        with _CACHE_LOCK:
            _STATUS_CACHE = {"time": time.time(), "data": result}

        return 200, result

    # ── Chat Proxy (Advanced) ───────────────────────────
    if path == "/api/chat" and method == "POST":
        import http.client

        try:
            # Check if we should use localhost (SSH tunnel) or the remote IP
            # We prefer localhost if on a laptop to avoid latency/timeout issues
            target_host = (
                "127.0.0.1"
                if check_port("127.0.0.1", API_PORT, timeout=0.1)
                else HOST_ENV
            )

            conn = http.client.HTTPConnection(target_host, int(API_PORT), timeout=180)
            payload = json.dumps(body).encode()
            conn.request(
                "POST",
                "/v1/chat/completions",
                body=payload,
                headers={
                    "Content-Type": "application/json",
                    "Connection": "keep-alive",
                },
            )
            resp = conn.getresponse()
            return resp.status, resp
        except Exception as e:
            return 502, {"ok": False, "error": f"Proxy error: {str(e)}"}

    # ── Config ──────────────────────────────────────────
    if path == "/api/config" and method == "GET":
        conf = read_conf()
        if conf:
            return 200, {"config": conf}
        return 404, {"error": "mirza.conf not found. Run: mirza config --refresh"}

    if path == "/api/llm/monitoring" and method == "GET":
        # Discover Grafana dashboard UID and construct URL
        # 1. Search for dashboards with "Mirza"
        r_search = remote_exec(
            "curl -s 'http://localhost:3000/api/search?query=Mirza%20Monitor'"
        )
        uid = "ad5vxgh"  # Fallback to known default
        slug = ""

        if r_search.get("ok") and r_search.get("stdout"):
            try:
                results = json.loads(r_search["stdout"])
                if results and isinstance(results, list):
                    # Prefer "Monitor Lite" if it exists
                    lite = next(
                        (d for d in results if "Monitor Lite" in d.get("title", "")),
                        results[0],
                    )
                    uid = lite.get("uid", uid)
                    slug = lite.get("url", "").split("/")[-1]
            except Exception as e:
                print(f"[Monitoring] Search error: {e}")

        # Construct full URL using CURRENT station Host/IP
        host = HOST_ENV or "mirza.local"
        # Always return the full path to avoid iframe issues
        url = f"http://{host}:3000/d/{uid}/{slug}?orgId=1&kiosk"
        return 200, {"ok": True, "url": url, "uid": uid}
        gen_script = MIRZA_DIR / "gen_config.sh"
        if gen_script.exists():
            try:
                result = subprocess.run(
                    ["bash", str(gen_script)],
                    capture_output=True,
                    text=True,
                    timeout=30,
                    env={**os.environ},
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
            result = subprocess.run(
                ["wakeonlan", MAC_ADDR], capture_output=True, text=True, timeout=5
            )
            return 200, {"ok": result.returncode == 0, "output": result.stdout.strip()}
        except FileNotFoundError:
            return 500, {
                "ok": False,
                "error": "wakeonlan non installé (apt install wakeonlan)",
            }

    if path == "/api/server/sleep" and method == "POST":
        sudo_pwd = body.get("sudoAsk", "") if isinstance(body, dict) else ""
        cmd = (
            f'echo "{sudo_pwd}" | sudo -S pmset sleepnow'
            if sudo_pwd
            else "sudo pmset sleepnow"
        )
        r = remote_exec(cmd)
        return 200, r

    if path == "/api/server/reboot" and method == "POST":
        sudo_pwd = body.get("sudoAsk", "") if isinstance(body, dict) else ""
        cmd = (
            f'echo "{sudo_pwd}" | sudo -S shutdown -r now'
            if sudo_pwd
            else "sudo shutdown -r now"
        )
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
            except:
                pass

        if not model_path:
            return 400, {
                "ok": False,
                "error": "No model specified and no active model found.",
            }

        # Fuzzy resolution: if it's an org/repo ID, try to find a matching file in ~/mirza-models/
        if (
            "/" in model_path
            and not model_path.startswith("/")
            and not model_path.startswith("~")
        ):
            repo_name = (
                model_path.split("/")[-1]
                .replace("-GGUF", "")
                .replace("-gguf", "")
                .lower()
            )
            # Try to find a file that contains the repo name
            res = remote_exec(
                f"ls -1 ~/mirza-models/ | grep -i '{repo_name}' | head -n 1"
            )
            if res.get("ok") and res.get("stdout"):
                model_path = res["stdout"].strip()
                # Continue below to prepend the path

        # If it's just a filename (no slash and no direct path), assume it's in ~/mirza-models/
        if (
            "/" not in model_path
            and not model_path.startswith("/")
            and not model_path.startswith("~")
        ):
            model_path = f"~/mirza-models/{model_path}"

        perf = (body or {}).get("perf", {})
        kv_q = perf.get("kv_q", "q8_0")  # Default: Q8_0 (best for Apple Silicon)
        ctx = int(perf.get("ctx", 8192))
        fa = "--flash_attn" if perf.get("flash_attn", True) else ""
        mlock = "--mlock" if perf.get("mlock", False) else ""
        warmup = "--warmup" if perf.get("warmup", False) else ""
        chat_fmt = (
            f"--chat_format {perf.get('chat_format')}"
            if perf.get("chat_format")
            else ""
        )

        # Tuning options
        do_tune = perf.get("tune", False)
        tune_trials = int(perf.get("trials", 25))
        tune_metric = perf.get("metric", "tg")

        if do_tune:
            tune_cmd = f"uv run python serve_llama.py --tune --trials {tune_trials} --metric {tune_metric} --model '{model_path}'"
            r = remote_exec(f"cd ~/llmServe && {tune_cmd}")
            return 200, {
                "ok": True,
                "message": f"Auto-tuning ({tune_trials} trials, metric: {tune_metric})...",
                "detail": r,
            }

        server_cmd = f"uv run python serve_llama.py --model '{model_path}' --port {API_PORT} --kv_q {kv_q} --ctx {ctx} {fa} {mlock} {warmup} {chat_fmt}"

        # Kill any previous server first
        remote_exec("pkill -f 'llama_cpp.server' 2>/dev/null || true")

        cmd = f"cd ~/llmServe && nohup {server_cmd} > /tmp/mirza-llm.log 2>&1 &"
        r = remote_exec(cmd)
        return 200, {"ok": True, "message": "Starting server...", "detail": r}

    # Route deprecated

    if path == "/api/llm/deploy" and method == "POST":
        repo = (body or {}).get("hf_repo", "")
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
            "detail": r,
        }

    if path == "/api/llm/deploy-logs" and method == "GET":
        # Tail the deployment specific log
        cmd = "tail -100 /tmp/mirza-deploy.log 2>/dev/null || echo 'No deployment logs available yet'"
        r = remote_exec(cmd)
        return 200, {"logs": r.get("stdout", "")}

    if path.startswith("/api/llm/suggest") and method == "GET":
        from urllib.parse import parse_qs, urlparse

        parsed = urlparse(path)
        query = ""
        if "?" in path:
            path_only, query = path.split("?", 1)
        else:
            path_only = path

        qs = parse_qs(query)
        model_name = qs.get("model", [""])[0]

        # Get host Hardware info (Dynamic Detection)
        # - sysctl hw.memsize (Total RAM)
        # - vm_stat (Free RAM)
        # - machdep.cpu.brand_string (M1/M2/M3/M4)
        # - hw.perflevel0.logicalcpu (Performance Cores)
        cmd = "sysctl -n hw.memsize; vm_stat; sysctl -n machdep.cpu.brand_string; sysctl -n hw.perflevel0.logicalcpu"
        r_hw = remote_exec(cmd)

        total_ram_gb = 24.0
        free_ram_gb = 16.0
        chip_brand = "Apple M-series"
        p_cores = 4
        batch = 2048
        ubatch = 512

        if r_hw.get("ok") and r_hw.get("stdout"):
            parts = r_hw["stdout"].split("\n")
            if len(parts) >= 1 and parts[0].isdigit():
                total_ram_gb = int(parts[0]) / (1024**3)

            # vm_stat remains complex to parse in one line, but we have the raw stdout
            stdout = r_hw["stdout"]
            m_free = re.search(r"Pages free:\s+(\d+)", stdout)
            m_spec = re.search(r"Pages speculative:\s+(\d+)", stdout)
            if m_free:
                free_pages = int(m_free.group(1))
                if m_spec:
                    free_pages += int(m_spec.group(1))
                free_ram_gb = (free_pages * 4096) / (1024**3)

            # Chip Brand
            if len(parts) >= 3:
                chip_brand = parts[
                    -2
                ].strip()  # brand string is usually towards the end
                if not chip_brand or chip_brand.isdigit():
                    chip_brand = "Apple M-series"

            # Performance Cores
            if len(parts) >= 4 and parts[-1].strip().isdigit():
                p_cores = int(parts[-1].strip())

            # Specific optimizations based on generations
            if "M3" in chip_brand or "M4" in chip_brand:
                batch = 4096
                ubatch = 1024

        # Estimate model size
        model_size_gb = 5.0
        if model_name:
            model_path = f"~/mirza-models/{model_name}"
            r_size = remote_exec(f"ls -l {model_path} | awk '{{print $5}}'")
            if r_size.get("ok") and r_size.get("stdout") and r_size["stdout"].isdigit():
                model_size_gb = int(r_size["stdout"]) / (1024**3)

        available_for_kv = max(0.5, free_ram_gb - 2.0)
        ctx_options = [2048, 4096, 8192, 16384, 32768, 65536, 128000]
        rec_ctx = 8192
        for c in ctx_options:
            if (c / 8192) * 0.15 < available_for_kv:
                rec_ctx = c
            else:
                break

        result = {
            "n_ctx": rec_ctx,
            "n_batch": batch,
            "n_ubatch": ubatch,
            "n_threads": p_cores,
            "mlock": True,
            "flash_attn": True,
            "kv_q": "q8_0",
            "message": f"Optimal pour {chip_brand} ({total_ram_gb:.0f}GB RAM)",
        }
        return 200, result

    if path == "/api/llm/remove" and method == "POST":
        filename = (body or {}).get("filename", "")
        if not filename:
            return 400, {"ok": False, "error": "No file specified"}
        # Basic security: ensure no path traversal
        filename = os.path.basename(filename)
        r = remote_exec(f"rm -f ~/mirza-models/{filename}")
        return 200, {
            "ok": r.get("ok", False),
            "message": f"Suppression de {filename}",
            "detail": r,
        }

    if path == "/api/llm/logs" and method == "GET":
        # Try multiple log file locations with -h to suppress filename prefix
        cmd = """tail -h -100 /tmp/mirza-llm.stdout.log /tmp/mirza-llm.stderr.log /tmp/mirza-llm.log 2>/dev/null || echo 'Pas de logs disponibles'"""
        r = remote_exec(cmd)
        logs = r.get("stdout", "").strip()
        if not logs or logs == "Pas de logs disponibles":
            # Fallback: try direct cat
            cmd2 = """cat /tmp/mirza-llm.log 2>/dev/null | tail -100"""
            r2 = remote_exec(cmd2)
            logs = r2.get("stdout", "").strip() or logs
        return 200, {"logs": logs}

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
            content_length = int(self.headers.get("Content-Length", 0))
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

        # Special case for proxied response (from http.client.HTTPResponse)
        if hasattr(data, "read"):
            resp = data
            self.send_response(status)
            for k, v in resp.getheaders():
                if k.lower() not in [
                    "content-length",
                    "transfer-encoding",
                    "access-control-allow-origin",
                ]:
                    self.send_header(k, v)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            try:
                # Use a small buffer and flush frequently for smooth streaming
                while True:
                    chunk = resp.read(1024)  # Smaller chunks for better responsiveness
                    if not chunk:
                        break
                    try:
                        self.wfile.write(chunk)
                        self.wfile.flush()
                    except (BrokenPipeError, ConnectionResetError):
                        # Client disconnected, stop proxying silently
                        break
            except Exception as e:
                print(f"  \033[0;31m[PROXY ERROR]\033[0m {e}")
            finally:
                resp.close()
            return

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
        if args and len(args) > 0 and isinstance(args[0], str):
            ts = datetime.now().strftime("%H:%M:%S")
            print(f"  \033[2m[{ts}]\033[0m \033[0;36m[API]\033[0m {args[0]}")
        elif not any(
            ext in str(args[0]) for ext in [".css", ".js", ".png", ".ico", ".woff"]
        ):
            print(f"  \033[2m[GET]\033[0m {args[0]}")


# ═══════════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print()
    print("  \u2554" + "\u2550" * 42 + "\u2557")
    print("  \u2551    Mirza AI \u2014 Station Control Panel     \u2551")
    print("  \u255a" + "\u2550" * 42 + "\u255d")
    print()
    print(f"  Interface:  \033[1;33mhttp://localhost:{PORT}\033[0m")
    print(f"  Mirza:      \033[2m{HOST_ENV}:{API_PORT}\033[0m")
    print(
        f"  Config:     \033[2m{'✓' if CONF_FILE.exists() else '✗'} {CONF_FILE}\033[0m"
    )
    print(
        f"  Modèles:    \033[2m{'✓' if MODELS_FILE.exists() else '✗'} {MODELS_FILE}\033[0m"
    )
    print()
    print("  \033[2mCtrl+C pour arrêter\033[0m")
    print()

    class ThreadedTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
        allow_reuse_address = True

    try:
        with ThreadedTCPServer(("", PORT), MirzaHandler) as httpd:
            try:
                httpd.serve_forever()
            except KeyboardInterrupt:
                print("\n\033[2m  Arrêt du serveur.\033[0m")
    except OSError as e:
        if e.errno == 98:
            print(f"\n  \033[1;31m[ERREUR]\033[0m Le port {PORT} est déjà utilisé.")
            print(f"  Une autre instance de Mirza WebUI est probablement déjà lancée.")
            print(
                f"  Utilisez: \033[1m'lsof -i :{PORT}'\033[0m pour trouver le processus et le tuer."
            )
        else:
            print(f"\n  \033[1;31m[ERREUR]\033[0m Impossible de lancer le serveur: {e}")
