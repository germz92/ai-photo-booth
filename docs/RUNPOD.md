# RunPod worker: build, volume, endpoint, smoke tests

This booth uses a **custom** `worker-comfyui` image plus a **Network Volume** for weights. Official `flux1-dev` / `sdxl` tags will not run [workflows/booth-api.json](../workflows/booth-api.json).

## 1. Build the image

Build from the **repo root**. The image copies [`custom nodes/ComfyUI-PuLID-Flux-GR`](../custom%20nodes/ComfyUI-PuLID-Flux-GR), not the stock GitHub pack. That fork skips PuLID's global `UnloadAllModels` so Qwen and Krea stay loaded between stages.

```bash
docker build --platform linux/amd64 -f worker/Dockerfile -t YOUR_DOCKERHUB_USER/ai-photo-booth-worker:v1 .
docker push YOUR_DOCKERHUB_USER/ai-photo-booth-worker:v1
```

Or create a RunPod serverless endpoint with **Start from GitHub Repo**, Dockerfile path `worker/Dockerfile`, context `/`.

The image is slim: ComfyUI 5.8.6-base, your customized PuLID-GR, ReActor, InsightFace/onnx. It does **not** contain the ~50GB of models.

## 2. Network volume (~50GB, same region as the endpoint)

Create a RunPod Network Volume (100GB recommended). Attach a temporary GPU **Pod** with that volume mounted at `/workspace`. Then:

```bash
export HF_TOKEN=hf_your_token   # required for gated Flux VAE
export DEST=/workspace
bash /workspace/repo/worker/scripts/download-models.sh
```

Expected layout (serverless mount is `/runpod-volume`):

```text
/runpod-volume/models/
  vae/ae.safetensors
  vae/qwen_image_vae.safetensors
  clip/clip_l.safetensors
  clip/t5/google_t5-v1_1-xxl_encoderonly-fp8_e4m3fn.safetensors
  clip/qwen_2.5_vl_7b_fp8_scaled.safetensors
  text_encoders/qwen_2.5_vl_7b_fp8_scaled.safetensors
  unet/FLUX1/flux1-krea-dev_float8_e4m3fn_learned_svd.safetensors
  unet/qwen_image_edit_2511_fp8mixed.safetensors
  diffusion_models/qwen_image_edit_2511_fp8mixed.safetensors
  loras/Qwen-Image-Edit-2511-Lightning-4steps-V1.0-bf16.safetensors
  pulid/pulid_flux_v0.9.1.safetensors
  insightface/inswapper_128.onnx
  insightface/models/buffalo_l/*.onnx
  insightface/models/antelopev2/*.onnx
  facerestore_models/GFPGANv1.4.pth
```

Windows: `.\worker\scripts\download-models.ps1` with `$env:DEST` and `$env:HF_TOKEN`.

## 3. Endpoint settings (event default)

| Setting | Value |
| --- | --- |
| GPU | **48GB** (A6000 / L40S / A100). Do not first-deploy on 24GB. |
| Active workers | **1** during the event (avoids multi-minute cold loads) |
| Max workers | 2–4 depending on queue |
| Idle timeout | 15–30 minutes |
| Flash Boot | on |
| Network volume | the volume from step 2 |
| Container disk | 20GB (image + scratch, not models) |
| Env | `NETWORK_VOLUME_DEBUG=true` until models appear |

Optional S3 upload on the worker (recommended so webhooks are small):

- `BUCKET_ENDPOINT_URL`
- `BUCKET_ACCESS_KEY_ID`
- `BUCKET_SECRET_ACCESS_KEY`
- `BUCKET_NAME`

See [worker-comfyui configuration](https://github.com/runpod-workers/worker-comfyui/blob/main/docs/configuration.md).

## 4. Smoke tests (do these before any booth UI)

### Offline graph check (no GPU)

```bash
node scripts/validate-workflow.mjs
```

### class_types on a live worker

SSH to the worker (`PUBLIC_KEY` on the template, port 22) after ComfyUI is up:

```bash
python /usr/local/bin/check-booth-nodes.py
```

If ReActor or PuLID class types are missing, the Docker install failed (almost always InsightFace/onnx). Rebuild; do not debug this from the Next.js app.

### One `/run` job

JPEG under 5MB. `/run` payload limit is ~10MB.

```bash
# Fill RUNPOD_API_KEY, ENDPOINT_ID, and a base64 JPEG:
node worker/scripts/run-smoke.mjs
```

Or curl:

```bash
curl -X POST "https://api.runpod.ai/v2/$ENDPOINT_ID/run" \
  -H "Authorization: Bearer $RUNPOD_API_KEY" \
  -H "Content-Type: application/json" \
  -d @worker/test_input.example.json
```

Poll `https://api.runpod.ai/v2/$ENDPOINT_ID/status/$JOB_ID` until `COMPLETED`. `output.images` should contain one `SaveImage` result.

Warm-worker runtime target: **30–90 seconds**. First job after a cold start can take several minutes while weights load from the volume.

## Troubleshooting: `swap_model: 'inswapper_128.onnx' not in []`

ReActor lists swap models by globbing **`/comfyui/models/insightface/*.onnx`**. It ignores `extra_model_paths.yaml`, so a file that only exists on the volume at `/runpod-volume/models/insightface/inswapper_128.onnx` looks like an empty list.

The worker image wraps `/start.sh` and symlinks `insightface` and `facerestore_models` from the volume. If you are still on `germz92/ai-photo-booth-worker:v1`, either rebuild as **v2** or set this as the endpoint **Docker Command** (then scale workers to 0 and back so they restart):

```bash
/bin/bash -c 'mkdir -p /comfyui/models; for d in insightface facerestore_models; do if [ -d /runpod-volume/models/$d ]; then rm -rf /comfyui/models/$d; ln -sfn /runpod-volume/models/$d /comfyui/models/$d; fi; done; exec /start.sh'
```

Confirm the file is on the volume (cheap CPU pod, same volume mounted at `/workspace`):

```bash
ls -lh /workspace/models/insightface/inswapper_128.onnx
```

## 5. App env

Point the booth processor at this endpoint (`RUNPOD_API_KEY`, `RUNPOD_ENDPOINT_ID`, `APP_URL` webhook). See [web/.env.example](../web/.env.example).
