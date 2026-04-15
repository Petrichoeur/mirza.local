import argparse
import json
import os
import subprocess
import sys

def main():
    parser = argparse.ArgumentParser(description="Mirza Llama-CPP Server")
    parser.add_argument("--model-path", help="Path to the GGUF model file")
    parser.add_argument("--port", type=int, default=8080)
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--ctx", type=int, default=4096, help="Context size")
    parser.add_argument("--kv-q", choices=["f16", "q8_0", "q4_0"], default="f16", help="KV Cache quantization")
    parser.add_argument("--flash-attn", action="store_true", help="Enable Flash Attention")
    parser.add_argument("--n-gpu-layers", type=int, default=-1, help="Number of layers to offload to GPU (-1 for all)")

    args = parser.parse_args()

    model_path = args.model_path
    if not model_path:
        # Try to load active model
        active_model_json = os.path.expanduser("~/llmServe/active_model.json")
        if os.path.exists(active_model_json):
            with open(active_model_json, "r") as f:
                data = json.load(f)
                model_path = data.get("path")
        
    if not model_path or not os.path.exists(model_path):
        print("Error: No model specified or model file not found.")
        sys.exit(1)

    print(f"Starting Llama-CPP server with model: {model_path}")
    print(f"Optimizations: Flash-Attn={args.flash_attn}, KV-Quant={args.kv_q}")

    # Build the command for llama_cpp.server
    # Note: we use 'python -m llama_cpp.server'
    cmd = [
        sys.executable, "-m", "llama_cpp.server",
        "--model", model_path,
        "--host", args.host,
        "--port", str(args.port),
        "--n_ctx", str(args.ctx),
        "--n_gpu_layers", str(args.n_gpu_layers),
    ]

    if args.flash_attn:
        cmd.extend(["--flash_attn", "True"])
    else:
        cmd.extend(["--flash_attn", "False"])
    
    # KV Cache types (llama_cpp.server expects integer IDs for --type_k and --type_v)
    # F16: 1, Q8_0: 8, Q4_0: 2
    if args.kv_q == "q8_0":
        cmd.extend(["--type_k", "8", "--type_v", "8"])
    elif args.kv_q == "q4_0":
        cmd.extend(["--type_k", "2", "--type_v", "2"])
    else: # Default F16
        cmd.extend(["--type_k", "1", "--type_v", "1"])

    # Launch the server
    try:
        subprocess.run(cmd, check=True)
    except KeyboardInterrupt:
        print("\nServer stopped.")
    except Exception as e:
        print(f"Error starting server: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
