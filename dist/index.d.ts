/**
 * @frontier-compute/zap1 - ZAP1 Merkle proof verification (WASM-powered)
 */

/** Initialize the WASM module. Called automatically on first use. */
export function init(): Promise<void>;

/** All 9 deployed ZAP1 event types. */
export const EVENT_TYPES: readonly string[];

/** Event-specific payload for computeLeafHash. */
export interface LeafPayload {
  walletHash?: string;
  serialNumber?: string;
  facilityId?: string;
  contractSha256?: string;
  oldWalletHash?: string;
  newWalletHash?: string;
  timestamp?: number;
  month?: number;
  year?: number;
  rootHash?: string;
}

/** One step in a Merkle inclusion proof. */
export interface ProofStep {
  hash: string;
  position: "left" | "right";
}

/** Anchor transaction reference. */
export interface Anchor {
  txid: string;
  height: number;
}

/** Leaf metadata from the API. */
export interface LeafInfo {
  hash: string;
  event_type: string;
  wallet_hash?: string;
  serial_number?: string;
  created_at?: string;
}

/** Normalized proof bundle. */
export interface ProofBundle {
  leaf_hash: string;
  proof: ProofStep[];
  root: string;
  anchor: Anchor | null;
  leaf: LeafInfo | null;
  protocol: string;
  version: string;
}

/** Raw proof bundle as returned by the API. */
export interface RawBundle {
  leaf_hash?: string;
  leaf?: LeafInfo & { hash: string };
  proof: ProofStep[];
  root: string | { hash: string };
  anchor?: Anchor;
  protocol?: string;
  version?: string;
}

/**
 * Compute the leaf hash for an ZAP1 event.
 * Returns null for event types not yet supported client-side.
 */
export function computeLeafHash(
  eventType: string,
  payload: LeafPayload
): Promise<string | null>;

/**
 * Verify a Merkle inclusion proof.
 * Bundle must have leaf_hash, proof, and root fields.
 */
export function verifyProof(bundle: ProofBundle): Promise<boolean>;

/**
 * Compute a Merkle node hash: BLAKE2b-256("NordicShield_MRK", left || right).
 */
export function nodeHash(leftHex: string, rightHex: string): Promise<string>;

/**
 * Parse a proof bundle from JSON or an object. Normalizes the structure.
 */
export function parseBundle(input: string | RawBundle): ProofBundle;
