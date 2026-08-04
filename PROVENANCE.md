# Release provenance

## 0.2.1

The `0.2.0` npm artifact was byte-identical to the GitHub release asset and all
eight packaged files matched tag `v0.2.0`. However, npm recorded the unrelated
parent-workspace commit `27f6a25d7dea225d34b56a0e836dac19446e689c` as
`gitHead` because publication was invoked outside the package repository.

Version `0.2.1` repairs that source pointer without changing verifier
semantics. Publication is permitted only from a clean checkout whose repository
root is the package root and whose `HEAD` is the target of annotated tag
`v0.2.1`. The source-directory lifecycle gates enforce those conditions
before and after packing. Manual prepacked-tarball publication bypasses npm
lifecycle scripts and is prohibited. The tag workflow clean-install-tests a
preflight tarball, then publishes through the complete npm directory lifecycle
from the exact gated tag using the package-scoped trusted publisher. npm records
the source `gitHead` and registry provenance from that canonical workflow.

## 0.2.0

The release source is the commit bearing the annotated repository tag `v0.2.0`.
The npm artifact must be built from a clean checkout of that tag.

The JavaScript BLAKE2b implementation in `src/blake2b.js` is derived from:

- repository: `Frontier-Compute/zap1`
- commit: `63448237dc13e9199303f37c995294b2a56132b1`
- path: `verify-widget/blake2b.js`
- source SHA-256:
  `D31E528C51BEF4D98D9A8B5EEA64550018DCE47EAD9AF8D3AD5D301A791A2BCA`

The release file is not byte-identical to that source. Its SHA-256 is
`5546B1C22EB13F60E9F45C1B358CB4FDCD8CCC77C3F2E039BBC5E3C057D39FC5`.
The delta adds strict type, length, digest, proof, leaf-count, and historical
height validation (59 inserted lines and 7 removed lines); the BLAKE2b
compression and personalization core is unchanged.

`test/test.js` includes independent Python `hashlib.blake2b` boundary
vectors at 0, 1, 3, 127, 128, 129, 255, 256, 257, and 1024 bytes, with and
without the protocol personalization. The release gate also:

- rebuilds `dist/` from source during `prepack`;
- asserts the exact tarball allowlist;
- installs that tarball into a fresh project with scripts disabled;
- tests current and historical proof semantics in Node and Chromium; and
- runs the source suite on Node 18, 20, and 22 in CI.

Version `0.1.3` remains the historical March-May artifact. Version `0.2.0`
is post-window compatibility and verifier-hardening maintenance.
