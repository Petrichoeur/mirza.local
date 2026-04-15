"""
Mirza — Llama.cpp Python Server Wrapper
Wraps llama_cpp.server with advanced inference configuration flags.
Includes automatic parameter tuning via llama-optimus.
"""

import argparse
import os
import sys
import json
import subprocess
import time
from pathlib import Path
import urllib.request

# KV cache type IDs for llama_cpp.server --type_k / --type_v
KV_QUANT_MAP = {
    "f16": "1",  # GGML_TYPE_F16 = 1
    "q8_0": "8",  # GGML_TYPE_Q8_0 = 8
    "q4_0": "4",  # GGML_TYPE_Q4_0 = 4
}


def detect_hardware():
    """Detect Apple Silicon generation with dynamic resource calculation."""
    info = {
        "chip": "M-series",
        "p_cores": 4,  # Performance cores
        "e_cores": 0,  # Efficiency cores
        "gpu_cores": 8,
        "total_cores": 4,
        "batch": 512,
        "ubatch": 256,
    }
    try:
        brand = subprocess.check_output(
            ["sysctl", "-n", "machdep.cpu.brand_string"], text=True
        ).strip()
        info["chip"] = brand

        # Performance cores
        p_cores = subprocess.check_output(
            ["sysctl", "-n", "hw.perflevel0.logicalcpu"], text=True
        ).strip()
        if p_cores.isdigit():
            info["p_cores"] = int(p_cores)

        # Efficiency cores (if available)
        try:
            e_cores = subprocess.check_output(
                ["sysctl", "-n", "hw.perflevel1.logicalcpu"], text=True
            ).strip()
            if e_cores.isdigit():
                info["e_cores"] = int(e_cores)
        except:
            info["e_cores"] = 0

        info["total_cores"] = info["p_cores"] + info["e_cores"]

        # GPU cores detection from brand string
        if "M1 " in brand and "Pro" in brand:
            info["gpu_cores"] = 14
        elif "M1 " in brand and "Max" in brand:
            info["gpu_cores"] = 24
        elif "M1 " in brand and "Ultra" in brand:
            info["gpu_cores"] = 32
        elif "M1 " in brand:
            info["gpu_cores"] = 8
        elif "M2 " in brand and "Pro" in brand:
            info["gpu_cores"] = 16
        elif "M2 " in brand and "Max" in brand:
            info["gpu_cores"] = 32
        elif "M2 " in brand and "Ultra" in brand:
            info["gpu_cores"] = 64
        elif "M2 " in brand:
            info["gpu_cores"] = 10
        elif "M3 " in brand and "Pro" in brand:
            info["gpu_cores"] = 18
        elif "M3 " in brand and "Max" in brand:
            info["gpu_cores"] = 30
        elif "M3 " in brand and "Ultra" in brand:
            info["gpu_cores"] = 80
        elif "M3 " in brand:
            info["gpu_cores"] = 10
        elif "M4 " in brand and "Pro" in brand:
            info["gpu_cores"] = 16
        elif "M4 " in brand and "Max" in brand:
            info["gpu_cores"] = 40
        elif "M4 " in brand and "Ultra" in brand:
            info["gpu_cores"] = 80
        elif "M4 " in brand:
            info["gpu_cores"] = 10
        elif "M5 " in brand and "Pro" in brand:
            info["gpu_cores"] = 20
        elif "M5 " in brand and "Max" in brand:
            info["gpu_cores"] = 48
        elif "M5 " in brand and "Ultra" in brand:
            info["gpu_cores"] = 96
        elif "M5 " in brand:
            info["gpu_cores"] = 12
        else:
            # For unknown M chips: estimate from CPU cores
            # Typically GPU cores ≈ 2x performance cores for Apple Silicon
            info["gpu_cores"] = max(8, info["p_cores"] * 2)

    except:
        pass
    return info


def calculate_optimal_params(hw):
    """
    Calculate optimal llama.cpp parameters based on hardware.
    Uses heuristics that scale with available resources for future M chips.
    """
    p_cores = hw.get("p_cores", 4)
    e_cores = hw.get("e_cores", 0)
    gpu_cores = hw.get("gpu_cores", 8)
    total_cores = p_cores + e_cores

    # n_ubatch: Scales with GPU cores - more aggressive for better GPU utilization
    # Heuristic: 256 per GPU core, minimum 512, max 2048
    ubatch = min(2048, max(512, gpu_cores * 256))

    # n_batch: 2x to 4x n_ubatch for prompt processing - use higher multiplier
    batch = min(4096, ubatch * 4)

    # n_threads: Leave 1-2 cores for system, use performance cores
    n_threads = max(1, p_cores - 1)

    # n_threads_batch: Can use more threads since mostly GPU-bound
    # Use performance cores + efficiency cores
    n_threads_batch = min(total_cores - 1, p_cores + e_cores)

    return {
        "n_batch": batch,
        "n_ubatch": ubatch,
        "n_threads": n_threads,
        "n_threads_batch": n_threads_batch,
    }


def get_env_overrides():
    """
    Get parameter overrides from environment variables.
    Format: MIRZA_N_UBATCH=2048, MIRZA_N_BATCH=4096, etc.
    """
    overrides = {}
    env_mappings = {
        "MIRZA_N_BATCH": "n_batch",
        "MIRZA_N_UBATCH": "n_ubatch",
        "MIRZA_N_THREADS": "n_threads",
        "MIRZA_N_THREADS_BATCH": "n_threads_batch",
    }

    for env_var, param_name in env_mappings.items():
        value = os.environ.get(env_var)
        if value is not None:
            try:
                overrides[param_name] = int(value)
            except ValueError:
                pass

    return overrides


def check_server_running(port=8080):
    """Check if llama.cpp server is running on port."""
    try:
        with urllib.request.urlopen(f"http://localhost:{port}/v1/models", timeout=2):
            return True
    except:
        return False


def run_tuning(args):
    """Run llama-optimus to find optimal parameters."""
    import tempfile
    import shutil

    model_path = os.path.expanduser(args.model)

    if not os.path.exists(model_path):
        print(f"[Mirza] Error: model file not found: {model_path}", file=sys.stderr)
        sys.exit(1)

    print(f"[Mirza] Auto-tuning: {os.path.basename(model_path)}")
    print(f"  Trials  : {args.trials}")
    print(f"  Metric : {args.metric}")
    print(f"")

    # Note: llama-optimus uses llama-bench, not the running server
    # Server can be running or not - doesn't matter

    llama_bin = shutil.which("llama-cli") or shutil.which("llama-bench")
    if not llama_bin:
        for path in [
            os.path.expanduser("~/llmServe/.venv/bin/llama-cli"),
            os.path.expanduser("~/llmServe/.venv/bin/llama-bench"),
            "/usr/local/bin/llama-cli",
            "/opt/homebrew/bin/llama-cli",
        ]:
            if os.path.exists(path):
                llama_bin = path
                break

    if not llama_bin:
        print(
            f"[Mirza] Error: llama-cli not found. Install llama-optimus:",
            file=sys.stderr,
        )
        print(f"  cd ~/llmServe && uv sync --extra tune", file=sys.stderr)
        sys.exit(1)

    tuned_params_file = os.path.expanduser("~/llmServe/tuned_params.json")

    cmd = [
        "llama-optimus",
        "--llama-bin",
        llama_bin,
        "--model",
        model_path,
        "--trials",
        str(args.trials),
        "-r",
        "2",
        "--metric",
        args.metric,
    ]

    print(f"[Mirza] Running llama-optimus...")
    print(f"  Command: {' '.join(cmd)}")
    print(f"")

    try:
        result = subprocess.run(cmd, check=True, capture_output=False)
    except FileNotFoundError:
        print(f"[Mirza] Error: llama-optimus not found", file=sys.stderr)
        print(f"  Install: cd ~/llmServe && uv sync --extra tune", file=sys.stderr)
        sys.exit(1)
    except subprocess.CalledProcessError as e:
        print(f"[Mirza] Tuning failed: {e}", file=sys.stderr)
        sys.exit(1)


def main():
    hw = detect_hardware()
    optimal = calculate_optimal_params(hw)

    parser = argparse.ArgumentParser(
        description="Mirza Llama.cpp Python Server",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "--model", help="Path to .gguf model file (auto-detected if not provided)"
    )
    parser.add_argument("--host", default="0.0.0.0", help="Host to bind")
    parser.add_argument("--port", type=int, default=8080, help="Port to bind")
    parser.add_argument("--ctx", type=int, default=8192, help="Context size (n_ctx)")
    parser.add_argument(
        "--n_gpu_layers",
        type=int,
        default=-1,
        help="Number of layers to offload to GPU (-1 = all)",
    )
    parser.add_argument(
        "--flash_attn",
        action="store_true",
        default=True,
        help="Enable Flash Attention (recommended on Apple Silicon)",
    )
    parser.add_argument(
        "--kv_q",
        default="q8_0",
        choices=list(KV_QUANT_MAP.keys()),
        help="KV cache quantization type",
    )
    parser.add_argument(
        "--n_batch",
        type=int,
        default=optimal["n_batch"],
        help=f"Batch size (auto-calculated: {optimal['n_batch']})",
    )
    parser.add_argument(
        "--n_ubatch",
        type=int,
        default=optimal["n_ubatch"],
        help=f"Micro-batch size (auto-calculated: {optimal['n_ubatch']})",
    )
    parser.add_argument(
        "--n_threads",
        type=int,
        default=optimal["n_threads"],
        help=f"CPU threads (auto-calculated: {optimal['n_threads']})",
    )
    parser.add_argument(
        "--n_threads_batch",
        type=int,
        default=optimal["n_threads_batch"],
        help=f"CPU threads for batch (auto-calculated: {optimal['n_threads_batch']})",
    )
    parser.add_argument(
        "--mlock",
        action="store_true",
        default=True,
        help="Force model into RAM (pin to memory)",
    )
    parser.add_argument(
        "--mmap",
        action="store_true",
        default=False,
        help="Use mmap for model loading (default: False)",
    )
    parser.add_argument("--warmup", action="store_true", help="Warmup shaders on start")
    parser.add_argument(
        "--rope_freq_base",
        type=float,
        default=0,
        help="RoPE base frequency override (0 = model default)",
    )
    parser.add_argument(
        "--chat_format", help="Chat format to use (e.g., chatml, llama-3)"
    )
    parser.add_argument(
        "--tune",
        action="store_true",
        help="Run auto-tuning with llama-optimus to find optimal parameters",
    )
    parser.add_argument(
        "--trials", type=int, default=25, help="Number of tuning trials (default: 25)"
    )
    parser.add_argument(
        "--metric",
        default="tg",
        choices=["tg", "pp", "mean"],
        help="Tuning metric: tg=token generation, pp=prompt processing, mean=average",
    )

    args = parser.parse_args()

    # Apply environment variable overrides
    env_overrides = get_env_overrides()
    if env_overrides:
        print(f"[Mirza] Environment overrides detected:")
        for param, value in env_overrides.items():
            print(f"  {param}: {value}")
        if "n_batch" in env_overrides:
            args.n_batch = env_overrides["n_batch"]
        if "n_ubatch" in env_overrides:
            args.n_ubatch = env_overrides["n_ubatch"]
        if "n_threads" in env_overrides:
            args.n_threads = env_overrides["n_threads"]
        if "n_threads_batch" in env_overrides:
            args.n_threads_batch = env_overrides["n_threads_batch"]

    active_model_file = os.path.expanduser("~/llmServe/active_model.json")
    if not args.model:
        if os.path.exists(active_model_file):
            try:
                with open(active_model_file) as f:
                    data = json.load(f)
                    args.model = data.get("path", "")
            except:
                pass
        if not args.model:
            models_dir = os.path.expanduser("~/mirza-models")
            if os.path.exists(models_dir):
                gguf_files = sorted(Path(models_dir).glob("*.gguf"))
                if gguf_files:
                    args.model = str(list(gguf_files)[-1])

    if args.tune:
        if not args.model:
            print(
                "[Mirza] Error: No model specified and none found in ~/mirza-models/",
                file=sys.stderr,
            )
            sys.exit(1)
        run_tuning(args)
        sys.exit(0)

    model_path = os.path.expanduser(args.model)
    if not os.path.exists(model_path):
        print(f"[Mirza] Error: model file not found: {model_path}", file=sys.stderr)
        sys.exit(1)

    print(f"[Mirza] Starting inference server")
    print(f"  Model    : {os.path.basename(model_path)}")
    print(f"  Context  : {args.ctx} tokens")
    print(f"  KV Cache : {args.kv_q}")
    print(f"  Flash Att: {args.flash_attn}")
    print(f"  GPU layers: {args.n_gpu_layers}")
    print(f"  n_batch  : {args.n_batch}")
    print(f"  n_ubatch : {args.n_ubatch}")
    print(f"  n_threads: {args.n_threads}")
    print(f"  n_threads_batch: {args.n_threads_batch}")
    print(f"  Chat Fmt : {args.chat_format or 'auto'}")

    # Safety: KV quantization (Q8_0, Q4_0) REQUIRES flash_attn on recent llama-cpp versions
    if args.kv_q != "f16" and not args.flash_attn:
        print(f"  [Safety] Forcing Flash Attention (required for quantized KV cache)")
        args.flash_attn = True

    cmd = [
        "python",
        "-m",
        "llama_cpp.server",
        "--model",
        model_path,
        "--host",
        args.host,
        "--port",
        str(args.port),
        "--n_ctx",
        str(args.ctx),
        "--n_gpu_layers",
        str(args.n_gpu_layers),
        "--use_mlock",
        "True" if args.mlock else "False",
        "--use_mmap",
        "True" if args.mmap else "False",
        "--n_batch",
        str(args.n_batch),
        "--n_ubatch",
        str(args.n_ubatch),
    ]

    # KV cache quantization (type_k, type_v must be numeric IDs)
    kv_id = KV_QUANT_MAP.get(args.kv_q, "8")
    cmd.extend(["--type_k", kv_id, "--type_v", kv_id])

    if args.flash_attn:
        cmd.extend(["--flash_attn", "True"])

    if args.n_threads > 0:
        cmd.extend(["--n_threads", str(args.n_threads)])

    if args.n_threads_batch > 0:
        cmd.extend(["--n_threads_batch", str(args.n_threads_batch)])

    if args.rope_freq_base > 0:
        cmd.extend(["--rope_freq_base", str(args.rope_freq_base)])

    if args.chat_format:
        cmd.extend(["--chat_format", args.chat_format])

    # Prepare environment
    env = os.environ.copy()
    if args.mlock:
        env["USE_MLOCK"] = "1"

    # Log the full command for debugging
    print(f"  Command  : {' '.join(cmd)}")
    if args.mlock:
        print(f"  Env      : USE_MLOCK=1")

    # Save state for dashboard monitoring (Atomic write with sync)
    try:
        import tempfile

        state_path = os.path.expanduser("~/llmServe/active_model.json")
        os.makedirs(os.path.dirname(state_path), exist_ok=True)

        # Write to temporary file first, then sync and rename (Atomic)
        temp_fd, temp_name = tempfile.mkstemp(dir=os.path.dirname(state_path))
        try:
            with os.fdopen(temp_fd, "w") as f:
                json.dump(
                    {
                        "repo": args.model,
                        "file": os.path.basename(model_path),
                        "path": model_path,
                        "port": args.port,
                        "pid": os.getpid(),
                        "time": time.time(),
                    },
                    f,
                )
                f.flush()
                os.fsync(f.fileno())
            os.replace(temp_name, state_path)
        except Exception as e:
            if os.path.exists(temp_name):
                os.remove(temp_name)
            raise e
    except Exception as e:
        print(f"  [Warning] Failed to save active_model.json: {e}")

    if not args.warmup:
        try:
            subprocess.run(cmd, check=True, env=env)
        except KeyboardInterrupt:
            print("\n[Mirza] Server stopped.")
        except Exception as e:
            print(f"[Mirza] Launch error: {e}")
            sys.exit(1)
    else:
        # Warmup logic: Start server, wait, send dummy request, then wait for server
        import time

        print(f"[Mirza] Warmup enabled. Starting server in background...")
        proc = subprocess.Popen(cmd, env=env)

        # Wait for server to be ready (polled)
        print(f"  Waiting for API to respond on port {args.port}...")
        max_retries = 30
        for i in range(max_retries):
            try:
                with urllib.request.urlopen(
                    f"http://{args.host}:{args.port}/v1/models", timeout=1
                ) as response:
                    if response.status == 200:
                        break
            except:
                time.sleep(1)

        print(f"  API is up. Sending warmup prompt...")
        try:
            warmup_data = json.dumps(
                {
                    "model": os.path.basename(model_path),
                    "prompt": "Hello",
                    "max_tokens": 1,
                }
            ).encode()
            req = urllib.request.Request(
                f"http://{args.host}:{args.port}/v1/completions",
                data=warmup_data,
                headers={"Content-Type": "application/json"},
            )
            with urllib.request.urlopen(req, timeout=10) as response:
                response.read()
            print(f"  Warmup complete. Metal shaders are ready.")
        except Exception as e:
            print(f"  Warmup failed (ignoring): {e}")

        try:
            proc.wait()
        except KeyboardInterrupt:
            print("\n[Mirza] Stopping server...")
            proc.terminate()


if __name__ == "__main__":
    main()
