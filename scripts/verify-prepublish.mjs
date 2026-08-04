import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";

const [preflightPath, publishPackPath] = process.argv.slice(2);
assert.ok(preflightPath, "verified preflight result is required");
assert.ok(publishPackPath, "publish-job pack result is required");

const parseJson = async (path) =>
  JSON.parse((await readFile(path, "utf8")).replace(/^\uFEFF/u, ""));
const preflight = await parseJson(preflightPath);
const publishPacks = await parseJson(publishPackPath);
assert.equal(publishPacks.length, 1);
const candidate = publishPacks[0];
assert.equal(
  candidate.filename,
  basename(candidate.filename),
  "npm pack filename must be a basename",
);
const tarball = resolve(candidate.filename);
assert.equal(
  dirname(tarball),
  resolve("."),
  "npm pack tarball must stay inside the working directory",
);

try {
  for (const field of ["name", "version", "integrity", "shasum"]) {
    assert.equal(
      candidate[field],
      preflight[field],
      `publish-job ${field} differs from the verified preflight`,
    );
  }
  const fileIdentity = ({ path, size, mode }) => ({ path, size, mode });
  assert.deepEqual(
    candidate.files.map(fileIdentity).sort((a, b) => a.path.localeCompare(b.path)),
    preflight.files.map(fileIdentity).sort((a, b) => a.path.localeCompare(b.path)),
    "publish-job tarball files differ from the verified preflight",
  );
  console.log(
    `prepublication artifact matched verified preflight: ${candidate.integrity}`,
  );
} finally {
  await rm(tarball, { force: true });
}
