# @frontiercompute/zap1

[![ci](https://github.com/Frontier-Compute/zap1-js/actions/workflows/ci.yml/badge.svg)](https://github.com/Frontier-Compute/zap1-js/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@frontiercompute/zap1)](https://www.npmjs.com/package/@frontiercompute/zap1)
![downloads](https://img.shields.io/npm/dw/@frontiercompute/zap1)
![license](https://img.shields.io/npm/l/@frontiercompute/zap1)

[**Dashboard**](https://frontiercompute.cash/dashboard.html) | [npm](https://www.npmjs.com/package/@frontiercompute/zap1) | [GitHub](https://github.com/Frontier-Compute/zap1-js)

ZAP1 Merkle proof verification for JavaScript and TypeScript. WASM-powered BLAKE2b-256 with ZAP1 domain-separated personalizations.

Client-side verification of on-chain commitments. All cryptography runs in WebAssembly compiled from the `zap1-verify` Rust crate.

## Install

```bash
npm install @frontiercompute/zap1
```

## Usage

### Verify a proof bundle

```js
import { verifyProof, parseBundle } from "@frontiercompute/zap1";

const res = await fetch("https://pay.frontiercompute.io/verify/075b00df.../proof.json");
const raw = await res.json();
const bundle = parseBundle(raw);

const valid = await verifyProof(bundle);
console.log(valid ? "VERIFIED" : "FAILED");
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
| `init()` | Preload the WASM module (called automatically on first use) |
| `computeLeafHash(type, payload)` | Compute leaf hash for PROGRAM_ENTRY or OWNERSHIP_ATTEST |
| `verifyProof(bundle)` | Verify a Merkle inclusion proof |
| `nodeHash(left, right)` | Compute a Merkle node hash |
| `parseBundle(json)` | Parse and normalize an API proof bundle |
| `EVENT_TYPES` | Array of all 18 ZAP1 event types |

## Personalizations (protocol constants)

| Context | Value (16 bytes) |
|---------|-----------------|
| Leaf hash | `NordicShield_\x00\x00\x00` |
| Node hash | `NordicShield_MRK` |

## Protocol

See [ONCHAIN_PROTOCOL.md](https://github.com/Frontier-Compute/zap1/blob/main/ONCHAIN_PROTOCOL.md) for the full ZAP1 specification.

## Related Packages

| Package | What it does |
|---------|-------------|
| [@frontiercompute/zcash-ika](https://www.npmjs.com/package/@frontiercompute/zcash-ika) | Zcash + Bitcoin signing via Ika 2PC-MPC |
| [@frontiercompute/zcash-mcp](https://www.npmjs.com/package/@frontiercompute/zcash-mcp) | MCP server for Zcash (22 tools) |
| [@frontiercompute/openclaw-zap1](https://www.npmjs.com/package/@frontiercompute/openclaw-zap1) | OpenClaw skill for ZAP1 attestation |
| [@frontiercompute/silo-zap1](https://www.npmjs.com/package/@frontiercompute/silo-zap1) | Silo agent attestation via ZAP1 |

## License

MIT
