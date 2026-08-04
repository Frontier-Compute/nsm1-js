import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const packageLock = JSON.parse(await readFile("package-lock.json", "utf8"));

for (const field of [
  "dependencies",
  "optionalDependencies",
  "peerDependencies",
  "bundledDependencies",
  "bundleDependencies",
]) {
  assert.equal(
    Object.keys(packageJson[field] ?? {}).length,
    0,
    `${field} must remain empty: ZAP1 ships with zero runtime dependencies`,
  );
}

for (const hook of ["preinstall", "install", "postinstall", "prepare"]) {
  assert.equal(
    Object.hasOwn(packageJson.scripts ?? {}, hook),
    false,
    `consumer-executed lifecycle hook is forbidden: ${hook}`,
  );
}

assert.equal(packageLock.lockfileVersion, 3);
assert.equal(packageLock.packages?.[""]?.name, packageJson.name);
assert.equal(packageLock.packages?.[""]?.version, packageJson.version);
assert.deepEqual(packageLock.packages?.[""]?.devDependencies, {
  playwright: "1.61.1",
});

const expectedPackages = new Map([
  ["node_modules/fsevents", {
    version: "2.3.2",
    resolved: "https://registry.npmjs.org/fsevents/-/fsevents-2.3.2.tgz",
    integrity: "sha512-xiqMQR4xAeHTuB9uWm+fFRcIOgKBMiOBP+eXiyT7jsgVCq1bkVygt00oASowB7EdtpOHaaPgKt812P9ab+DDKA==",
  }],
  ["node_modules/playwright", {
    version: "1.61.1",
    resolved: "https://registry.npmjs.org/playwright/-/playwright-1.61.1.tgz",
    integrity: "sha512-DWnY5o3YbLWK4GovuAVwpqL+1VwGNdUGrRr++8j8PtQQzvAVZUIMjKQ90fY689sEJZJBbZVw1rXaOKSTitkzPQ==",
  }],
  ["node_modules/playwright-core", {
    version: "1.61.1",
    resolved: "https://registry.npmjs.org/playwright-core/-/playwright-core-1.61.1.tgz",
    integrity: "sha512-h7Qlt6m4REp25qvIdvbDtVmD4LqVXfpRxhORv9L0jzETM05p4fuPJ3dKyuSXQxDSbXnmS79HAgi9589lGSpLkg==",
  }],
]);

const installedPackages = Object.entries(packageLock.packages ?? {}).filter(
  ([path]) => path !== "",
);
assert.deepEqual(
  installedPackages.map(([path]) => path).sort(),
  [...expectedPackages.keys()].sort(),
  "lock graph changed; review and explicitly update the supply-chain policy",
);
for (const [path, expected] of expectedPackages) {
  const actual = packageLock.packages[path];
  assert.deepEqual(
    {
      version: actual?.version,
      resolved: actual?.resolved,
      integrity: actual?.integrity,
    },
    expected,
    `${path} identity or registry integrity changed`,
  );
}

const scriptedDependencies = installedPackages
  .filter(([, value]) => value.hasInstallScript === true)
  .map(([path]) => path);
assert.deepEqual(scriptedDependencies, ["node_modules/fsevents"]);
assert.equal(packageLock.packages["node_modules/fsevents"].optional, true);
assert.deepEqual(packageLock.packages["node_modules/fsevents"].os, ["darwin"]);

const lockGraphDigest = createHash("sha256")
  .update(JSON.stringify(packageLock.packages))
  .digest("hex");
assert.equal(
  lockGraphDigest,
  "ad24c330e040d801b7b7785e397d1acc2290f4f83c04aeac2b56bf8858cb1fa3",
  "canonical lock graph digest changed",
);

const workflowDirectory = join(".github", "workflows");
const workflowFiles = (await readdir(workflowDirectory)).filter((name) =>
  /\.ya?ml$/u.test(name),
);
const allowedActions = new Set([
  "actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803",
  "actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38",
]);
const workflowSources = new Map();
let installCommands = 0;
for (const name of workflowFiles) {
  const source = await readFile(join(workflowDirectory, name), "utf8");
  workflowSources.set(name, source);
  assert.doesNotMatch(source, /\t/u, `${name} may not contain tabs`);
  assert.doesNotMatch(
    source,
    /^\s*-\s*\{/mu,
    `${name} may not use flow-style step maps`,
  );
  assert.doesNotMatch(
    source,
    /^\s*(?:-\s*)?["'](?:run|uses)["']\s*:/mu,
    `${name} may not quote critical step keys`,
  );
  assert.doesNotMatch(
    source,
    /^\s*<<\s*:/mu,
    `${name} may not use YAML merge aliases`,
  );
  assert.doesNotMatch(
    source,
    /^\s*(?:-\s*)?run\s*:\s*[>|]\s*$/mu,
    `${name} uses a block-scalar run command that the policy cannot inspect`,
  );
  const usesKeys = source.match(/^\s*(?:-\s*)?uses\s*:/gmu) ?? [];
  const uses = [
    ...source.matchAll(/^\s*(?:-\s*)?uses\s*:\s+([^\s#]+)/gmu),
  ];
  assert.equal(
    uses.length,
    usesKeys.length,
    `${name} contains an unparseable uses key`,
  );
  for (const match of uses) {
    assert.ok(
      allowedActions.has(match[1]),
      `${name} uses an unapproved or mutable action reference: ${match[1]}`,
    );
  }
  for (const line of source.split(/\r?\n/u)) {
    const run = line.match(/^\s*(?:-\s*)?run\s*:\s+(.+?)\s*$/u);
    if (run && /(?:^|\s)npm ci(?:\s|$)/u.test(run[1])) {
      installCommands += 1;
      assert.equal(
        run[1],
        "npm ci --ignore-scripts --no-audit --no-fund",
        `${name} must suppress dependency lifecycle scripts`,
      );
    }
  }
}
assert.ok(installCommands > 0, "no npm ci commands were inspected");

const publishWorkflow = workflowSources.get("publish.yml");
assert.ok(publishWorkflow, "publish.yml is required");
assert.equal(
  publishWorkflow.match(/id-token:\s*write/gu)?.length ?? 0,
  1,
  "exactly one job may receive an OIDC token",
);
assert.doesNotMatch(
  publishWorkflow.slice(0, publishWorkflow.indexOf("\njobs:")),
  /id-token:\s*write/u,
  "workflow-wide OIDC permission is forbidden",
);

const publishStart = publishWorkflow.search(/^  publish:\s*$/mu);
assert.notEqual(publishStart, -1, "publish job is required");
const afterPublish = publishWorkflow.slice(publishStart + 1);
const nextJobOffset = afterPublish.search(/^  [a-zA-Z0-9_-]+:\s*$/mu);
assert.notEqual(nextJobOffset, -1, "publish job boundary is missing");
const publishJob = afterPublish.slice(0, nextJobOffset);
assert.match(publishJob, /\n\s{6}id-token:\s*write\s*$/mu);
assert.doesNotMatch(
  publishJob,
  /(?:^|\s)(?:npm ci|npm test|npx|pnpm|yarn|curl|wget|pip)(?:\s|$)/u,
  "OIDC publish job may not install dependencies or run third-party tools",
);

const publishRuns = [
  ...publishJob.matchAll(/^\s*(?:-\s*)?run\s*:\s+(.+?)\s*$/gmu),
].map((match) => match[1]);
assert.deepEqual(
  publishRuns,
  [
    "printf '%s' '${{ needs.verify.outputs.preflight }}' | base64 -d > \"$RUNNER_TEMP/zap1-preflight.json\"",
    "INIT_CWD=\"$PWD\" node scripts/check-release.mjs",
    "npm pack --ignore-scripts --json > \"$RUNNER_TEMP/zap1-publish.pack.json\"",
    "node scripts/verify-prepublish.mjs \"$RUNNER_TEMP/zap1-preflight.json\" \"$RUNNER_TEMP/zap1-publish.pack.json\"",
    "npm publish --ignore-scripts --access public --provenance --json > \"$RUNNER_TEMP/zap1-publish.raw.json\"",
    "echo \"payload=$(base64 -w0 \"$RUNNER_TEMP/zap1-publish.raw.json\")\" >> \"$GITHUB_OUTPUT\"",
  ],
  "OIDC publish job command set changed",
);

console.log(
  `supply-chain policy passed: zero runtime deps, ${installedPackages.length} exact dev lock entries, lifecycle scripts suppressed`,
);
