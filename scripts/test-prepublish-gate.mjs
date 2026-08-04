import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const fixture = await mkdtemp(join(tmpdir(), "zap1-prepublish-gate-"));
const script = resolve("scripts/verify-prepublish.mjs");
const preflightPath = join(fixture, "preflight.json");
const packPath = join(fixture, "pack.json");
const tarballName = "candidate.tgz";
const tarballPath = join(fixture, tarballName);
const base = {
  name: "@frontiercompute/zap1",
  version: "9.9.9",
  integrity: "sha512-fixture",
  shasum: "fixture",
  filename: tarballName,
  files: [
    { path: "dist/index.js", size: 10, mode: 420 },
    { path: "package.json", size: 20, mode: 420 },
  ],
};

function gate() {
  return spawnSync(process.execPath, [script, preflightPath, packPath], {
    cwd: fixture,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

async function stage(candidate = base) {
  await writeFile(preflightPath, `${JSON.stringify(base)}\n`, "utf8");
  await writeFile(packPath, `${JSON.stringify([candidate])}\n`, "utf8");
  await writeFile(tarballPath, "fixture", "utf8");
}

try {
  await stage();
  assert.equal(gate().status, 0, "identical pack must pass");
  await assert.rejects(readFile(tarballPath), { code: "ENOENT" });

  await stage({ ...base, integrity: "sha512-mismatch" });
  assert.notEqual(gate().status, 0, "integrity mismatch must fail");
  await assert.rejects(readFile(tarballPath), { code: "ENOENT" });

  await stage({
    ...base,
    files: [...base.files, { path: "setup.mjs", size: 100, mode: 420 }],
  });
  assert.notEqual(gate().status, 0, "file-set mismatch must fail");
  await assert.rejects(readFile(tarballPath), { code: "ENOENT" });

  console.log("prepublication equality mutation fixtures passed");
} finally {
  await rm(fixture, { recursive: true, force: true });
}
