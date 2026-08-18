import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

type WorkflowNode = {
  class_type: string;
  inputs: Record<string, unknown>;
  _meta?: { title?: string };
};

export type BoothWorkflow = Record<string, WorkflowNode>;

const GUEST_IMAGE = "guest.jpg";

export function loadBoothWorkflow(): BoothWorkflow {
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

  return JSON.parse(readFileSync(file, "utf8")) as BoothWorkflow;
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 1_000_000_000_000);
}

export function buildRunpodWorkflow(options?: {
  imageName?: string;
  kreaSeed?: number;
  qwenSeed?: number;
}): { workflow: BoothWorkflow; kreaSeed: number; qwenSeed: number; imageName: string } {
  const workflow = structuredClone(loadBoothWorkflow());
  const imageName = options?.imageName ?? GUEST_IMAGE;
  const kreaSeed = options?.kreaSeed ?? randomSeed();
  const qwenSeed = options?.qwenSeed ?? randomSeed();

  if (!workflow["120"] || !workflow["247"] || !workflow["289"]) {
    throw new Error("booth-api.json is missing injectable nodes 120/247/289");
  }

  workflow["120"].inputs.image = imageName;
  workflow["247"].inputs.seed = kreaSeed;
  workflow["289"].inputs.seed = qwenSeed;

  return { workflow, kreaSeed, qwenSeed, imageName };
}
