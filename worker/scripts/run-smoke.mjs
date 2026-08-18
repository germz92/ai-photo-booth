#!/usr/bin/env node
/**
 * Submit one async /run job to a live RunPod endpoint.
 * Requires RUNPOD_API_KEY, RUNPOD_ENDPOINT_ID, and SMOKE_IMAGE (path to a JPEG < 5MB).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const apiKey = process.env.RUNPOD_API_KEY;
const endpointId = process.env.RUNPOD_ENDPOINT_ID;
const imagePath = process.env.SMOKE_IMAGE;

if (!apiKey || !endpointId || !imagePath) {
  console.error("Set RUNPOD_API_KEY, RUNPOD_ENDPOINT_ID, and SMOKE_IMAGE");
  process.exit(1);
}

const workflow = JSON.parse(
  readFileSync(join(root, "workflows", "booth-api.json"), "utf8"),
);
workflow["247"].inputs.seed = Date.now() % 1_000_000_000;
workflow["289"].inputs.seed = (Date.now() * 7) % 1_000_000_000;
workflow["120"].inputs.image = "guest.jpg";

const image = readFileSync(imagePath).toString("base64");
const body = {
  input: {
    workflow,
    images: [{ name: "guest.jpg", image }],
  },
};

const res = await fetch(`https://api.runpod.ai/v2/${endpointId}/run`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(body),
});

const json = await res.json();
if (!res.ok) {
  console.error(json);
  process.exit(1);
}

console.log("submitted", json.id || json);
console.log(`poll: https://api.runpod.ai/v2/${endpointId}/status/${json.id}`);
