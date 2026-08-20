# Render + Atlas + S3

The booth app is one Next.js service in `web/`. GPU stays on RunPod. Photos go to S3. Data goes to MongoDB Atlas.

## Render web service

- Root directory: `web` (or set build/start to run from `web/`)
- Build: `npm install && npx prisma generate && npm run build`
- Start: `npm start`
- Node 20+

Required env:

```text
DATABASE_URL=mongodb+srv://USER:PASS@CLUSTER/booth
APP_URL=https://YOUR-SERVICE.onrender.com
AUTH_URL=https://YOUR-SERVICE.onrender.com
WEBHOOK_SECRET=
AUTH_SECRET=
ADMIN_BOOTSTRAP_EMAIL=
ADMIN_BOOTSTRAP_PASSWORD=
SUPERADMIN_CREDITS=10000
RUNPOD_API_KEY=
RUNPOD_ENDPOINT_ID=
OPENAI_API_KEY=
MOCK_RUNPOD=false
MOCK_DELIVERY=false
STORAGE_DRIVER=s3
S3_ENDPOINT=
S3_REGION=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_BUCKET=
S3_PREFIX=ai-photo-booth
SENDGRID_API_KEY=
EMAIL_FROM=Lumetry AI Booth <booth@yourdomain>
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
```

`APP_URL` and `AUTH_URL` must be the public HTTPS origin (not localhost). RunPod POSTs `/api/webhooks/runpod?secret=WEBHOOK_SECRET`.

Keep the S3 bucket private. Guests load images through `/r/[token]` and `/api/r/[token]/image`. CORS on the bucket is not required.

## MongoDB Atlas

Prisma’s Mongo connector needs a replica set. Atlas provides one. Use the `mongodb+srv://` URI and include the database name (`/booth`).

The first request after deploy creates the bootstrap admin if `AdminUser` is empty.

## Cron

Create a Render cron job every 5–10 minutes:

```text
POST https://YOUR-SERVICE.onrender.com/api/cron/retry-delivery
Header: x-cron-secret: WEBHOOK_SECRET
```

## Local Mongo

From the repo root:

```bash
docker compose up -d
cd web
npx prisma generate
npx prisma db push
npm run dev
```

`DATABASE_URL` for Docker: `mongodb://127.0.0.1:27018/booth?replicaSet=rs0&directConnection=true` (host port 27018 so it does not collide with a local Mongo on 27017).

Admin: `http://localhost:3000/admin`. Open a kiosk from an event’s settings after signing in.
