import { buildRunpodWorkflow, type BoothWorkflow } from "./workflow";
import { publicAppUrl } from "./public-url";

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
  const url = publicAppUrl();
  if (url) return url;
  return process.env.NODE_ENV === "production" ? "" : "http://localhost:3000";
}

export function webhookUrl() {
  const secret = process.env.WEBHOOK_SECRET;
  const base = `${appUrl()}/api/webhooks/runpod`;
  return secret ? `${base}?secret=${encodeURIComponent(secret)}` : base;
}

export function webhookReachable() {
  try {
    const parsed = new URL(appUrl());
    if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
      return false;
    }
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function mockRunpod() {
  return process.env.MOCK_RUNPOD === "true" || !process.env.RUNPOD_API_KEY;
}

export async function submitRunpodJob(options: {
  imageBase64: string;
  kreaSeed?: number;
  qwenSeed?: number;
  qwenPrompt?: string;
  kreaPrompt?: string;
  batch?: number;
  forceLive?: boolean;
  skipWebhook?: boolean;
}): Promise<
  RunpodSubmitResult & {
    kreaSeed: number;
    qwenSeed: number;
    batch: number;
    workflow: BoothWorkflow;
  }
> {
  const qwenPrompt = options.qwenPrompt?.trim() || "";
  const kreaPrompt = options.kreaPrompt?.trim() || undefined;

  const built = buildRunpodWorkflow({
    kreaSeed: options.kreaSeed,
    qwenSeed: options.qwenSeed,
    qwenPrompt: qwenPrompt || undefined,
    kreaPrompt,
    batch: options.batch,
  });

  if (mockRunpod() && !options.forceLive) {
    return {
      id: `mock_${crypto.randomUUID()}`,
      mocked: true,
      kreaSeed: built.kreaSeed,
      qwenSeed: built.qwenSeed,
      batch: built.batch,
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
      ...(options.skipWebhook || !webhookReachable() ? {} : { webhook: webhookUrl() }),
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
    batch: built.batch,
    workflow: built.workflow,
  };
}

export type RunpodJobStatus = {
  id: string;
  status: string;
  error?: string;
  images: Array<{ filename: string; url: string }>;
};

export async function getRunpodJobStatus(jobId: string): Promise<RunpodJobStatus> {
  const endpointId = process.env.RUNPOD_ENDPOINT_ID;
  const apiKey = process.env.RUNPOD_API_KEY;
  if (!endpointId || !apiKey) {
    throw new Error("RUNPOD_ENDPOINT_ID and RUNPOD_API_KEY are required");
  }

  const response = await fetch(
    `https://api.runpod.ai/v2/${endpointId}/status/${jobId}`,
    { headers: { Authorization: `Bearer ${apiKey}` } },
  );
  const json = (await response.json()) as {
    id?: string;
    status?: string;
    error?: string;
    output?: {
      images?: Array<{ filename?: string; type?: string; data?: string }>;
      errors?: string[];
    };
  };
  if (!response.ok) {
    throw new Error(json.error || `RunPod status failed (${response.status})`);
  }

  const images = (json.output?.images ?? [])
    .filter((image) => image.data)
    .map((image, index) => {
      const data = image.data as string;
      const filename = image.filename || `output-${index}.png`;
      if (image.type === "s3_url" || /^https?:\/\//.test(data)) {
        return { filename, url: data };
      }
      const stripped = data.replace(/^data:image\/\w+;base64,/, "");
      return { filename, url: `data:image/png;base64,${stripped}` };
    });

  return {
    id: json.id || jobId,
    status: json.status || "UNKNOWN",
    error: json.error || json.output?.errors?.join("; "),
    images,
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
