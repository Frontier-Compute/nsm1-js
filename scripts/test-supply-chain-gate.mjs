import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const fixture = await mkdtemp(join(tmpdir(), "zap1-supply-chain-gate-"));
const files = [
  "package.json",
  "package-lock.json",
  ".github/workflows/ci.yml",
  ".github/workflows/publish.yml",
  "scripts/check-supply-chain.mjs",
];

async function restore(path) {
  const target = join(fixture, path);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(path, target);
}

function gate() {
  return spawnSync(process.execPath, ["scripts/check-supply-chain.mjs"], {
    cwd: fixture,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

async function mustReject(path, mutate, label) {
  const target = join(fixture, path);
  const original = await readFile(target, "utf8");
  await writeFile(target, mutate(original), "utf8");
  const result = gate();
  assert.notEqual(result.status, 0, `${label} must fail closed`);
  await writeFile(target, original, "utf8");
}

try {
  for (const path of files) await restore(path);
  const baseline = gate();
  assert.equal(
    baseline.status,
    0,
    `baseline gate failed:\n${baseline.stderr || baseline.stdout}`,
  );

  await mustReject(
    "package.json",
    (source) => {
      const value = JSON.parse(source);
      value.scripts.postinstall = "node setup.mjs";
      return `${JSON.stringify(value, null, 2)}\n`;
    },
    "consumer lifecycle hook",
  );
  await mustReject(
    "package.json",
    (source) => {
      const value = JSON.parse(source);
      value.dependencies = { keyv: "6.0.0" };
      return `${JSON.stringify(value, null, 2)}\n`;
    },
    "runtime dependency",
  );
  await mustReject(
    "package-lock.json",
    (source) => {
      const value = JSON.parse(source);
      value.packages["node_modules/keyv"] = {
        version: "6.0.0",
        resolved: "https://registry.npmjs.org/keyv/-/keyv-6.0.0.tgz",
        integrity: "sha512-incident-fixture",
        hasInstallScript: true,
      };
      return `${JSON.stringify(value, null, 2)}\n`;
    },
    "unexpected lock entry",
  );
  await mustReject(
    "package-lock.json",
    (source) =>
      source.replace(
        "sha512-DWnY5o3YbLWK4GovuAVwpqL+1VwGNdUGrRr++8j8PtQQzvAVZUIMjKQ90fY689sEJZJBbZVw1rXaOKSTitkzPQ==",
        "sha512-tampered",
      ),
    "lock integrity mutation",
  );
  await mustReject(
    ".github/workflows/ci.yml",
    (source) =>
      source.replace(
        "npm ci --ignore-scripts --no-audit --no-fund",
        "npm ci --no-audit --no-fund",
      ),
    "lifecycle-enabled dependency install",
  );
  await mustReject(
    ".github/workflows/ci.yml",
    (source) =>
      source.replace(
        "- run: npm ci --ignore-scripts --no-audit --no-fund",
        "- run: |\n          npm ci --ignore-scripts --no-audit --no-fund",
      ),
    "block-scalar command",
  );
  await mustReject(
    ".github/workflows/ci.yml",
    (source) =>
      source.replace(
        "actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803",
        "actions/checkout@v6",
      ),
    "mutable GitHub Action reference",
  );
  await mustReject(
    ".github/workflows/ci.yml",
    (source) =>
      source.replace(
        "- uses: actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803 # v6",
        "- name: injected action\n        uses: attacker/action@v1",
      ),
    "named-step mutable action",
  );
  await mustReject(
    ".github/workflows/ci.yml",
    (source) =>
      source.replace(
        "- uses: actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803 # v6",
        "- { uses: attacker/action@v1 }",
      ),
    "flow-style action",
  );
  await mustReject(
    ".github/workflows/ci.yml",
    (source) =>
      source.replace(
        "- run: npm ci --ignore-scripts --no-audit --no-fund",
        "- { run: npm ci }",
      ),
    "flow-style command",
  );
  await mustReject(
    ".github/workflows/ci.yml",
    (source) =>
      source.replace(
        "- uses: actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803 # v6",
        '- "uses": attacker/action@v1',
      ),
    "quoted critical key",
  );
  await mustReject(
    ".github/workflows/ci.yml",
    (source) =>
      source.replace(
        "- uses: actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803 # v6",
        "- uses : attacker/action@v1",
      ),
    "spaced mutable action key",
  );
  await mustReject(
    ".github/workflows/publish.yml",
    (source) =>
      source.replace(
        "permissions:\n  contents: read",
        "permissions:\n  contents: read\n  id-token: write",
      ),
    "workflow-wide OIDC permission",
  );
  await mustReject(
    ".github/workflows/publish.yml",
    (source) =>
      source.replace(
        "npm publish --ignore-scripts --access public",
        "npm publish --access public",
      ),
    "lifecycle-enabled publication",
  );
  await mustReject(
    ".github/workflows/publish.yml",
    (source) =>
      source.replace(
        'run: INIT_CWD="$PWD" node scripts/check-release.mjs',
        'run: npx attacker-tool\n      - run: INIT_CWD="$PWD" node scripts/check-release.mjs',
      ),
    "third-party execution in OIDC job",
  );
  console.log("supply-chain gate mutation fixtures passed");
} finally {
  await rm(fixture, { recursive: true, force: true });
}
