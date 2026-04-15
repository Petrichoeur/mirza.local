"""
Mirza — GGUF Model Deployment Script
Downloads a GGUF file from HuggingFace Hub to the local model directory,
with real-time progress reporting via /tmp/mirza-download.progress.
"""
import argparse
import os
import sys
import json
from pathlib import Path

# Progress file polled by the WebUI server
PROGRESS_FILE = "/tmp/mirza-download.progress"
DEFAULT_SAVE_DIR = os.path.expanduser("~/mirza-models")
ACTIVE_MODEL_FILE = os.path.expanduser("~/llmServe/active_model.json")


def _write_progress(value: int):
    try:
        with open(PROGRESS_FILE, "w") as f:
            f.write(str(value))
    except Exception:
        pass


def get_gguf_files(repo_id: str) -> list[str]:
    """List all .gguf files in a HuggingFace repository."""
    from huggingface_hub import list_repo_files
    try:
        return [f for f in list_repo_files(repo_id) if f.lower().endswith(".gguf")]
    except Exception as e:
        print(f"[Mirza] HuggingFace error: {e}", file=sys.stderr)
        return []


def select_best_quant(files: list[str]) -> str | None:
    """
    Choose the best quantization file by priority.
    Prefer Q4_K_M (best quality/size ratio), fallback gracefully.
    """
    priority = ["Q4_K_M", "Q5_K_M", "Q4_K_S", "Q4_0", "Q8_0", "Q2_K", "IQ4_XS", "IQ3_M"]
    for p in priority:
        match = [f for f in files if p.upper() in f.upper()]
        if match:
            return match[0]
    return files[0] if files else None


def main():
    parser = argparse.ArgumentParser(
        description="Mirza GGUF Model Deployment",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument("repo", help="HuggingFace repo ID (e.g. ggml-org/gemma-3-4b-it-GGUF)")
    parser.add_argument("filename", nargs="?", default="",
                        help="Specific GGUF filename (auto-selected if not provided)")
    parser.add_argument("--save-dir", default=DEFAULT_SAVE_DIR,
                        help="Local directory to save the model")
    parser.add_argument("--token", default="",
                        help="HuggingFace access token (for gated models)")

    args = parser.parse_args()
    os.makedirs(args.save_dir, exist_ok=True)

    # Reset progress
    _write_progress(0)

    print(f"[Mirza] Searching for GGUF files in: {args.repo}")
    files = get_gguf_files(args.repo)
    if not files:
        print(f"[Mirza] Error: no GGUF file found in {args.repo}", file=sys.stderr)
        _write_progress(-1)
        sys.exit(1)

    print(f"[Mirza] {len(files)} GGUF file(s) available:")
    for f in files:
        print(f"  - {f}")

    target_file = args.filename.strip() if args.filename.strip() else select_best_quant(files)
    if not target_file:
        print("[Mirza] Error: could not select a GGUF file", file=sys.stderr)
        _write_progress(-1)
        sys.exit(1)

    if target_file not in files:
        print(f"[Mirza] Error: file '{target_file}' not found in repository", file=sys.stderr)
        _write_progress(-1)
        sys.exit(1)

    print(f"[Mirza] Downloading: {target_file}")

    try:
        from huggingface_hub import hf_hub_download

        # Custom progress callback via tqdm
        from tqdm.auto import tqdm

        class MirzaProgressBar(tqdm):
            def update(self, n=1):
                super().update(n)
                if self.total and self.total > 0:
                    pct = int(min(self.n * 100 / self.total, 100))
                    _write_progress(pct)

        hf_kwargs = {
            "repo_id": args.repo,
            "filename": target_file,
            "local_dir": args.save_dir,
            "tqdm_class": MirzaProgressBar,
        }
        # Add token if provided (for gated models like Llama 3)
        if args.token:
            hf_kwargs["token"] = args.token

        dest_path = hf_hub_download(**hf_kwargs)

        _write_progress(100)
        print(f"[Mirza] Success: {dest_path}")

        # Save as active model
        with open(ACTIVE_MODEL_FILE, "w") as f:
            json.dump({
                "repo": args.repo,
                "file": target_file,
                "path": str(dest_path),
            }, f, indent=2)
        print(f"[Mirza] Active model updated: {ACTIVE_MODEL_FILE}")

    except KeyboardInterrupt:
        print("\n[Mirza] Download cancelled.")
        _write_progress(-1)
        sys.exit(1)
    except Exception as e:
        print(f"[Mirza] Error: {e}", file=sys.stderr)
        _write_progress(-1)
        sys.exit(1)


if __name__ == "__main__":
    main()
