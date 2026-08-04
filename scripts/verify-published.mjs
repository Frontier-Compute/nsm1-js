import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";

function trailingJson(text) {
  const value = text.trim();
  for (let index = value.length - 1; index >= 0; index -= 1) {
    if (value[index] !== "{" && value[index] !== "[") continue;
    try {
      return JSON.parse(value.slice(index));
    } catch {
      // Keep scanning for the outermost final JSON value.
    }
  }
  throw new Error("npm output did not end with valid JSON");
}

const [preflightPath, publishPath] = process.argv.slice(2);
assert.ok(preflightPath, "preflight pack result path is required");
assert.ok(publishPath, "publish result path is required");
assert.ok(process.env.GITHUB_SHA, "GITHUB_SHA is required");
const expectedHead = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "inherit"],
}).trim();

const preflight = JSON.parse(await readFile(preflightPath, "utf8"));
const publishedRaw = trailingJson(await readFile(publishPath, "utf8"));
const published = Array.isArray(publishedRaw) ? publishedRaw[0] : publishedRaw;

assert.equal(published.name, "@frontiercompute/zap1");
assert.equal(published.version, preflight.version);
assert.equal(published.integrity, preflight.integrity);
assert.equal(published.shasum, preflight.shasum);

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const spec = `@frontiercompute/zap1@${published.version}`;
let metadata;
let lastError;
for (let attempt = 1; attempt <= 12; attempt += 1) {
  try {
    metadata = JSON.parse(
      execFileSync(npmCommand, ["view", spec, "--json"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "inherit"],
      }),
    );
    assert.equal(metadata.gitHead, expectedHead);
    assert.equal(metadata.dist?.integrity, published.integrity);
    assert.equal(metadata.dist?.shasum, published.shasum);
    assert.ok(
      metadata.dist?.attestations &&
        Object.keys(metadata.dist.attestations).length > 0,
      "registry provenance attestation is missing",
    );
    lastError = undefined;
    break;
  } catch (error) {
    lastError = error;
    if (attempt < 12) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}
if (lastError) throw lastError;

console.log(
  JSON.stringify({
    package: spec,
    gitHead: metadata.gitHead,
    integrity: metadata.dist.integrity,
    provenance: true,
  }),
);
