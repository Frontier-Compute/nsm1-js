/**
 * @frontiercompute/zap1 - strict ZAP1 Merkle-bundle verification.
 *
 * This module verifies consistency against a supplied root. Anchor metadata is
 * not treated as proof of transaction existence or encrypted-memo binding.
 */

import {
  bytesToHex,
  commitRoot as commitRootBytes,
  computeLeafHash as computeLeafHashBytes,
  COUNT_BOUND_SCHEME,
  hexToBytes,
  LEGACY_ROOT_MAX_ANCHOR_HEIGHT,
  LEGACY_SCHEME,
  nodeHash as nodeHashBytes,
  walkProof,
} from "./blake2b.js";

export { COUNT_BOUND_SCHEME, LEGACY_ROOT_MAX_ANCHOR_HEIGHT, LEGACY_SCHEME };

export const EVENT_TYPES = Object.freeze([
  "PROGRAM_ENTRY",
  "OWNERSHIP_ATTEST",
  "CONTRACT_ANCHOR",
  "DEPLOYMENT",
  "HOSTING_PAYMENT",
  "SHIELD_RENEWAL",
  "TRANSFER",
  "EXIT",
  "MERKLE_ROOT",
  "STAKING_DEPOSIT",
  "STAKING_WITHDRAW",
  "STAKING_REWARD",
  "GOVERNANCE_PROPOSAL",
  "GOVERNANCE_VOTE",
  "GOVERNANCE_RESULT",
  "AGENT_REGISTER",
  "AGENT_POLICY",
  "AGENT_ACTION",
]);

export const LEAF_HASH_TYPES = Object.freeze([
  "PROGRAM_ENTRY",
  "OWNERSHIP_ATTEST",
]);

/** Compatibility no-op retained for callers of 0.1.x. */
export async function init() {}

function requireHex32(value, label) {
  if (typeof value !== "string" || !/^[0-9a-fA-F]{64}$/.test(value)) {
    throw new TypeError(`${label} must be exactly 32 bytes of hex`);
  }
  return value.toLowerCase();
}

function requirePlainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`${label} must be a plain object`);
  }
  return value;
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function normalizeLeafCount(value, label = "leaf_count") {
  let count;
  if (typeof value === "bigint") {
    count = value;
  } else if (typeof value === "number" && Number.isSafeInteger(value)) {
    count = BigInt(value);
  } else {
    throw new TypeError(`${label} must be a safe integer number or bigint`);
  }
  if (count <= 0n) throw new RangeError(`${label} must be positive`);
  if (count > 0xffffffffffffffffn) {
    throw new RangeError(`${label} exceeds u64`);
  }
  return count;
}

function normalizeOptionalCount(value, label) {
  return value === null ? null : normalizeLeafCount(value, label);
}

function normalizeOptionalScheme(value, label) {
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new TypeError(`${label} must be a string or null`);
  }
  return value;
}

/**
 * Validate that a sibling path can exist in the deployed carry-up tree shape.
 * Odd final nodes advance unchanged and therefore consume no proof step.
 */
function hasPossibleCountBoundPath(leafCount, proof) {
  let width = normalizeLeafCount(leafCount);
  const lowerWidths = [];
  while (width > 1n) {
    lowerWidths.push(width);
    width = (width + 1n) / 2n;
  }

  let parentIndex = 0n;
  let proofIndex = proof.length - 1;
  for (let layer = lowerWidths.length - 1; layer >= 0; layer--) {
    const lowerWidth = lowerWidths[layer];
    const lastParentIndex = (lowerWidth - 1n) / 2n;
    if (lowerWidth % 2n === 1n && parentIndex === lastParentIndex) {
      parentIndex = lowerWidth - 1n;
      continue;
    }

    if (proofIndex < 0) return false;
    const position = proof[proofIndex--].position;
    const childIndex =
      position === "right" ? parentIndex * 2n : parentIndex * 2n + 1n;
    if (childIndex >= lowerWidth) return false;
    parentIndex = childIndex;
  }

  return proofIndex === -1;
}

/**
 * Validate a legacy duplicate-odd path and return the proof layers where the
 * sibling must be an exact duplicate of the current node.
 */
function legacyDuplicateLayers(leafCount, proof) {
  let width = normalizeLeafCount(leafCount);
  const lowerWidths = [];
  while (width > 1n) {
    lowerWidths.push(width);
    width = (width + 1n) / 2n;
  }
  if (proof.length !== lowerWidths.length) return null;

  let parentIndex = 0n;
  const duplicateLayers = [];
  for (let layer = lowerWidths.length - 1; layer >= 0; layer--) {
    const lowerWidth = lowerWidths[layer];
    const step = proof[layer];
    const lastParentIndex = (lowerWidth - 1n) / 2n;
    if (lowerWidth % 2n === 1n && parentIndex === lastParentIndex) {
      if (step.position !== "right") return null;
      parentIndex = lowerWidth - 1n;
      duplicateLayers.push(layer);
      continue;
    }

    const childIndex =
      step.position === "right"
        ? parentIndex * 2n
        : parentIndex * 2n + 1n;
    if (childIndex >= lowerWidth) return null;
    parentIndex = childIndex;
  }
  return duplicateLayers;
}

/**
 * Compute a typed leaf hash where a client-side formula is defined.
 * Returns null for a defined event type without a local formula.
 * Throws for an unknown event type or malformed supported payload.
 */
export async function computeLeafHash(eventType, payload) {
  if (typeof eventType !== "string" || !EVENT_TYPES.includes(eventType)) {
    throw new RangeError("unknown ZAP1 event type");
  }
  if (!LEAF_HASH_TYPES.includes(eventType)) return null;
  requirePlainObject(payload, "payload");
  const result = computeLeafHashBytes(
    eventType,
    payload.walletHash,
    payload.serialNumber,
  );
  return bytesToHex(result);
}

/** Compute a domain-separated Merkle node hash. */
export async function nodeHash(leftHex, rightHex) {
  const left = hexToBytes(requireHex32(leftHex, "left hash"));
  const right = hexToBytes(requireHex32(rightHex, "right hash"));
  return bytesToHex(nodeHashBytes(left, right));
}

/** Bind a raw tree root to a positive u64 leaf count. */
export function commitRoot(rawRootHex, leafCount) {
  const rawRoot = hexToBytes(requireHex32(rawRootHex, "raw root"));
  return bytesToHex(commitRootBytes(leafCount, rawRoot));
}

/**
 * Strictly normalize a flat or nested API proof bundle.
 * Malformed fields throw; no scheme or count is inferred.
 */
export function parseBundle(input) {
  const data = typeof input === "string" ? JSON.parse(input) : input;
  requirePlainObject(data, "bundle");

  const leafRecord =
    data.leaf === undefined || data.leaf === null
      ? null
      : requirePlainObject(data.leaf, "leaf");
  const nestedLeafHash =
    leafRecord && hasOwn(leafRecord, "hash")
      ? requireHex32(leafRecord.hash, "leaf.hash")
      : null;
  const flatLeafHash = hasOwn(data, "leaf_hash")
    ? requireHex32(data.leaf_hash, "leaf_hash")
    : null;
  if (
    nestedLeafHash !== null &&
    flatLeafHash !== null &&
    nestedLeafHash !== flatLeafHash
  ) {
    throw new TypeError("conflicting leaf hash representations");
  }
  const leafHash = nestedLeafHash ?? flatLeafHash;
  if (leafHash === null) throw new TypeError("leaf hash is required");

  if (!Array.isArray(data.proof)) throw new TypeError("proof must be an array");
  if (data.proof.length > 64) throw new RangeError("proof exceeds 64 steps");
  const proof = [];
  for (let index = 0; index < data.proof.length; index++) {
    if (!(index in data.proof)) throw new TypeError("proof must not contain holes");
    const step = requirePlainObject(data.proof[index], "proof step");
    if (step.position !== "left" && step.position !== "right") {
      throw new TypeError("proof position must be left or right");
    }
    proof.push({
      hash: requireHex32(step.hash, "proof sibling"),
      position: step.position,
    });
  }

  let rootHash;
  let leafCount = null;
  let rootScheme = null;
  if (typeof data.root === "string") {
    rootHash = requireHex32(data.root, "root");
    if (hasOwn(data, "leaf_count")) {
      normalizeOptionalCount(data.leaf_count, "leaf_count");
      leafCount = data.leaf_count;
    }
    if (hasOwn(data, "root_scheme")) {
      rootScheme = normalizeOptionalScheme(data.root_scheme, "root_scheme");
    }
  } else {
    const rootRecord = requirePlainObject(data.root, "root");
    rootHash = requireHex32(rootRecord.hash, "root.hash");

    const nestedCountPresent = hasOwn(rootRecord, "leaf_count");
    const flatCountPresent = hasOwn(data, "leaf_count");
    const nestedCount = nestedCountPresent
      ? normalizeOptionalCount(rootRecord.leaf_count, "root.leaf_count")
      : null;
    const flatCount = flatCountPresent
      ? normalizeOptionalCount(data.leaf_count, "leaf_count")
      : null;
    if (
      nestedCountPresent &&
      flatCountPresent &&
      nestedCount !== flatCount
    ) {
      throw new TypeError("conflicting leaf_count representations");
    }
    leafCount = nestedCountPresent
      ? rootRecord.leaf_count
      : flatCountPresent
        ? data.leaf_count
        : null;

    const nestedSchemePresent = hasOwn(rootRecord, "scheme");
    const flatSchemePresent = hasOwn(data, "root_scheme");
    const nestedScheme = nestedSchemePresent
      ? normalizeOptionalScheme(rootRecord.scheme, "root.scheme")
      : null;
    const flatScheme = flatSchemePresent
      ? normalizeOptionalScheme(data.root_scheme, "root_scheme")
      : null;
    if (
      nestedSchemePresent &&
      flatSchemePresent &&
      nestedScheme !== flatScheme
    ) {
      throw new TypeError("conflicting root scheme representations");
    }
    rootScheme = nestedSchemePresent ? nestedScheme : flatScheme;
  }
  if (hasOwn(data, "root_hash")) {
    const flatRootHash = requireHex32(data.root_hash, "root_hash");
    if (flatRootHash !== rootHash) {
      throw new TypeError("conflicting root hash representations");
    }
  }

  let anchor = null;
  if (data.anchor !== undefined && data.anchor !== null) {
    anchor = { ...requirePlainObject(data.anchor, "anchor") };
  }

  let protocol = null;
  if (hasOwn(data, "protocol")) {
    if (typeof data.protocol !== "string") {
      throw new TypeError("protocol must be a string");
    }
    protocol = data.protocol;
  }

  let version = null;
  if (hasOwn(data, "version")) {
    if (
      typeof data.version !== "string" &&
      !(typeof data.version === "number" && Number.isSafeInteger(data.version))
    ) {
      throw new TypeError("version must be a string or safe integer number");
    }
    version = String(data.version);
  }

  return {
    leaf_hash: leafHash,
    proof,
    root: rootHash,
    leaf_count: leafCount,
    root_scheme: rootScheme,
    anchor,
    leaf: leafRecord ? { ...leafRecord, hash: leafHash } : null,
    protocol,
    version,
  };
}

/**
 * Verify Merkle-bundle consistency.
 *
 * Current bundles require the exact COUNT_BOUND_V2 scheme and a positive leaf
 * count. Historical legacy verification is opt-in and height-gated.
 */
export async function verifyProof(input, options = {}) {
  requirePlainObject(options, "options");
  const bundle = parseBundle(input);

  if (bundle.protocol !== null && bundle.protocol !== "ZAP1") return false;

  if (bundle.root_scheme === COUNT_BOUND_SCHEME) {
    if (bundle.version !== null && bundle.version !== "2") return false;
    if (bundle.leaf_count === null || bundle.leaf_count === undefined) return false;
    if (!hasPossibleCountBoundPath(bundle.leaf_count, bundle.proof)) return false;
    const walked = walkProof(
      bundle.leaf_hash,
      bundle.proof,
      bundle.leaf_count,
    );
    return walked.computedRoot === bundle.root;
  }

  if (bundle.root_scheme === LEGACY_SCHEME) {
    if (bundle.version !== null && bundle.version !== "2") return false;
    if (options.allowHistoricalLegacy !== true) return false;
    if (bundle.leaf_count === null || bundle.leaf_count === undefined) return false;
    const height = bundle.anchor?.height;
    if (
      typeof height !== "number" ||
      !Number.isSafeInteger(height) ||
      height <= 0 ||
      height > LEGACY_ROOT_MAX_ANCHOR_HEIGHT
    ) {
      return false;
    }
    const duplicateLayers = legacyDuplicateLayers(
      bundle.leaf_count,
      bundle.proof,
    );
    if (duplicateLayers === null) return false;
    const walked = walkProof(bundle.leaf_hash, bundle.proof);
    for (const layer of duplicateLayers) {
      if (walked.steps[layer].left !== walked.steps[layer].right) return false;
    }
    return walked.legacyRoot === bundle.root;
  }

  return false;
}
