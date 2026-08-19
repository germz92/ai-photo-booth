#!/usr/bin/env bash
# ReActor glob()s folder_paths.models_dir (/comfyui/models), not extra_model_paths.
# ComfyUI itself finds VAE/UNet/PuLID on the volume; ReActor does not.
# Link those dirs at the volume before ComfyUI starts.

set -u

VOLUME="${NETWORK_VOLUME_PATH:-/runpod-volume}"
COMFY_MODELS="/comfyui/models"

link_reactor_dir() {
  local name="$1"
  local src="${VOLUME}/models/${name}"
  local dst="${COMFY_MODELS}/${name}"

  if [[ ! -d "$src" ]]; then
    echo "worker-comfyui: skip link ${name} (missing ${src})"
    return 0
  fi

  mkdir -p "$COMFY_MODELS"

  if [[ -L "$dst" ]]; then
    rm -f "$dst"
  elif [[ -d "$dst" ]]; then
    echo "worker-comfyui: replacing directory ${dst} with symlink to volume"
    rm -rf "$dst"
  elif [[ -e "$dst" ]]; then
    rm -f "$dst"
  fi

  ln -sfn "$src" "$dst"
  echo "worker-comfyui: linked ${dst} -> ${src}"
  ls -lh "${dst}"/*.onnx "${dst}"/*.pth 2>/dev/null | head -n 20 || true
}

if [[ -d "${VOLUME}/models" ]]; then
  link_reactor_dir insightface
  link_reactor_dir facerestore_models
else
  echo "worker-comfyui: no ${VOLUME}/models — ReActor swap_model list will be empty"
fi

exec /start.sh
