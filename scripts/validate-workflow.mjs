#!/usr/bin/env node
/**
 * Offline smoke test for the API workflow.
 * Does not need a GPU. Exits 1 if the graph is not worker-ready.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const workflowPath = join(root, "workflows", "booth-api.json");
const requiredPath = join(root, "worker", "required_nodes.txt");

const workflow = JSON.parse(readFileSync(workflowPath, "utf8"));
const required = readFileSync(requiredPath, "utf8")
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#"));

const errors = [];
const classTypes = new Set();
let saveImageCount = 0;
let previewCount = 0;
let loadImageName = null;

for (const [id, node] of Object.entries(workflow)) {
  if (!node?.class_type) {
    errors.push(`node ${id} is missing class_type`);
    continue;
  }
  classTypes.add(node.class_type);
  const dump = JSON.stringify(node);
  if (dump.includes("\\\\")) {
    errors.push(`node ${id} still has Windows path separators`);
  }
  if (node.class_type === "PreviewImage") previewCount += 1;
  if (node.class_type === "SaveImage") saveImageCount += 1;
  if (id === "120") loadImageName = node.inputs?.image;
  if (id === "247" || id === "289") {
    if (typeof node.inputs?.seed !== "number") {
      errors.push(`node ${id} seed must be numeric so the processor can inject it`);
    }
  }
}

if (previewCount > 0) {
  errors.push(`found ${previewCount} PreviewImage node(s); worker jobs must only SaveImage`);
}
if (saveImageCount !== 1) {
  errors.push(`expected exactly 1 SaveImage node, found ${saveImageCount}`);
}
if (loadImageName !== "guest.jpg") {
  errors.push(`LoadImage node 120 must use guest.jpg, found ${loadImageName}`);
}

const present = [...classTypes];
for (const name of required) {
  if (!present.includes(name)) errors.push(`missing required class_type ${name}`);
}

const final = workflow["300"];
if (!final || final.class_type !== "SaveImage") {
  errors.push("node 300 must be SaveImage (final output)");
}
if (JSON.stringify(final?.inputs?.images) !== JSON.stringify(["257", 0])) {
  errors.push("SaveImage must take the ReActor output (node 257)");
}

if (errors.length) {
  console.error("WORKFLOW SMOKE TEST FAILED");
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log("OK: workflows/booth-api.json is worker-ready");
console.log(`  nodes: ${Object.keys(workflow).length}`);
console.log(`  class_types: ${classTypes.size}`);
console.log("  input: guest.jpg");
console.log("  output: SaveImage node 300 <- ReActor 257");
