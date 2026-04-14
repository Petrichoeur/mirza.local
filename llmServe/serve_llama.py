"""
Mirza — Llama.cpp Python Server Wrapper
Wraps llama_cpp.server with advanced inference configuration flags.
"""
import argparse
import os
import sys
import json
import subprocess
import time
from pathlib import Path

# KV cache type IDs for llama_cpp.server --type_k / --type_v
KV_QUANT_MAP = {
    "f16":  "1",   # GGML_TYPE_F16 = 1
    "q8_0": "8",   # GGML_TYPE_Q8_0 = 8
    "q4_0": "4",   # GGML_TYPE_Q4_0 = 4
}


def detect_hardware():
    """Detect Apple Silicon generation and performance cores."""
    info = {"chip": "M-series", "p_cores": 4, "batch": 2048, "ubatch": 512}
    try:
        # Detect chip brand
        brand = subprocess.check_output(["sysctl", "-n", "machdep.cpu.brand_string"], text=True).strip()
        info["chip"] = brand
        
        # Detect P-cores (logicalcpu for perflevel0 represents performance cores cluster)
        p_cores = subprocess.check_output(["sysctl", "-n", "hw.perflevel0.logicalcpu"], text=True).strip()
        if p_cores.isdigit():
            info["p_cores"] = int(p_cores)
            
        # Optimization: M3/M4 have higher memory bandwidth efficiency
        if "M3" in brand or "M4" in brand:
            info["batch"] = 4096
            info["ubatch"] = 1024
    except:
        pass
    return info


def main():
    hw = detect_hardware()
    
    parser = argparse.ArgumentParser(
        description="Mirza Llama.cpp Python Server",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument("--model", required=True, help="Path to .gguf model file")
    parser.add_argument("--host", default="0.0.0.0", help="Host to bind")
    parser.add_argument("--port", type=int, default=8080, help="Port to bind")
    parser.add_argument("--ctx", type=int, default=8192, help="Context size (n_ctx)")
    parser.add_argument("--n_gpu_layers", type=int, default=100,
                        help="Number of layers to offload to GPU (Metal on macOS)")
    parser.add_argument("--flash_attn", action="store_true", default=True,
                        help="Enable Flash Attention (recommended on Apple Silicon)")
    parser.add_argument("--kv_q", default="q8_0",
                        choices=list(KV_QUANT_MAP.keys()),
                        help="KV cache quantization type")
    parser.add_argument("--n_batch", type=int, default=hw["batch"], 
                        help=f"Batch size (dynamic for {hw['chip']})")
    parser.add_argument("--n_ubatch", type=int, default=hw["ubatch"], 
                        help=f"Micro-batch size (dynamic for {hw['chip']})")
    parser.add_argument("--threads", type=int, default=hw["p_cores"],
                        help=f"CPU threads (targeted P-cores: {hw['p_cores']})")
    parser.add_argument("--mlock", action="store_true", default=True,
                        help="Force model into RAM (pin to memory)")
    parser.add_argument("--warmup", action="store_true", help="Warmup shaders on start")
    parser.add_argument("--rope_freq_base", type=float, default=0,
                        help="RoPE base frequency override (0 = model default)")
    parser.add_argument("--chat_format", help="Chat format to use (e.g., chatml, llama-3)")

    args = parser.parse_args()

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
    print(f"  Chat Fmt : {args.chat_format or 'auto'}")
    
    # Safety: KV quantization (Q8_0, Q4_0) REQUIRES flash_attn on recent llama-cpp versions
    if args.kv_q != "f16" and not args.flash_attn:
        print(f"  [Safety] Forcing Flash Attention (required for quantized KV cache)")
        args.flash_attn = True

    cmd = [
        "python", "-m", "llama_cpp.server",
        "--model",        model_path,
        "--host",         args.host,
        "--port",         str(args.port),
        "--n_ctx",        str(args.ctx),
        "--n_gpu_layers", str(args.n_gpu_layers),
        "--n_batch",      str(args.n_batch),
        "--n_ubatch",     str(args.n_ubatch),
    ]

    # KV cache quantization (type_k, type_v must be numeric IDs)
    kv_id = KV_QUANT_MAP.get(args.kv_q, "8")
    cmd.extend(["--type_k", kv_id, "--type_v", kv_id])

    if args.flash_attn:
        cmd.extend(["--flash_attn", "True"])

    if args.threads > 0:
        cmd.extend(["--n_threads", str(args.threads)])

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
            with os.fdopen(temp_fd, 'w') as f:
                json.dump({
                    "repo": args.model,
                    "file": os.path.basename(model_path),
                    "path": model_path,
                    "port": args.port,
                    "pid": os.getpid(),
                    "time": time.time()
                }, f)
                f.flush()
                os.fsync(f.fileno())
            os.replace(temp_name, state_path)
        except Exception as e:
            if os.path.exists(temp_name): os.remove(temp_name)
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
        import urllib.request
        
        print(f"[Mirza] Warmup enabled. Starting server in background...")
        proc = subprocess.Popen(cmd, env=env)
        
        # Wait for server to be ready (polled)
        print(f"  Waiting for API to respond on port {args.port}...")
        max_retries = 30
        for i in range(max_retries):
            try:
                with urllib.request.urlopen(f"http://{args.host}:{args.port}/v1/models", timeout=1) as response:
                    if response.status == 200:
                        break
            except:
                time.sleep(1)
        
        print(f"  API is up. Sending warmup prompt...")
        try:
            warmup_data = json.dumps({
                "model": os.path.basename(model_path),
                "prompt": "Hello", 
                "max_tokens": 1
            }).encode()
            req = urllib.request.Request(
                f"http://{args.host}:{args.port}/v1/completions",
                data=warmup_data,
                headers={'Content-Type': 'application/json'}
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
