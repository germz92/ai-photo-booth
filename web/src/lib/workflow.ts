import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

type WorkflowNode = {
  class_type: string;
  inputs: Record<string, unknown>;
  _meta?: { title?: string };
};

export type BoothWorkflow = Record<string, WorkflowNode>;

const GUEST_IMAGE = "guest.jpg";

let cachedWorkflow: BoothWorkflow | null = null;

export function loadBoothWorkflow(): BoothWorkflow {
  if (cachedWorkflow) return structuredClone(cachedWorkflow);

  const candidates = [
    process.env.WORKFLOW_PATH,
    path.join(process.cwd(), "../workflows/booth-api.json"),
    path.join(process.cwd(), "src/lib/booth-api.json"),
  ].filter((value): value is string => Boolean(value));

  const file = candidates.find((candidate) => existsSync(candidate));
  if (!file) {
    throw new Error(
      "Could not find workflows/booth-api.json. Set WORKFLOW_PATH or run the app from the web/ directory.",
    );
  }

  cachedWorkflow = JSON.parse(readFileSync(file, "utf8")) as BoothWorkflow;
  return structuredClone(cachedWorkflow);
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 1_000_000_000_000);
}

export const MIN_BATCH = 1;
export const MAX_BATCH = 4;
export const DEFAULT_BATCH = 4;

export function clampBatch(value: unknown, fallback = DEFAULT_BATCH): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(MAX_BATCH, Math.max(MIN_BATCH, Math.round(n)));
}

export function defaultQwenPrompt(): string {
  const workflow = loadBoothWorkflow();
  const prompt = workflow["284"]?.inputs?.prompt;
  return typeof prompt === "string" ? prompt : "";
}

export function defaultKreaPrompt(): string {
  const workflow = loadBoothWorkflow();
  const text = workflow["203"]?.inputs?.text;
  return typeof text === "string" ? text : "";
}

export function buildRunpodWorkflow(options?: {
  imageName?: string;
  kreaSeed?: number;
  qwenSeed?: number;
  qwenPrompt?: string;
  kreaPrompt?: string;
  batch?: number;
}): { workflow: BoothWorkflow; kreaSeed: number; qwenSeed: number; imageName: string; batch: number } {
  const workflow = structuredClone(loadBoothWorkflow());
  const imageName = options?.imageName ?? GUEST_IMAGE;
  const kreaSeed = options?.kreaSeed ?? randomSeed();
  const qwenSeed = options?.qwenSeed ?? randomSeed();
  const batch = clampBatch(options?.batch);

  if (!workflow["120"] || !workflow["203"] || !workflow["247"] || !workflow["289"] || !workflow["284"] || !workflow["291"]) {
    throw new Error("booth-api.json is missing injectable nodes 120/203/247/284/289/291");
  }

  workflow["120"].inputs.image = imageName;
  workflow["247"].inputs.seed = kreaSeed;
  workflow["289"].inputs.seed = qwenSeed;
  workflow["291"].inputs.amount = batch;
  if (typeof options?.qwenPrompt === "string" && options.qwenPrompt.trim()) {
    workflow["284"].inputs.prompt = options.qwenPrompt.trim();
  }
  if (typeof options?.kreaPrompt === "string" && options.kreaPrompt.trim()) {
    workflow["203"].inputs.text = options.kreaPrompt.trim();
  }

  return { workflow, kreaSeed, qwenSeed, imageName, batch };
}
