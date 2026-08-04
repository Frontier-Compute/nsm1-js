export type Zap1EventType =
  | "PROGRAM_ENTRY"
  | "OWNERSHIP_ATTEST"
  | "CONTRACT_ANCHOR"
  | "DEPLOYMENT"
  | "HOSTING_PAYMENT"
  | "SHIELD_RENEWAL"
  | "TRANSFER"
  | "EXIT"
  | "MERKLE_ROOT"
  | "STAKING_DEPOSIT"
  | "STAKING_WITHDRAW"
  | "STAKING_REWARD"
  | "GOVERNANCE_PROPOSAL"
  | "GOVERNANCE_VOTE"
  | "GOVERNANCE_RESULT"
  | "AGENT_REGISTER"
  | "AGENT_POLICY"
  | "AGENT_ACTION";

export const EVENT_TYPES: readonly Zap1EventType[];
export const LEAF_HASH_TYPES: readonly [
  "PROGRAM_ENTRY",
  "OWNERSHIP_ATTEST",
];
export const COUNT_BOUND_SCHEME: "ZAP1_COUNT_BOUND_V2";
export const LEGACY_SCHEME: "ZAP1_LEGACY_DUPLICATE_ODD";
export const LEGACY_ROOT_MAX_ANCHOR_HEIGHT: 3317133;

export interface LeafPayload {
  walletHash?: string;
  serialNumber?: string;
  [extra: string]: unknown;
}

export interface ProofStep {
  hash: string;
  position: "left" | "right";
}

/** Untrusted service metadata; not proof of memo binding. */
export interface AnchorReference {
  txid?: string | null;
  height?: number | null;
  [extra: string]: unknown;
}

export interface LeafInfo {
  hash: string;
  event_type?: string;
  wallet_hash?: string;
  serial_number?: string;
  created_at?: string;
  [extra: string]: unknown;
}

export interface ProofBundle {
  leaf_hash: string;
  proof: ProofStep[];
  root: string;
  leaf_count: number | bigint | null;
  root_scheme: string | null;
  anchor: AnchorReference | null;
  leaf: LeafInfo | null;
  protocol: string | null;
  version: string | null;
}

export interface RawBundle {
  leaf_hash?: string;
  leaf?: LeafInfo;
  proof: ProofStep[];
  root:
    | string
    | {
        hash: string;
        leaf_count?: number | bigint | null;
        scheme?: string | null;
        [extra: string]: unknown;
      };
  root_hash?: string;
  leaf_count?: number | bigint | null;
  root_scheme?: string | null;
  anchor?: AnchorReference | null;
  protocol?: string;
  version?: string | number;
  [extra: string]: unknown;
}

export interface VerifyOptions {
  allowHistoricalLegacy?: boolean;
}

/** Compatibility no-op retained for 0.1.x callers. */
export function init(): Promise<void>;

/**
 * Compute a typed leaf hash. Defined-but-unsupported types return null;
 * unknown types and malformed supported payloads reject.
 */
export function computeLeafHash(
  eventType: Zap1EventType | string,
  payload: LeafPayload,
): Promise<string | null>;

export function nodeHash(leftHex: string, rightHex: string): Promise<string>;
export function commitRoot(rawRootHex: string, leafCount: number | bigint): string;
export function parseBundle(input: string | RawBundle | ProofBundle): ProofBundle;

/** Verify consistency with a supplied root, not on-chain memo binding. */
export function verifyProof(
  bundle: string | RawBundle | ProofBundle,
  options?: VerifyOptions,
): Promise<boolean>;
