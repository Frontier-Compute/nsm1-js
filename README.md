# @frontiercompute/zap1

ZAP1 Merkle proof verification for JavaScript and TypeScript. WASM-powered BLAKE2b-256 with Nordic Shield personalizations.

Zero-trust verification of on-chain commitments. All cryptography runs client-side via WebAssembly compiled from the `zap1-verify` Rust crate.

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
| `EVENT_TYPES` | Array of all 9 deployed ZAP1 event types |

## Personalizations

| Context | Value (16 bytes) |
|---------|-----------------|
| Leaf hash | `NordicShield_\x00\x00\x00` |
| Node hash | `NordicShield_MRK` |

## Protocol

See [ONCHAIN_PROTOCOL.md](https://github.com/Frontier-Compute/zap1/blob/main/ONCHAIN_PROTOCOL.md) for the full ZAP1 specification.

## License

MIT
