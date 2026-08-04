# Changelog

## 0.2.1

- Repair npm source provenance after `0.2.0` recorded an unrelated parent
  repository commit as its `gitHead` even though its artifact bytes matched
  the tagged source.
- Add source-directory pre- and post-pack publish gates requiring a clean
  checkout at the exact annotated version tag, invoked from the ZAP1 package
  repository root.
- Publish through a package-scoped GitHub Actions trusted publisher so npm can
  bind the registry artifact to the exact tagged source workflow without a
  long-lived token.
- Make the packed-install matrix read the package version instead of embedding
  a release-specific constant.

There is no verifier-semantic change from `0.2.0`.

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
