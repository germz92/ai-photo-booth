#!/usr/bin/env bash
# Populate a RunPod Network Volume (or local folder) with booth models.
# Run this from a GPU pod with the volume mounted at /workspace, or locally
# with DEST pointing at the volume root.
#
#   DEST=/workspace ./worker/scripts/download-models.sh
#   DEST=./models-volume ./worker/scripts/download-models.sh
#
# Requires: curl or wget. Hugging Face gated files (Flux VAE) need HF_TOKEN.

set -euo pipefail

DEST="${DEST:-/workspace}"
ROOT="${DEST%/}/models"
HF_TOKEN="${HF_TOKEN:-}"

mkdir -p \
  "$ROOT/vae" \
  "$ROOT/clip/t5" \
  "$ROOT/text_encoders" \
  "$ROOT/unet/FLUX1" \
  "$ROOT/diffusion_models" \
  "$ROOT/loras" \
  "$ROOT/pulid" \
  "$ROOT/insightface" \
  "$ROOT/facerestore_models"

auth_header=()
if [[ -n "$HF_TOKEN" ]]; then
  auth_header=(-H "Authorization: Bearer $HF_TOKEN")
fi

download() {
  local url="$1"
  local out="$2"
  if [[ -f "$out" ]]; then
    echo "skip  $out"
    return 0
  fi
  echo "get   $out"
  mkdir -p "$(dirname "$out")"
  if command -v curl >/dev/null 2>&1; then
    curl -L --fail --retry 5 --retry-delay 2 "${auth_header[@]}" -o "$out" "$url"
  else
    wget -O "$out" "$url"
  fi
}

# Flux Krea stack
download "https://huggingface.co/black-forest-labs/FLUX.1-dev/resolve/main/ae.safetensors" \
  "$ROOT/vae/ae.safetensors"
download "https://huggingface.co/comfyanonymous/flux_text_encoders/resolve/main/clip_l.safetensors" \
  "$ROOT/clip/clip_l.safetensors"
download "https://huggingface.co/comfyanonymous/flux_text_encoders/resolve/main/t5xxl_fp8_e4m3fn.safetensors" \
  "$ROOT/clip/t5/google_t5-v1_1-xxl_encoderonly-fp8_e4m3fn.safetensors"
download "https://huggingface.co/Clybius/FLUX.1-Krea-dev-scaled-fp8/resolve/main/flux1-krea-dev_float8_e4m3fn_learned_svd.safetensors" \
  "$ROOT/unet/FLUX1/flux1-krea-dev_float8_e4m3fn_learned_svd.safetensors"
download "https://huggingface.co/guozinan/PuLID/resolve/main/pulid_flux_v0.9.1.safetensors" \
  "$ROOT/pulid/pulid_flux_v0.9.1.safetensors"

# Qwen Image Edit 2511 stack
download "https://huggingface.co/Comfy-Org/Qwen-Image_ComfyUI/resolve/main/split_files/text_encoders/qwen_2.5_vl_7b_fp8_scaled.safetensors" \
  "$ROOT/text_encoders/qwen_2.5_vl_7b_fp8_scaled.safetensors"
download "https://huggingface.co/Comfy-Org/Qwen-Image_ComfyUI/resolve/main/split_files/text_encoders/qwen_2.5_vl_7b_fp8_scaled.safetensors" \
  "$ROOT/clip/qwen_2.5_vl_7b_fp8_scaled.safetensors"
download "https://huggingface.co/Comfy-Org/Qwen-Image_ComfyUI/resolve/main/split_files/vae/qwen_image_vae.safetensors" \
  "$ROOT/vae/qwen_image_vae.safetensors"
download "https://huggingface.co/silveroxides/Qwen-Image-fp8-scaled-quants/resolve/main/qwen_image_edit_2511_fp8mixed_fullmm.safetensors" \
  "$ROOT/unet/qwen_image_edit_2511_fp8mixed.safetensors"
download "https://huggingface.co/silveroxides/Qwen-Image-fp8-scaled-quants/resolve/main/qwen_image_edit_2511_fp8mixed_fullmm.safetensors" \
  "$ROOT/diffusion_models/qwen_image_edit_2511_fp8mixed.safetensors"
download "https://huggingface.co/lightx2v/Qwen-Image-Edit-2511-Lightning/resolve/main/Qwen-Image-Edit-2511-Lightning-4steps-V1.0-bf16.safetensors" \
  "$ROOT/loras/Qwen-Image-Edit-2511-Lightning-4steps-V1.0-bf16.safetensors"

# ReActor / InsightFace
download "https://huggingface.co/ezioruan/inswapper_128.onnx/resolve/main/inswapper_128.onnx" \
  "$ROOT/insightface/inswapper_128.onnx"
download "https://github.com/TencentARC/GFPGAN/releases/download/v1.3.4/GFPGANv1.4.pth" \
  "$ROOT/facerestore_models/GFPGANv1.4.pth"
download "https://github.com/deepinsight/insightface/releases/download/v0.7/buffalo_l.zip" \
  "$ROOT/insightface/buffalo_l.zip"

if command -v unzip >/dev/null 2>&1 && [[ -f "$ROOT/insightface/buffalo_l.zip" ]]; then
  mkdir -p "$ROOT/insightface/models/buffalo_l"
  unzip -n "$ROOT/insightface/buffalo_l.zip" -d "$ROOT/insightface/models/buffalo_l"
fi

echo
echo "Done. Volume layout is under $ROOT"
du -sh "$ROOT"/* 2>/dev/null || true
