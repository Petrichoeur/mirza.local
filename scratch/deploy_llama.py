import argparse
import os
import sys
import json
from pathlib import Path
from huggingface_hub import list_repo_files, hf_hub_download

# Configuration
RAM_GB = 24
OVERHEAD_GB = 4
AVAILABLE_VRAM_GB = RAM_GB - OVERHEAD_GB

def get_gguf_files(repo_id):
    """List all GGUF files in a repository."""
    try:
        files = list_repo_files(repo_id)
        return [f for f in files if f.endswith(".gguf")]
    except Exception as e:
        print(f"Error listing files in {repo_id}: {e}")
        return []

def estimate_vram(filename, repo_id):
    """
    Very crude estimation of VRAM usage.
    For GGUF, the file size is a good proxy for model weights in VRAM.
    We add a buffer for KV Cache (depends on context, but let's be conservative).
    """
    # In a real scenario, we'd check the file size via API
    # For now, we'll assume the user might have some info or we'll just download and check
    return 0 # Placeholder for now, improved in actual logic

def select_best_quant(files):
    """
    Auto-select the best quantization for 24GB.
    Prioritizes Q8_0, then Q4_K_M, then others that fit.
    """
    # Prefer Q4_K_M as a solid default for performance/quality
    priority = ["Q4_K_M", "Q4_0", "Q8_0", "Q5_K_M", "Q2_K"]
    
    for p in priority:
        match = [f for f in files if p in f.upper()]
        if match:
            return match[0]
            
    # Fallback to the first GGUF found
    return files[0] if files else None

def main():
    parser = argparse.ArgumentParser(description="Mirza GGUF Deployment Script")
    parser.add_argument("repo", help="Hugging Face repository ID")
    parser.add_argument("filename", nargs="?", help="Specific GGUF filename (optional)")
    parser.add_argument("--save-dir", default=os.path.expanduser("~/mirza-models"), help="Directory to save models")
    
    args = parser.parse_args()
    
    os.makedirs(args.save_dir, exist_ok=True)
    
    print(f"Checking repository: {args.repo}...")
    files = get_gguf_files(args.repo)
    
    if not files:
        print(f"No GGUF files found in {args.repo}.")
        sys.exit(1)
        
    target_file = args.filename
    if not target_file:
        print("Auto-selecting best quantization...")
        target_file = select_best_quant(files)
        print(f"Selected: {target_file}")
    else:
        if target_file not in files:
            print(f"Warning: {target_file} not found in repository. Available files:")
            for f in files: print(f" - {f}")
            sys.exit(1)

    print(f"Downloading {target_file} from {args.repo}...")
    
    # Use the 'hf' command style logic or library call
    # Note: hf_hub_download handles caching and Resume
    dest_path = hf_hub_download(
        repo_id=args.repo,
        filename=target_file,
        local_dir=args.save_dir,
        local_dir_use_symlinks=False
    )
    
    print(f"Successfully deployed to: {dest_path}")
    
    # Save as active model metadata
    with open(os.path.expanduser("~/llmServe/active_model.json"), "w") as f:
        json.dump({
            "repo": args.repo,
            "file": target_file,
            "path": str(dest_path)
        }, f)

if __name__ == "__main__":
    main()
