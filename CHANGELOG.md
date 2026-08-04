# Changelog

## 0.2.0

- Verify current `ZAP1_COUNT_BOUND_V2` bundles with mandatory leaf-count
  binding.
- Gate historical `ZAP1_LEGACY_DUPLICATE_ODD` verification behind an explicit
  caller option and the frozen anchor-height cutoff.
- Replace the unreproducible generated WASM artifact with auditable,
  zero-runtime-dependency JavaScript.
- Reject malformed digests, ambiguous proof positions, oversized proofs,
  unsafe leaf counts, impossible tree paths, missing schemes, internal-node
  substitution, and silent legacy downgrade.
- Test Node 18, 20, and 22 plus a real Chromium ESM import.

Version `0.1.3` remains the historical March-May artifact. Version `0.2.0`
is post-window compatibility maintenance for current count-bound proof bundles.
It does not change the application period, amount, or deliverables.
