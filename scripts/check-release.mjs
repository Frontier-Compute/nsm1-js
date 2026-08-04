import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile, realpath } from "node:fs/promises";
import { join } from "node:path";

function git(...args) {
  return execFileSync("git", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  }).trim();
}

function canonicalRepository(url) {
  return url.replace(/\/+$/, "").replace(/\.git$/, "");
}

const packageRoot = await realpath(process.cwd());
const repositoryRoot = await realpath(git("rev-parse", "--show-toplevel"));
assert.ok(process.env.INIT_CWD, "INIT_CWD is required for publication");
const invocationRoot = await realpath(process.env.INIT_CWD);
assert.equal(
  packageRoot,
  repositoryRoot,
  "publish must run from the zap1-js repository root",
);
assert.equal(
  invocationRoot,
  packageRoot,
  "npm publish must be invoked from the zap1-js repository root",
);

const packageJson = JSON.parse(
  await readFile(join(packageRoot, "package.json"), "utf8"),
);
assert.equal(
  canonicalRepository(packageJson.repository?.url ?? ""),
  "https://github.com/Frontier-Compute/zap1-js",
  "package repository URL must be canonical",
);
assert.equal(
  canonicalRepository(git("remote", "get-url", "origin")),
  "https://github.com/Frontier-Compute/zap1-js",
  "origin must be the canonical HTTPS repository",
);
assert.equal(
  Object.hasOwn(packageJson, "gitHead"),
  false,
  "package.json must not contain an explicit gitHead",
);
const expectedTag = `v${packageJson.version}`;
const head = git("rev-parse", "HEAD");
const tagType = git("cat-file", "-t", `refs/tags/${expectedTag}`);
assert.equal(tagType, "tag", `${expectedTag} must be an annotated tag`);
const tagTarget = git(
  "rev-parse",
  `refs/tags/${expectedTag}^{commit}`,
);
assert.equal(head, tagTarget, `${expectedTag} must resolve to HEAD`);
const mainAncestry = spawnSync(
  "git",
  ["merge-base", "--is-ancestor", head, "refs/remotes/origin/main"],
  { cwd: packageRoot, stdio: "ignore" },
);
assert.equal(
  mainAncestry.status,
  0,
  `${expectedTag} must point to a commit reachable from origin/main`,
);

if (process.env.GITHUB_ACTIONS === "true") {
  assert.equal(
    process.env.GITHUB_REPOSITORY,
    "Frontier-Compute/zap1-js",
    "GitHub repository identity mismatch",
  );
  assert.equal(
    process.env.GITHUB_REF,
    `refs/tags/${expectedTag}`,
    "GitHub ref must be the release tag",
  );
  const workflowCommit = git(
    "rev-parse",
    `${process.env.GITHUB_SHA}^{commit}`,
  );
  assert.equal(workflowCommit, head, "GitHub workflow SHA must resolve to HEAD");
}

const status = git("status", "--porcelain=v1", "--untracked-files=all");
assert.equal(status, "", "publish checkout must be clean");

console.log(`release preimage verified: ${expectedTag} -> ${head}`);
