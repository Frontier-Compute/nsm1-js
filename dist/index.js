/**
 * @frontier-compute/zap1  - ZAP1 Merkle proof verification (WASM-powered)
 *
 * Wraps the zap1-verify Rust crate compiled to WebAssembly.
 * BLAKE2b-256 with NordicShield personalizations, Merkle proof walking,
 * and leaf hash computation for all 9 deployed ZAP1 event types.
 */

let wasmModule = null;
let initPromise = null;

/**
 * Initialize the WASM module. Called automatically on first use.
 * Can be called explicitly to preload.
 * @returns {Promise<void>}
 */
export async function init() {
  if (wasmModule) return;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const wasm = await import("../wasm/zap1_verify_wasm.js");
    const wasmUrl = new URL("../wasm/zap1_verify_wasm_bg.wasm", import.meta.url);
    await wasm.default(wasmUrl);
    wasmModule = wasm;
  })();
  return initPromise;
}

async function ensureInit() {
  if (!wasmModule) await init();
}

// Event types

/** All 9 deployed ZAP1 event types. */
export const EVENT_TYPES = [
  "PROGRAM_ENTRY",
  "OWNERSHIP_ATTEST",
  "CONTRACT_ANCHOR",
  "DEPLOYMENT",
  "HOSTING_PAYMENT",
  "SHIELD_RENEWAL",
  "TRANSFER",
  "EXIT",
  "MERKLE_ROOT",
];

// Leaf hash computation

/**
 * Compute the leaf hash for an ZAP1 event.
 *
 * @param {string} eventType  - one of EVENT_TYPES
 * @param {object} payload  - event-specific fields
 * @returns {Promise<string>} 64-char hex leaf hash
 *
 * Supported payloads:
 *   PROGRAM_ENTRY:      { walletHash: string }
 *   OWNERSHIP_ATTEST:   { walletHash: string, serialNumber: string }
 *   (other types return null  - use verifyProof for path-only verification)
 */
export async function computeLeafHash(eventType, payload) {
  await ensureInit();
  switch (eventType) {
    case "PROGRAM_ENTRY":
      return wasmModule.computeProgramEntry(payload.walletHash);
    case "OWNERSHIP_ATTEST":
      return wasmModule.computeOwnershipAttest(
        payload.walletHash,
        payload.serialNumber
      );
    default:
      return null;
  }
}

// Proof verification

/**
 * Verify a Merkle inclusion proof.
 *
 * @param {object} bundle  - proof bundle from the API
 * @param {string} bundle.leaf_hash  - 64-char hex leaf hash
 * @param {Array<{hash: string, position: "left"|"right"}>} bundle.proof
 * @param {string} bundle.root  - 64-char hex expected root
 * @returns {Promise<boolean>}
 */
export async function verifyProof(bundle) {
  await ensureInit();
  return wasmModule.verifyProof({
    leaf_hash: bundle.leaf_hash,
    proof: bundle.proof,
    root: bundle.root,
  });
}

/**
 * Compute a Merkle node hash: BLAKE2b-256("NordicShield_MRK", left || right).
 *
 * @param {string} leftHex  - 64-char hex
 * @param {string} rightHex  - 64-char hex
 * @returns {Promise<string>} 64-char hex result
 */
export async function nodeHash(leftHex, rightHex) {
  await ensureInit();
  return wasmModule.nodeHash(leftHex, rightHex);
}

// Bundle parsing

/**
 * Parse a proof bundle from JSON (API response or downloaded file).
 * Normalizes the structure for use with verifyProof().
 *
 * @param {string|object} input  - JSON string or parsed object
 * @returns {object} Normalized bundle with leaf_hash, proof, root, anchor, leaf
 */
export function parseBundle(input) {
  const data = typeof input === "string" ? JSON.parse(input) : input;

  // Normalize: API returns nested objects
  const leafHash = data.leaf?.hash || data.leaf_hash;
  const proof = data.proof || [];
  const rootHash = data.root?.hash || data.root;
  const anchor = data.anchor || null;

  return {
    leaf_hash: leafHash,
    proof: proof.map((s) => ({
      hash: s.hash,
      position: s.position,
    })),
    root: rootHash,
    anchor,
    leaf: data.leaf || null,
    protocol: data.protocol || "ZAP1",
    version: data.version || "1",
  };
}
