import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const npmCli = process.env.npm_execpath;
if (!npmCli) {
  throw new Error("npm_execpath is required; run this gate through npm");
}
const projectRoot = process.cwd();
const packOutput = execFileSync(process.execPath, [npmCli, "pack", "--json"], {
  cwd: projectRoot,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "inherit"],
});
const packMarkers = [
  ...packOutput.matchAll(/\[\s*\{\s*"id"\s*:/g),
];
if (packMarkers.length === 0) {
  throw new Error("npm pack did not emit a JSON result");
}
const packs = JSON.parse(packOutput.slice(packMarkers.at(-1).index));
assert.equal(packs.length, 1);
const pack = packs[0];
assert.equal(pack.name, "@frontiercompute/zap1");
assert.equal(pack.version, "0.2.0");
assert.deepEqual(
  pack.files.map(({ path }) => path).sort(),
  [
    "CHANGELOG.md",
    "LICENSE",
    "PROVENANCE.md",
    "README.md",
    "dist/blake2b.js",
    "dist/index.d.ts",
    "dist/index.js",
    "package.json",
  ],
);

const tarball = resolve(projectRoot, pack.filename);
const trialRoot = await mkdtemp(join(tmpdir(), "zap1-packed-"));
try {
  await writeFile(
    join(trialRoot, "package.json"),
    '{"private":true,"type":"module"}\n',
    "utf8",
  );
  execFileSync(
    process.execPath,
    [
      npmCli,
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      tarball,
    ],
    { cwd: trialRoot, stdio: "inherit" },
  );

  const installedDist = join(
    trialRoot,
    "node_modules",
    "@frontiercompute",
    "zap1",
    "dist",
  );
  const zap1 = await import(
    `${pathToFileURL(join(installedDist, "index.js")).href}?packed=1`
  );
  const leaf1 =
    "075b00df286038a7b3f6bb70054df61343e3481fba579591354a00214e9e019b";
  const leaf2 =
    "de62554ad3867a59895befa7216686c923fc86245231e8fb6bd709a20e1fd133";
  const root =
    "94421ae28effbe52f651b33eb62c3b428d2ae62be578e05d471cba9794225bbd";
  const bundle = {
    leaf_hash: leaf2,
    proof: [{ hash: leaf1, position: "left" }],
    root: {
      hash: root,
      leaf_count: 2,
      scheme: zap1.COUNT_BOUND_SCHEME,
    },
    protocol: "ZAP1",
    version: "2",
  };
  assert.equal(await zap1.verifyProof(bundle), true);

  const wrongCount = structuredClone(bundle);
  wrongCount.root.leaf_count = 3;
  assert.equal(await zap1.verifyProof(wrongCount), false);

  const unknownScheme = structuredClone(bundle);
  unknownScheme.root.scheme = "ZAP1_UNKNOWN";
  assert.equal(await zap1.verifyProof(unknownScheme), false);

  const malformed = structuredClone(bundle);
  malformed.proof[0].position = "sideways";
  await assert.rejects(() => zap1.verifyProof(malformed), TypeError);
  assert.equal(
    await zap1.verifyProof(
      {
        leaf_hash: root,
        proof: [],
        root: {
          hash: root,
          leaf_count: 2,
          scheme: zap1.LEGACY_SCHEME,
        },
        anchor: { height: 3286631 },
        protocol: "ZAP1",
        version: "2",
      },
      { allowHistoricalLegacy: true },
    ),
    false,
  );
  assert.equal(
    await zap1.verifyProof(
      {
        leaf_hash: leaf2,
        proof: [{ hash: leaf1, position: "left" }],
        root: {
          hash:
            "024e36515ea30efc15a0a7962dd8f677455938079430b9eab174f46a4328a07a",
          leaf_count: 2,
          scheme: zap1.LEGACY_SCHEME,
        },
        anchor: { height: 3286631 },
        protocol: "ZAP1",
        version: "2",
      },
      { allowHistoricalLegacy: true },
    ),
    true,
  );
  assert.equal(zap1.EVENT_TYPES.length, 18);
  assert.equal(zap1.LEAF_HASH_TYPES.length, 2);

  const browser = spawnSync(
    process.execPath,
    [resolve(projectRoot, "test", "browser-test.mjs"), installedDist],
    { cwd: projectRoot, stdio: "inherit" },
  );
  if (browser.status !== 0) {
    throw new Error(`packed browser matrix exited ${browser.status}`);
  }
  console.log(`packed clean-install matrix passed: ${pack.integrity}`);
} finally {
  await rm(trialRoot, { recursive: true, force: true });
}
