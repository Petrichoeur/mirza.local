"""
Mirza — Llama.cpp Python Server Wrapper
Wraps llama_cpp.server with advanced inference configuration flags.
"""
import argparse
import os
import sys
import json
import subprocess
from pathlib import Path

# KV cache type IDs for llama_cpp.server --type_k / --type_v
KV_QUANT_MAP = {
    "f16":  "1",   # fp16 — full precision
    "q8_0": "8",   # 8-bit quantized — good balance
    "q4_0": "2",   # 4-bit quantized — max savings
    "bf16": "32",  # bfloat16 (Apple Silicon prefers this)
}


def main():
    parser = argparse.ArgumentParser(
        description="Mirza Llama.cpp Python Server",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument("--model", required=True, help="Path to .gguf model file")
    parser.add_argument("--host", default="0.0.0.0", help="Host to bind")
    parser.add_argument("--port", type=int, default=8080, help="Port to bind")
    parser.add_argument("--ctx", type=int, default=8192, help="Context size (n_ctx)")
    parser.add_argument("--n_gpu_layers", type=int, default=99,
                        help="Number of layers to offload to GPU (Metal on macOS)")
    parser.add_argument("--flash_attn", action="store_true",
                        help="Enable Flash Attention (recommended on Apple Silicon)")
    parser.add_argument("--kv_q", default="q8_0",
                        choices=list(KV_QUANT_MAP.keys()),
                        help="KV cache quantization type")
    parser.add_argument("--n_batch", type=int, default=512, help="Batch size for prompt processing")
    parser.add_argument("--n_ubatch", type=int, default=512, help="Micro-batch size")
    parser.add_argument("--threads", type=int, default=0,
                        help="CPU threads (0 = auto-detect from performance cores)")
    parser.add_argument("--rope_freq_base", type=float, default=0,
                        help="RoPE base frequency override (0 = model default)")

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

    # Log the full command for debugging
    print(f"  Command  : {' '.join(cmd)}")

    try:
        subprocess.run(cmd, check=True)
    except KeyboardInterrupt:
        print("\n[Mirza] Server stopped.")
    except subprocess.CalledProcessError as e:
        print(f"[Mirza] Launch error (code {e.returncode}): {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"[Mirza] Unexpected error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
