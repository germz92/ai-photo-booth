# AI Photo Booth

Capture a guest photo, run the ComfyUI graph on RunPod serverless, then email and/or text a 48-hour result link.

## Layout

- [`workflows/booth-api.json`](workflows/booth-api.json) — worker-ready ComfyUI API graph
- [`custom nodes/ComfyUI-PuLID-Flux-GR`](custom%20nodes/ComfyUI-PuLID-Flux-GR) — slightly customized PuLID (baked into the worker; do not replace with upstream)
- [`worker/`](worker/) — custom `worker-comfyui` Docker image (nodes only; models on a volume)
- [`web/`](web/) — kiosk capture page, job processor, webhook, delivery
- [`docs/RUNPOD.md`](docs/RUNPOD.md) — image build, volume, endpoint, smoke tests
- [`docs/LICENSES.md`](docs/LICENSES.md) — Flux Krea / InsightFace commercial gates and 48GB GPU sizing

Original desktop export: [`flux_krea_pulid_qwen2511.json`](flux_krea_pulid_qwen2511.json).

## 1. Prove the worker

```bash
node scripts/validate-workflow.mjs
```

Then follow [`docs/RUNPOD.md`](docs/RUNPOD.md): build from the repo root with `-f worker/Dockerfile` (so the local PuLID node is copied), fill a ~50GB network volume, attach it to a **48GB** endpoint with **1 active worker**.

## 2. Run the booth app locally

```bash
cd web
copy .env.example .env
npx prisma generate
npx prisma db push
npm run dev
```

The default database is SQLite (`file:./dev.db`) so the kiosk runs without Docker. For Postgres, start `docker compose up -d`, switch `prisma/schema.prisma` to `provider = "postgresql"`, and set `DATABASE_URL=postgresql://booth:booth@localhost:5432/booth`.

Open `http://localhost:3000`. With `MOCK_RUNPOD=true` the original photo is treated as the result after a short delay, and the result link is logged instead of emailed/texted.

## 3. Production

1. Confirm licenses in [`docs/LICENSES.md`](docs/LICENSES.md) before a paid event.
2. Set `MOCK_RUNPOD=false` and fill `RUNPOD_*`.
3. Set `APP_URL` to the public HTTPS origin so RunPod can POST `/api/webhooks/runpod?secret=...`.
4. Set Resend and/or Twilio keys. Either channel can be omitted; guests must provide at least one contact method.
5. Use `STORAGE_DRIVER=s3` (Cloudflare R2 or S3) so originals and outputs are not stuck on one machine.

Retry failed email/SMS independently:

```bash
curl -X POST http://localhost:3000/api/jobs/JOB_ID/resend
curl -X POST http://localhost:3000/api/cron/retry-delivery -H "x-cron-secret: $WEBHOOK_SECRET"
```
