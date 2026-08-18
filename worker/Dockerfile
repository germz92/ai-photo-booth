# Custom RunPod serverless worker for the AI Photo Booth ComfyUI graph.
# Models are NOT baked in. Attach a Network Volume at /runpod-volume
# populated by scripts/download-models.sh (~50GB).
#
# Build from the repo root so the local customized PuLID node is included:
#   docker build --platform linux/amd64 -f worker/Dockerfile -t ai-photo-booth-worker:latest .

FROM runpod/worker-comfyui:5.8.6-base

USER root

WORKDIR /comfyui/custom_nodes

# Use the repo's slightly customized PuLID-GR (do not git clone upstream).
# The local GRApplyPulidFlux cleanup skips UnloadAllModels so Qwen and Krea
# stay in VRAM across the three-stage booth graph.
COPY ["custom nodes/ComfyUI-PuLID-Flux-GR", "./ComfyUI-PuLID-Flux-GR"]

RUN git clone --depth 1 https://github.com/Gourieff/ComfyUI-ReActor.git

# InsightFace builds a Cython extension; the base image has no g++.
RUN apt-get update \
 && apt-get install -y --no-install-recommends build-essential g++ python3-dev \
 && rm -rf /var/lib/apt/lists/*

# Install node Python deps without touching the base image torch/CUDA stack.
# InsightFace + onnxruntime-gpu is the fragile part of this image.
RUN pip install --no-cache-dir cython \
 && pip install --no-cache-dir \
      insightface==0.7.3 \
      onnx==1.16.2 \
      onnxruntime-gpu==1.19.2 \
      facexlib \
      ftfy \
      timm \
      filterpy \
      opencv-python-headless \
      albumentations>=1.4.16 \
      ultralytics \
      segment_anything

COPY worker/extra_model_paths.yaml /comfyui/extra_model_paths.yaml
COPY worker/scripts/check-nodes.py /usr/local/bin/check-booth-nodes.py
COPY worker/required_nodes.txt /comfyui/required_nodes.txt

WORKDIR /comfyui
