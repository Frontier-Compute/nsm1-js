# @frontiercompute/zap1

[![ci](https://github.com/Frontier-Compute/zap1-js/actions/workflows/ci.yml/badge.svg)](https://github.com/Frontier-Compute/zap1-js/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@frontiercompute/zap1)](https://www.npmjs.com/package/@frontiercompute/zap1)
![downloads](https://img.shields.io/npm/dw/@frontiercompute/zap1)
![license](https://img.shields.io/npm/l/@frontiercompute/zap1)

[**Dashboard**](https://frontiercompute.cash/dashboard.html) | [npm](https://www.npmjs.com/package/@frontiercompute/zap1) | [GitHub](https://github.com/Frontier-Compute/zap1-js)

Zero-runtime-dependency ZAP1 Merkle proof verification for JavaScript and
TypeScript. The cryptographic primitive is auditable JavaScript with no native
or WASM loader.
The verifier supports current `ZAP1_COUNT_BOUND_V2` proof bundles and an
explicitly gated historical legacy profile.

This package verifies Merkle-bundle consistency against a supplied root. It
does not prove that an encrypted Zcash memo contains that root, and it does not
prove the truth of the event represented by a leaf. A transaction ID is a
recorded reference until transaction existence and memo binding are checked by
separate evidence.

## Install

```bash
npm install @frontiercompute/zap1
```

## Usage

### Verify a proof bundle

```js
import { verifyProof, parseBundle } from "@frontiercompute/zap1";

const leafHash = "your_64_character_leaf_hash";
const res = await fetch(
  `https://api.frontiercompute.cash/verify/${leafHash}/proof.json`
);
const raw = await res.json();
const bundle = parseBundle(raw);

const valid = await verifyProof(bundle);
console.log(valid ? "BUNDLE CONSISTENT" : "BUNDLE INVALID");
```

### Compute a leaf hash

```js
import { computeLeafHash } from "@frontiercompute/zap1";

const hash = await computeLeafHash("PROGRAM_ENTRY", {
  walletHash: "e2e_wallet_20260327",
});
// "075b00df286038a7b3f6bb70054df61343e3481fba579591354a00214e9e019b"
```

### Node hash (Merkle tree)

```js
import { nodeHash } from "@frontiercompute/zap1";

const parent = await nodeHash(leftHex, rightHex);
// BLAKE2b-256 with "NordicShield_MRK" personalization
```

## API

| Function | Description |
|----------|-------------|
| `init()` | Compatibility no-op; retained for 0.1.x callers |
| `computeLeafHash(type, payload)` | Compute leaf hash for PROGRAM_ENTRY or OWNERSHIP_ATTEST |
| `verifyProof(bundle, options)` | Verify V2; historical legacy requires `allowHistoricalLegacy: true` |
| `nodeHash(left, right)` | Compute a Merkle node hash |
| `commitRoot(rawRoot, leafCount)` | Bind a raw root to its positive leaf count |
| `parseBundle(json)` | Parse and normalize an API proof bundle |
| `EVENT_TYPES` | The 18 defined protocol event types |
| `LEAF_HASH_TYPES` | The 2 event types with client-side typed hash formulas |

Proof-path verification is event-type agnostic. Typed leaf reconstruction is
currently available only for `PROGRAM_ENTRY` and `OWNERSHIP_ATTEST`.

### Root schemes

- `ZAP1_COUNT_BOUND_V2`: default and required for current bundles. The
  committed root binds `leaf_count`.
- `ZAP1_LEGACY_DUPLICATE_ODD`: accepted only when the caller sets
  `{ allowHistoricalLegacy: true }`, the bundle labels itself legacy, and the recorded
  anchor height is at or below the frozen historical cutoff. A positive
  `leaf_count` and an exact duplicate-odd proof shape are mandatory.

Missing counts, unknown schemes, malformed hashes, invalid proof positions,
and out-of-window legacy bundles fail closed.
When present, envelope metadata must use `protocol: "ZAP1"` and
`version: "2"` for either root scheme; the legacy label describes the root
construction, not an envelope-version downgrade.

## Personalizations (protocol constants)

| Context | Value (16 bytes) |
|---------|-----------------|
| Leaf hash | `NordicShield_\x00\x00\x00` |
| Node hash | `NordicShield_MRK` |
| Root commitment | `NordicShield_RTK` |

## Protocol

See [ONCHAIN_PROTOCOL.md](https://github.com/Frontier-Compute/zap1/blob/main/ONCHAIN_PROTOCOL.md)
for the deployed protocol description. The document distinguishes bundle
verification, transaction existence, encrypted-memo binding, and event truth.

## Related Packages

| Package | What it does |
|---------|-------------|
| [@frontiercompute/zcash-ika](https://www.npmjs.com/package/@frontiercompute/zcash-ika) | Zcash + Bitcoin signing via Ika 2PC-MPC |
| [@frontiercompute/zcash-mcp](https://www.npmjs.com/package/@frontiercompute/zcash-mcp) | MCP server for Zcash |
| [@frontiercompute/openclaw-zap1](https://www.npmjs.com/package/@frontiercompute/openclaw-zap1) | OpenClaw skill for ZAP1 attestation |
| [@frontiercompute/silo-zap1](https://www.npmjs.com/package/@frontiercompute/silo-zap1) | Silo agent attestation via ZAP1 |

## License

MIT
