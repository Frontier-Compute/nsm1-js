import assert from "node:assert/strict";
import {
  commitRoot,
  computeLeafHash,
  COUNT_BOUND_SCHEME,
  EVENT_TYPES,
  init,
  LEAF_HASH_TYPES,
  LEGACY_ROOT_MAX_ANCHOR_HEIGHT,
  LEGACY_SCHEME,
  nodeHash,
  parseBundle,
  verifyProof,
} from "../src/index.js";
import { blake2b256, bytesToHex } from "../src/blake2b.js";

const LEAF1 = "075b00df286038a7b3f6bb70054df61343e3481fba579591354a00214e9e019b";
const LEAF2 = "de62554ad3867a59895befa7216686c923fc86245231e8fb6bd709a20e1fd133";
const RAW_ROOT = "024e36515ea30efc15a0a7962dd8f677455938079430b9eab174f46a4328a07a";
const V2_ROOT = "94421ae28effbe52f651b33eb62c3b428d2ae62be578e05d471cba9794225bbd";

const currentBundle = {
  leaf: {
    hash: LEAF2,
    event_type: "OWNERSHIP_ATTEST",
  },
  proof: [{ hash: LEAF1, position: "left" }],
  root: {
    hash: V2_ROOT,
    leaf_count: 2,
    scheme: COUNT_BOUND_SCHEME,
  },
  anchor: { txid: null, height: null },
  protocol: "ZAP1",
  version: "2",
};

const legacyBundle = {
  leaf: {
    hash: LEAF2,
    event_type: "OWNERSHIP_ATTEST",
  },
  proof: [{ hash: LEAF1, position: "left" }],
  root: {
    hash: RAW_ROOT,
    leaf_count: 2,
    scheme: LEGACY_SCHEME,
  },
  anchor: {
    txid: "98e1d6a01614c464c237f982d9dc2138c5f8aa08342f67b867a18a4ce998af9a",
    height: 3286631,
  },
};

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`ok ${name}`);
  } catch (error) {
    failed++;
    console.error(`FAIL ${name}`);
    console.error(error);
  }
}

await test("BLAKE2b-256 matches independent boundary vectors", () => {
  const vectors = [
    [0, "0e5751c026e543b2e8ab2eb06099daa1d1e5df47778f7787faab45cdf12fe3a8", "543dd29451e4e736621ae1b70d1db8d9acddaf5def0f360f0ebd459ba7cf7eaa"],
    [1, "44e9e1dfd31e4c8c8e05d6db76912790ae9b2f989463f59f709cdd3df7393675", "e590e659e08dc8f8de9cf98c43ac32d9def7ebdac7c4659a8f96ce378934781e"],
    [3, "9e23a08fdcfe61165716b5c09290f1127e1fefd8ced7f44bf6bc972f6e808c1d", "e9a667696d80bcd010b2dc273f97e41938673d8c12b32fe5ac50c9cf8f52f3ca"],
    [127, "2bafc551fac2b7471a310590f926931e76efa61773f721c11a58795c861fbe01", "79983c90a167518e5d42bb801ab15038bbf38898ae5f49685e05094587986192"],
    [128, "d8964bd9acf62d8064e4569331ca8474ac23c1cc1a4ace160880bcea85b837f9", "d2c1b15171cefa73813351594bc7efa5303103e62e0d1441cd761a7f001788cc"],
    [129, "52d53b85c007796f8cc02865bd710c6bea2e1e19ddb7aef99fbbd48b87393f22", "e9629c8e65ba4722944615fd59fd8a92597fd043cb1537a8d92149ec41f24ab8"],
    [255, "748a4aa0dc8cb47c53c4f5c91aed59ee63ff1b5b4864f88beed92f3fdd593aa3", "c64523ae59477b84a9f63a39822e51ce43581079f985a9d600d48ea5c5213d80"],
    [256, "781150a9570dd6a6086e11b0f60bb629707d99523fb8da9985403a28c6864a9d", "620d008c782b43bc0b6a98fb0c51c3a2038334d647b045a5d4a710b44efea1d3"],
    [257, "7efdee97778ed5d97ea9ccd7835289e0d92a27a6ce1d3da32cbaed8369cc7099", "6c5e694b44daa11fd24e3b2459b49d2feebb3c97f12072a9008b664032c8e590"],
    [1024, "5760f7d34eb98e6dd16591f6412cf5ce43878e9ad7c28953595feb6746827baa", "59d58e94cb5dbbcda979b859983d5a0ac9b7bb9aeb857127ce526d9f6a7a77b9"],
  ];
  const personal = new TextEncoder().encode("NordicShield_MRK");
  for (const [length, plain, personalized] of vectors) {
    const input = Uint8Array.from(
      { length },
      (_, index) => (index * 37 + 11) % 256,
    );
    assert.equal(bytesToHex(blake2b256(input)), plain);
    assert.equal(bytesToHex(blake2b256(input, personal)), personalized);
  }
});

await test("init is an idempotent compatibility no-op", async () => {
  await init();
  await init();
});

await test("canonical event registry is immutable and complete", () => {
  assert.equal(EVENT_TYPES.length, 18);
  assert.equal(EVENT_TYPES[0], "PROGRAM_ENTRY");
  assert.equal(EVENT_TYPES[17], "AGENT_ACTION");
  assert.throws(() => EVENT_TYPES.push("UNKNOWN"), TypeError);
  assert.deepEqual(LEAF_HASH_TYPES, ["PROGRAM_ENTRY", "OWNERSHIP_ATTEST"]);
});

await test("PROGRAM_ENTRY typed vector", async () => {
  assert.equal(
    await computeLeafHash("PROGRAM_ENTRY", {
      walletHash: "e2e_wallet_20260327",
    }),
    LEAF1,
  );
});

await test("OWNERSHIP_ATTEST typed vector", async () => {
  assert.equal(
    await computeLeafHash("OWNERSHIP_ATTEST", {
      walletHash: "e2e_wallet_20260327",
      serialNumber: "Z15P-E2E-001",
    }),
    LEAF2,
  );
});

await test("defined unsupported and unknown types are distinct", async () => {
  assert.equal(await computeLeafHash("DEPLOYMENT", {}), null);
  await assert.rejects(() => computeLeafHash("NOT_A_TYPE", {}), RangeError);
});

await test("typed hashing rejects missing and oversized fields", async () => {
  await assert.rejects(
    () => computeLeafHash("PROGRAM_ENTRY", {}),
    TypeError,
  );
  await assert.rejects(
    () =>
      computeLeafHash("OWNERSHIP_ATTEST", {
        walletHash: "wallet",
      }),
    TypeError,
  );
  await assert.rejects(
    () =>
      computeLeafHash("OWNERSHIP_ATTEST", {
        walletHash: "x".repeat(65536),
        serialNumber: "serial",
      }),
    RangeError,
  );
});

await test("node and count-bound root vectors", async () => {
  assert.equal(await nodeHash(LEAF1, LEAF2), RAW_ROOT);
  assert.equal(commitRoot(RAW_ROOT, 2), V2_ROOT);
});

await test("current nested bundle verifies", async () => {
  assert.equal(await verifyProof(currentBundle), true);
  assert.equal(parseBundle(currentBundle).leaf_count, 2);
});

await test("wrong leaf count fails", async () => {
  const wrong = structuredClone(currentBundle);
  wrong.root.leaf_count = 3;
  assert.equal(await verifyProof(wrong), false);
});

await test("unknown or missing scheme fails closed", async () => {
  const unknown = structuredClone(currentBundle);
  unknown.root.scheme = "ZAP1_UNKNOWN";
  assert.equal(await verifyProof(unknown), false);
  const missing = structuredClone(currentBundle);
  delete missing.root.scheme;
  assert.equal(await verifyProof(missing), false);
});

await test("missing count never falls back to legacy", async () => {
  const missing = structuredClone(currentBundle);
  delete missing.root.leaf_count;
  assert.equal(await verifyProof(missing), false);
});

await test("legacy is opt-in and height gated", async () => {
  assert.equal(await verifyProof(legacyBundle), false);
  assert.equal(
    await verifyProof(legacyBundle, { allowHistoricalLegacy: true }),
    true,
  );
  for (const height of [
    LEGACY_ROOT_MAX_ANCHOR_HEIGHT + 1,
    0,
    -1,
    "",
    "3286631",
    false,
    1.5,
  ]) {
    const candidate = structuredClone(legacyBundle);
    candidate.anchor.height = height;
    assert.equal(
      await verifyProof(candidate, { allowHistoricalLegacy: true }),
      false,
    );
  }
});

await test("legacy rejects root-as-leaf and requires a count", async () => {
  assert.equal(
    await verifyProof(
      {
        leaf_hash: RAW_ROOT,
        proof: [],
        root: {
          hash: RAW_ROOT,
          leaf_count: 2,
          scheme: LEGACY_SCHEME,
        },
        anchor: { height: 3286631 },
        protocol: "ZAP1",
        version: "2",
      },
      { allowHistoricalLegacy: true },
    ),
    false,
  );

  const missingCount = structuredClone(legacyBundle);
  delete missingCount.root.leaf_count;
  assert.equal(
    await verifyProof(missingCount, { allowHistoricalLegacy: true }),
    false,
  );
});

await test("legacy accepts exact duplicate-odd three- and five-leaf paths", async () => {
  const leaf3 = "03".repeat(32);
  const pair12 = await nodeHash(LEAF1, LEAF2);
  const duplicate3 = await nodeHash(leaf3, leaf3);
  const raw3 = await nodeHash(pair12, duplicate3);
  const legacyBase = {
    anchor: { height: 3286631 },
    protocol: "ZAP1",
    version: "2",
  };

  assert.equal(
    await verifyProof(
      {
        ...legacyBase,
        leaf_hash: leaf3,
        proof: [
          { hash: leaf3, position: "right" },
          { hash: pair12, position: "left" },
        ],
        root: {
          hash: raw3,
          leaf_count: 3,
          scheme: LEGACY_SCHEME,
        },
      },
      { allowHistoricalLegacy: true },
    ),
    true,
  );

  const wrongDuplicate = await nodeHash(leaf3, LEAF1);
  const craftedWrongRoot = await nodeHash(pair12, wrongDuplicate);
  assert.equal(
    await verifyProof(
      {
        ...legacyBase,
        leaf_hash: leaf3,
        proof: [
          { hash: LEAF1, position: "right" },
          { hash: pair12, position: "left" },
        ],
        root: {
          hash: craftedWrongRoot,
          leaf_count: 3,
          scheme: LEGACY_SCHEME,
        },
      },
      { allowHistoricalLegacy: true },
    ),
    false,
  );

  const leaf4 = "04".repeat(32);
  const leaf5 = "05".repeat(32);
  const pair34 = await nodeHash(leaf3, leaf4);
  const duplicate5 = await nodeHash(leaf5, leaf5);
  const firstFour = await nodeHash(pair12, pair34);
  const duplicate5Again = await nodeHash(duplicate5, duplicate5);
  const raw5 = await nodeHash(firstFour, duplicate5Again);
  assert.equal(
    await verifyProof(
      {
        ...legacyBase,
        leaf_hash: leaf5,
        proof: [
          { hash: leaf5, position: "right" },
          { hash: duplicate5, position: "right" },
          { hash: firstFour, position: "left" },
        ],
        root: {
          hash: raw5,
          leaf_count: 5,
          scheme: LEGACY_SCHEME,
        },
      },
      { allowHistoricalLegacy: true },
    ),
    true,
  );
});

await test("empty proof requires exactly one leaf", async () => {
  const oneRoot = commitRoot(LEAF1, 1);
  assert.equal(
    await verifyProof({
      leaf_hash: LEAF1,
      proof: [],
      root: {
        hash: oneRoot,
        leaf_count: 1,
        scheme: COUNT_BOUND_SCHEME,
      },
    }),
    true,
  );
  assert.equal(
    await verifyProof({
      leaf_hash: LEAF1,
      proof: [],
      root: {
        hash: commitRoot(LEAF1, 2),
        leaf_count: 2,
        scheme: COUNT_BOUND_SCHEME,
      },
    }),
    false,
  );
});

await test("count-bound paths reject impossible shapes", async () => {
  const impossibleRawRoot = await nodeHash(LEAF1, LEAF2);
  assert.equal(
    await verifyProof({
      leaf_hash: LEAF1,
      proof: [{ hash: LEAF2, position: "right" }],
      root: {
        hash: commitRoot(impossibleRawRoot, 1),
        leaf_count: 1,
        scheme: COUNT_BOUND_SCHEME,
      },
      protocol: "ZAP1",
      version: "2",
    }),
    false,
  );
});

await test("carry-up paths accept valid three- and five-leaf shapes", async () => {
  const leaf3 = "03".repeat(32);
  const pair12 = await nodeHash(LEAF1, LEAF2);
  const raw3 = await nodeHash(pair12, leaf3);
  const root3 = commitRoot(raw3, 3);

  assert.equal(
    await verifyProof({
      leaf_hash: leaf3,
      proof: [{ hash: pair12, position: "left" }],
      root: {
        hash: root3,
        leaf_count: 3,
        scheme: COUNT_BOUND_SCHEME,
      },
    }),
    true,
  );
  assert.equal(
    await verifyProof({
      leaf_hash: LEAF1,
      proof: [
        { hash: LEAF2, position: "right" },
        { hash: leaf3, position: "right" },
      ],
      root: {
        hash: root3,
        leaf_count: 3,
        scheme: COUNT_BOUND_SCHEME,
      },
    }),
    true,
  );

  const leaf4 = "04".repeat(32);
  const leaf5 = "05".repeat(32);
  const pair34 = await nodeHash(leaf3, leaf4);
  const firstFour = await nodeHash(pair12, pair34);
  const raw5 = await nodeHash(firstFour, leaf5);
  const root5 = commitRoot(raw5, 5);

  assert.equal(
    await verifyProof({
      leaf_hash: leaf5,
      proof: [{ hash: firstFour, position: "left" }],
      root: {
        hash: root5,
        leaf_count: 5,
        scheme: COUNT_BOUND_SCHEME,
      },
    }),
    true,
  );
  assert.equal(
    await verifyProof({
      leaf_hash: leaf3,
      proof: [
        { hash: leaf4, position: "right" },
        { hash: pair12, position: "left" },
        { hash: leaf5, position: "right" },
      ],
      root: {
        hash: root5,
        leaf_count: 5,
        scheme: COUNT_BOUND_SCHEME,
      },
    }),
    true,
  );
});

await test("explicit protocol and version must match the root scheme", async () => {
  const badProtocol = structuredClone(currentBundle);
  badProtocol.protocol = "NOT_ZAP1";
  assert.equal(await verifyProof(badProtocol), false);

  const badCurrentVersion = structuredClone(currentBundle);
  badCurrentVersion.version = "999";
  assert.equal(await verifyProof(badCurrentVersion), false);

  const explicitLegacy = structuredClone(legacyBundle);
  explicitLegacy.protocol = "ZAP1";
  explicitLegacy.version = "2";
  assert.equal(
    await verifyProof(explicitLegacy, { allowHistoricalLegacy: true }),
    true,
  );
  explicitLegacy.version = "1";
  assert.equal(
    await verifyProof(explicitLegacy, { allowHistoricalLegacy: true }),
    false,
  );
});

await test("duplicate bundle representations must agree", async () => {
  const agreeing = structuredClone(currentBundle);
  agreeing.leaf_hash = LEAF2;
  agreeing.root_hash = V2_ROOT;
  agreeing.leaf_count = 2;
  agreeing.root_scheme = COUNT_BOUND_SCHEME;
  assert.equal(await verifyProof(agreeing), true);

  const leafConflict = structuredClone(agreeing);
  leafConflict.leaf_hash = LEAF1;
  await assert.rejects(() => verifyProof(leafConflict), TypeError);

  const rootConflict = structuredClone(agreeing);
  rootConflict.root_hash = LEAF1;
  await assert.rejects(() => verifyProof(rootConflict), TypeError);

  const countConflict = structuredClone(agreeing);
  countConflict.leaf_count = 3;
  await assert.rejects(() => verifyProof(countConflict), TypeError);

  const schemeConflict = structuredClone(agreeing);
  schemeConflict.root_scheme = LEGACY_SCHEME;
  await assert.rejects(() => verifyProof(schemeConflict), TypeError);
});

await test("malformed hashes and positions reject", async () => {
  const badHex = structuredClone(currentBundle);
  badHex.leaf.hash = "gg".repeat(32);
  await assert.rejects(() => verifyProof(badHex), TypeError);

  const badPosition = structuredClone(currentBundle);
  badPosition.proof[0].position = "RIGHT";
  await assert.rejects(() => verifyProof(badPosition), TypeError);
});

await test("proof arrays are bounded and hole-free", async () => {
  const long = structuredClone(currentBundle);
  long.proof = Array.from({ length: 65 }, () => ({
    hash: LEAF1,
    position: "left",
  }));
  await assert.rejects(() => verifyProof(long), RangeError);

  const hole = structuredClone(currentBundle);
  hole.proof = new Array(1);
  await assert.rejects(() => verifyProof(hole), TypeError);
});

await test("leaf count rejects coercion and u64 wraparound", () => {
  assert.throws(() => commitRoot(RAW_ROOT, "2"), TypeError);
  assert.throws(() => commitRoot(RAW_ROOT, false), TypeError);
  assert.throws(() => commitRoot(RAW_ROOT, Number.NaN), TypeError);
  assert.throws(() => commitRoot(RAW_ROOT, 1.5), TypeError);
  assert.throws(() => commitRoot(RAW_ROOT, 0), RangeError);
  assert.throws(
    () => commitRoot(RAW_ROOT, 0x10000000000000000n),
    RangeError,
  );
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
