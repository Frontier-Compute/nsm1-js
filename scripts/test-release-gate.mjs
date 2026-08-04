import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";

function git(cwd, ...args) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  }).trim();
}

function gate(cwd, initCwd) {
  return spawnSync(process.execPath, [join(cwd, "check-release.mjs")], {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      INIT_CWD: initCwd,
      GITHUB_ACTIONS: "false",
      GITHUB_REPOSITORY: "",
      GITHUB_REF: "",
      GITHUB_SHA: "",
    },
  });
}

const fixture = await mkdtemp(join(tmpdir(), "zap1-release-gate-"));
try {
  await copyFile(resolve("scripts/check-release.mjs"), join(fixture, "check-release.mjs"));
  await writeFile(
    join(fixture, "package.json"),
    '{"name":"release-gate-fixture","version":"9.9.9","type":"module","repository":{"url":"https://github.com/Frontier-Compute/zap1-js.git"}}\n',
    "utf8",
  );
  git(fixture, "init", "-q");
  git(fixture, "config", "user.name", "ZAP1 release gate");
  git(fixture, "config", "user.email", "zk-nd3r@users.noreply.github.com");
  git(
    fixture,
    "remote",
    "add",
    "origin",
    "https://github.com/Frontier-Compute/zap1-js.git",
  );
  git(fixture, "add", "check-release.mjs", "package.json");
  git(fixture, "commit", "-q", "-m", "fixture");

  git(fixture, "tag", "v9.9.9");
  assert.notEqual(gate(fixture, fixture).status, 0, "lightweight tag must fail");
  git(fixture, "tag", "-d", "v9.9.9");

  git(fixture, "tag", "-a", "v9.9.9", "-m", "fixture release");
  assert.equal(gate(fixture, fixture).status, 0, "annotated exact tag must pass");
  assert.notEqual(
    gate(fixture, dirname(fixture)).status,
    0,
    "parent invocation must fail",
  );

  await writeFile(join(fixture, "dirty.txt"), "dirty\n", "utf8");
  assert.notEqual(gate(fixture, fixture).status, 0, "dirty checkout must fail");
  console.log("release gate fixtures passed");
} finally {
  await rm(fixture, { recursive: true, force: true });
}
