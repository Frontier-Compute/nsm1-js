import assert from "node:assert";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Pre-init WASM with initSync so we skip the fetch() path that fails in Node
const __dirname = dirname(fileURLToPath(import.meta.url));
const wasmJs = await import(join(__dirname, "..", "wasm", "zap1_verify_wasm.js"));
const wasmBytes = readFileSync(join(__dirname, "..", "wasm", "zap1_verify_wasm_bg.wasm"));
wasmJs.initSync({ module: wasmBytes });

import {
  init,
  EVENT_TYPES,
  computeLeafHash,
  nodeHash,
  verifyProof,
  parseBundle,
} from "../src/index.js";

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (e) {
    failed++;
    console.error(`  FAIL  ${name}`);
    console.error(`        ${e.message}`);
  }
}

// Test vectors from zap1-verify/src/lib.rs (E2E_PROOF_20260327)
const LEAF1 = "075b00df286038a7b3f6bb70054df61343e3481fba579591354a00214e9e019b";
const LEAF2 = "de62554ad3867a59895befa7216686c923fc86245231e8fb6bd709a20e1fd133";
const ROOT  = "024e36515ea30efc15a0a7962dd8f677455938079430b9eab174f46a4328a07a";

console.log("zap1-js tests\n");

// Init
await test("init() completes without error", async () => {
  await init();
});

await test("init() is idempotent", async () => {
  await init();
  await init();
});

// EVENT_TYPES
await test("EVENT_TYPES has 9 entries", () => {
  assert.strictEqual(EVENT_TYPES.length, 9);
});

await test("EVENT_TYPES first and last", () => {
  assert.strictEqual(EVENT_TYPES[0], "PROGRAM_ENTRY");
  assert.strictEqual(EVENT_TYPES[8], "MERKLE_ROOT");
});

// computeLeafHash - PROGRAM_ENTRY
await test("computeLeafHash PROGRAM_ENTRY - e2e vector", async () => {
  const hash = await computeLeafHash("PROGRAM_ENTRY", {
    walletHash: "e2e_wallet_20260327",
  });
  assert.strictEqual(hash, LEAF1);
});

await test("computeLeafHash PROGRAM_ENTRY - wallet_abc vector", async () => {
  const hash = await computeLeafHash("PROGRAM_ENTRY", {
    walletHash: "wallet_abc",
  });
  assert.strictEqual(
    hash,
    "344a05bf81faf6e2d54a0e52ea0267aff0244998eb1ee27adf5627413e92f089"
  );
});

// computeLeafHash - OWNERSHIP_ATTEST
await test("computeLeafHash OWNERSHIP_ATTEST - e2e vector", async () => {
  const hash = await computeLeafHash("OWNERSHIP_ATTEST", {
    walletHash: "e2e_wallet_20260327",
    serialNumber: "Z15P-E2E-001",
  });
  assert.strictEqual(hash, LEAF2);
});

await test("computeLeafHash OWNERSHIP_ATTEST - wallet_abc vector", async () => {
  const hash = await computeLeafHash("OWNERSHIP_ATTEST", {
    walletHash: "wallet_abc",
    serialNumber: "Z15P-2026-001",
  });
  assert.strictEqual(
    hash,
    "5d77b9a3435948a98099267e510a14663cc0fa80afd2a3ee5fb4363f6ecdfa13"
  );
});

// computeLeafHash - unsupported type returns null
await test("computeLeafHash unsupported type returns null", async () => {
  const hash = await computeLeafHash("DEPLOYMENT", { serialNumber: "x" });
  assert.strictEqual(hash, null);
});

// nodeHash
await test("nodeHash - e2e root vector", async () => {
  const root = await nodeHash(LEAF1, LEAF2);
  assert.strictEqual(root, ROOT);
});

await test("nodeHash is not commutative", async () => {
  const ab = await nodeHash(LEAF1, LEAF2);
  const ba = await nodeHash(LEAF2, LEAF1);
  assert.notStrictEqual(ab, ba);
});

// verifyProof
await test("verifyProof - leaf1 with leaf2 sibling right", async () => {
  const valid = await verifyProof({
    leaf_hash: LEAF1,
    proof: [{ hash: LEAF2, position: "right" }],
    root: ROOT,
  });
  assert.strictEqual(valid, true);
});

await test("verifyProof - leaf2 with leaf1 sibling left", async () => {
  const valid = await verifyProof({
    leaf_hash: LEAF2,
    proof: [{ hash: LEAF1, position: "left" }],
    root: ROOT,
  });
  assert.strictEqual(valid, true);
});

await test("verifyProof - wrong root returns false", async () => {
  const valid = await verifyProof({
    leaf_hash: LEAF1,
    proof: [{ hash: LEAF2, position: "right" }],
    root: "ff".repeat(32),
  });
  assert.strictEqual(valid, false);
});

await test("verifyProof - empty proof, leaf is root", async () => {
  const valid = await verifyProof({
    leaf_hash: LEAF1,
    proof: [],
    root: LEAF1,
  });
  assert.strictEqual(valid, true);
});

// parseBundle - flat input
await test("parseBundle normalizes flat input", () => {
  const bundle = parseBundle({
    leaf_hash: LEAF1,
    proof: [{ hash: LEAF2, position: "right" }],
    root: ROOT,
  });
  assert.strictEqual(bundle.leaf_hash, LEAF1);
  assert.strictEqual(bundle.root, ROOT);
  assert.strictEqual(bundle.proof.length, 1);
  assert.strictEqual(bundle.proof[0].hash, LEAF2);
  assert.strictEqual(bundle.proof[0].position, "right");
  assert.strictEqual(bundle.protocol, "ZAP1");
  assert.strictEqual(bundle.version, "1");
});

// parseBundle - nested API response
await test("parseBundle normalizes nested API response", () => {
  const bundle = parseBundle({
    leaf: { hash: LEAF1, event_type: "PROGRAM_ENTRY" },
    proof: [{ hash: LEAF2, position: "right" }],
    root: { hash: ROOT },
    anchor: { txid: "abc123", height: 100 },
    protocol: "ZAP1",
    version: "2",
  });
  assert.strictEqual(bundle.leaf_hash, LEAF1);
  assert.strictEqual(bundle.root, ROOT);
  assert.strictEqual(bundle.anchor.txid, "abc123");
  assert.strictEqual(bundle.leaf.hash, LEAF1);
  assert.strictEqual(bundle.version, "2");
});

// parseBundle - JSON string
await test("parseBundle handles JSON string input", () => {
  const json = JSON.stringify({
    leaf_hash: LEAF1,
    proof: [],
    root: ROOT,
  });
  const bundle = parseBundle(json);
  assert.strictEqual(bundle.leaf_hash, LEAF1);
  assert.strictEqual(bundle.root, ROOT);
});

// parseBundle - defaults
await test("parseBundle defaults for missing fields", () => {
  const bundle = parseBundle({ leaf_hash: LEAF1, proof: [], root: ROOT });
  assert.strictEqual(bundle.anchor, null);
  assert.strictEqual(bundle.leaf, null);
  assert.strictEqual(bundle.protocol, "ZAP1");
  assert.strictEqual(bundle.version, "1");
});

// Summary
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
