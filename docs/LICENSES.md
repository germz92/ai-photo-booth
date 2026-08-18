# Licenses and GPU sizing

Confirm both licenses **before a paid event**. This is a business gate, not something the Docker image can fix.

## Flux Krea [dev]

The UNET `flux1-krea-dev_float8_e4m3fn_learned_svd.safetensors` is a quantized FLUX.1 Krea [dev] weight.

- Upstream license: [FLUX.1 [dev] Non-Commercial License](https://huggingface.co/black-forest-labs/FLUX.1-Krea-dev) / [BFL license text](https://github.com/black-forest-labs/flux/blob/main/model_licenses/LICENSE-FLUX1-dev).
- The [dev] line is **non-commercial** for the model weights unless you have a separate Black Forest Labs commercial license.
- A ticketed or brand-sponsored photo booth is commercial use. Do not run Krea [dev] at a paid activation until BFL (or an authorized host) has licensed it.
- Alternative if you cannot license [dev]: swap node 204 to a commercially licensed FLUX variant and re-test identity (PuLID + ReActor). That is a model change, not a Docker rebuild of custom nodes.

## Qwen Image Edit 2511

Apache-2.0 / Tongyi Qianwen terms on the Comfy-Org and QwenLM releases. Still read the card for the exact files you download (`qwen_image_edit_2511_fp8mixed` and the Lightning LoRA).

## InsightFace / ReActor / buffalo_l

- InsightFace **code** is MIT. Many **model weights** (including `buffalo_l` and related face-analysis models) are released for **research / non-commercial** use.
- `inswapper_128.onnx` is similarly restricted in typical distributions.
- ReActor also ships an NSFW filter that can refuse images; plan a staff fallback (retake) rather than trying to disable safety in production.

For a paid event you need one of:

1. Written commercial rights to the InsightFace weights you ship, or
2. A commercially licensed face ID stack in place of PuLID+ReActor (for example a vendor API), or
3. A non-identity restyle that does not run InsightFace (quality/likeness will change).

## PuLID Flux

`pulid_flux_v0.9.1.safetensors` follows its Hugging Face card (typically research / Apache-adjacent). Confirm the card for the file you actually download.

## Guest photos (privacy)

The booth stores originals and outputs, emails a link, and may SMS a link. For events:

- Collect consent on the capture page (implemented).
- Short-lived result URLs (48 hours).
- Do not keep guest photos longer than the event contract requires.
- Prefer a result **link** over MMS of the full image.

## GPU sizing

| Resource | Event default | Notes |
| --- | --- | --- |
| GPU VRAM | **48GB** (A6000, L40S, A100) | Qwen Edit fp8 (~20GB) + Flux Krea fp8 (~12GB) + T5/Qwen-VL encoders. 24GB is not the first-deploy target. |
| Active workers | **1** (or more if the line is long) | Avoids multi-minute cold starts while 50GB loads from the network volume. |
| Max workers | 2–4 | Cap spend. Queue in the jobs table if you hit the cap. |
| Idle timeout | 15–30 min | Keep the warm worker between guests. |
| Flash Boot | on | Faster process start; does not skip model load. |
| Container disk | 20GB | Models live on the volume, not in the image. |
| Volume | 100GB | ~50GB weights plus headroom. |

Warm job: about 30–90s. Cold job: several minutes. Staff should fire a dummy `/run` after bringing the endpoint up, before doors open.

## What this repo implemented vs what you still confirm

Implemented in-repo:

- Worker Dockerfile and volume layout
- Endpoint settings documented in [RUNPOD.md](./RUNPOD.md)
- Capture-page consent checkbox
- 48-hour result links

You still need to confirm, outside this repo:

- BFL commercial license for Flux Krea [dev] if the event is paid
- InsightFace/inswapper commercial rights or a replacement identity stack
- Privacy retention with the client
