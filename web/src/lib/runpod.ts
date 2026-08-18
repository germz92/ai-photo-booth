import { buildRunpodWorkflow, type BoothWorkflow } from "./workflow";

export type RunpodSubmitResult = { id: string; mocked: boolean };

type RunpodImage = {
  filename?: string;
  type?: string;
  data?: string;
};

export type RunpodWebhookPayload = {
  id?: string;
  status?: string;
  output?: {
    images?: RunpodImage[];
    errors?: string[];
  };
  error?: string;
};

export function appUrl() {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function webhookUrl() {
  const secret = process.env.WEBHOOK_SECRET;
  const base = `${appUrl()}/api/webhooks/runpod`;
  return secret ? `${base}?secret=${encodeURIComponent(secret)}` : base;
}

export function mockRunpod() {
  return process.env.MOCK_RUNPOD === "true" || !process.env.RUNPOD_API_KEY;
}

export async function submitRunpodJob(options: {
  imageBase64: string;
  kreaSeed?: number;
  qwenSeed?: number;
}): Promise<
  RunpodSubmitResult & {
    kreaSeed: number;
    qwenSeed: number;
    workflow: BoothWorkflow;
  }
> {
  const built = buildRunpodWorkflow({
    kreaSeed: options.kreaSeed,
    qwenSeed: options.qwenSeed,
  });

  if (mockRunpod()) {
    return {
      id: `mock_${crypto.randomUUID()}`,
      mocked: true,
      kreaSeed: built.kreaSeed,
      qwenSeed: built.qwenSeed,
      workflow: built.workflow,
    };
  }

  const endpointId = process.env.RUNPOD_ENDPOINT_ID;
  const apiKey = process.env.RUNPOD_API_KEY;
  if (!endpointId || !apiKey) {
    throw new Error("RUNPOD_ENDPOINT_ID and RUNPOD_API_KEY are required");
  }

  const response = await fetch(`https://api.runpod.ai/v2/${endpointId}/run`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: {
        workflow: built.workflow,
        images: [
          {
            name: built.imageName,
            image: options.imageBase64,
          },
        ],
      },
      webhook: webhookUrl(),
    }),
  });

  const json = (await response.json()) as { id?: string; error?: string };
  if (!response.ok || !json.id) {
    throw new Error(json.error || `RunPod /run failed (${response.status})`);
  }

  return {
    id: json.id,
    mocked: false,
    kreaSeed: built.kreaSeed,
    qwenSeed: built.qwenSeed,
    workflow: built.workflow,
  };
}

export async function decodeRunpodImage(
  image: RunpodImage,
): Promise<{ buffer: Buffer; contentType: string }> {
  if (!image.data) throw new Error("RunPod image payload was empty");

  if (image.type === "s3_url" || /^https?:\/\//.test(image.data)) {
    const response = await fetch(image.data);
    if (!response.ok) throw new Error(`Failed to download ${image.data}`);
    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      contentType: response.headers.get("content-type") || "image/png",
    };
  }

  const stripped = image.data.replace(/^data:image\/\w+;base64,/, "");
  return {
    buffer: Buffer.from(stripped, "base64"),
    contentType: "image/png",
  };
}
