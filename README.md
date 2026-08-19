# Lumetry AI Booth

Capture a guest photo, run the ComfyUI graph on RunPod serverless, then email and/or text a 48-hour result link.

## Layout

- [`workflows/booth-api.json`](workflows/booth-api.json) — worker-ready ComfyUI API graph
- [`custom nodes/ComfyUI-PuLID-Flux-GR`](custom%20nodes/ComfyUI-PuLID-Flux-GR) — slightly customized PuLID (baked into the worker; do not replace with upstream)
- [`worker/`](worker/) — custom `worker-comfyui` Docker image (nodes only; models on a volume)
- [`web/`](web/) — kiosk, admin, job processor, webhook, delivery
- [`docs/RUNPOD.md`](docs/RUNPOD.md) — image build, volume, endpoint, smoke tests
- [`docs/RENDER.md`](docs/RENDER.md) — Render, MongoDB Atlas, S3, SendGrid, cron
- [`docs/LICENSES.md`](docs/LICENSES.md) — Flux Krea / InsightFace commercial gates and 48GB GPU sizing

Original desktop export: [`flux_krea_pulid_qwen2511.json`](flux_krea_pulid_qwen2511.json).

## 1. Prove the worker

```bash
node scripts/validate-workflow.mjs
```

Then follow [`docs/RUNPOD.md`](docs/RUNPOD.md): build from the repo root with `-f worker/Dockerfile` (so the local PuLID node is copied), fill a ~50GB network volume, attach it to a **48GB** endpoint with **1 active worker**.

## 2. Run the booth app locally

```bash
docker compose up -d
cd web
copy .env.example .env
npx prisma generate
npx prisma db push
npm run dev
```

Mongo must be a replica set (the compose file initiates `rs0` on host port **27018**). Open:

- Admin: `http://localhost:3000/admin` (bootstrap email/password from `.env`; that account is the superadmin)
- Users: `http://localhost:3000/admin/users` (superadmin invite, roles, and credits)
- Kiosk: sign in, then **Open kiosk** from an event’s settings (`/kiosk/[eventId]`)
- GPU test lab: `http://localhost:3000/test` (admin session required)

Each capture or regenerate spends **1 credit** from the signed-in user’s balance. Superadmins invite people as regular users, grant credits, and can promote other active users to superadmin.

With `MOCK_RUNPOD=true` the original photo is treated as the result after a short delay, and the result link is logged instead of emailed/texted.

## 3. Production

1. Confirm licenses in [`docs/LICENSES.md`](docs/LICENSES.md) before a paid event.
2. Follow [`docs/RENDER.md`](docs/RENDER.md): Atlas Mongo, S3, SendGrid, Twilio, RunPod webhook URL.
3. Set events **live** in admin and add themes. Guests only see theme titles.

Retry failed email/SMS from the admin job list, or:

```bash
curl -X POST http://localhost:3000/api/cron/retry-delivery -H "x-cron-secret: $WEBHOOK_SECRET"
```
