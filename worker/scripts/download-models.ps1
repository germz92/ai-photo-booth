# Populate a models volume with booth weights (Windows).
#   $env:DEST = "C:\models-volume"
#   $env:HF_TOKEN = "hf_..."
#   .\worker\scripts\download-models.ps1

$ErrorActionPreference = "Stop"
$Dest = if ($env:DEST) { $env:DEST } else { ".\models-volume" }
$Root = Join-Path $Dest "models"
$HfToken = $env:HF_TOKEN

$dirs = @(
  "vae",
  "clip\t5",
  "text_encoders",
  "unet\FLUX1",
  "diffusion_models",
  "loras",
  "pulid",
  "insightface",
  "facerestore_models"
)
foreach ($d in $dirs) {
  New-Item -ItemType Directory -Force -Path (Join-Path $Root $d) | Out-Null
}

function Get-Model($Url, $Out) {
  if (Test-Path $Out) {
    Write-Host "skip  $Out"
    return
  }
  Write-Host "get   $Out"
  New-Item -ItemType Directory -Force -Path (Split-Path $Out) | Out-Null
  $headers = @{}
  if ($HfToken) { $headers["Authorization"] = "Bearer $HfToken" }
  Invoke-WebRequest -Uri $Url -OutFile $Out -Headers $headers
}

Get-Model "https://huggingface.co/black-forest-labs/FLUX.1-dev/resolve/main/ae.safetensors" (Join-Path $Root "vae\ae.safetensors")
Get-Model "https://huggingface.co/comfyanonymous/flux_text_encoders/resolve/main/clip_l.safetensors" (Join-Path $Root "clip\clip_l.safetensors")
Get-Model "https://huggingface.co/comfyanonymous/flux_text_encoders/resolve/main/t5xxl_fp8_e4m3fn.safetensors" (Join-Path $Root "clip\t5\google_t5-v1_1-xxl_encoderonly-fp8_e4m3fn.safetensors")
Get-Model "https://huggingface.co/Clybius/FLUX.1-Krea-dev-scaled-fp8/resolve/main/flux1-krea-dev_float8_e4m3fn_learned_svd.safetensors" (Join-Path $Root "unet\FLUX1\flux1-krea-dev_float8_e4m3fn_learned_svd.safetensors")
Get-Model "https://huggingface.co/guozinan/PuLID/resolve/main/pulid_flux_v0.9.1.safetensors" (Join-Path $Root "pulid\pulid_flux_v0.9.1.safetensors")
Get-Model "https://huggingface.co/Comfy-Org/Qwen-Image_ComfyUI/resolve/main/split_files/text_encoders/qwen_2.5_vl_7b_fp8_scaled.safetensors" (Join-Path $Root "text_encoders\qwen_2.5_vl_7b_fp8_scaled.safetensors")
Get-Model "https://huggingface.co/Comfy-Org/Qwen-Image_ComfyUI/resolve/main/split_files/text_encoders/qwen_2.5_vl_7b_fp8_scaled.safetensors" (Join-Path $Root "clip\qwen_2.5_vl_7b_fp8_scaled.safetensors")
Get-Model "https://huggingface.co/Comfy-Org/Qwen-Image_ComfyUI/resolve/main/split_files/vae/qwen_image_vae.safetensors" (Join-Path $Root "vae\qwen_image_vae.safetensors")
Get-Model "https://huggingface.co/silveroxides/Qwen-Image-fp8-scaled-quants/resolve/main/qwen_image_edit_2511_fp8mixed_fullmm.safetensors" (Join-Path $Root "unet\qwen_image_edit_2511_fp8mixed.safetensors")
Get-Model "https://huggingface.co/silveroxides/Qwen-Image-fp8-scaled-quants/resolve/main/qwen_image_edit_2511_fp8mixed_fullmm.safetensors" (Join-Path $Root "diffusion_models\qwen_image_edit_2511_fp8mixed.safetensors")
Get-Model "https://huggingface.co/lightx2v/Qwen-Image-Edit-2511-Lightning/resolve/main/Qwen-Image-Edit-2511-Lightning-4steps-V1.0-bf16.safetensors" (Join-Path $Root "loras\Qwen-Image-Edit-2511-Lightning-4steps-V1.0-bf16.safetensors")
Get-Model "https://huggingface.co/ezioruan/inswapper_128.onnx/resolve/main/inswapper_128.onnx" (Join-Path $Root "insightface\inswapper_128.onnx")
Get-Model "https://github.com/TencentARC/GFPGAN/releases/download/v1.3.4/GFPGANv1.4.pth" (Join-Path $Root "facerestore_models\GFPGANv1.4.pth")
Get-Model "https://github.com/deepinsight/insightface/releases/download/v0.7/buffalo_l.zip" (Join-Path $Root "insightface\buffalo_l.zip")

Write-Host "Done. Volume layout is under $Root"
