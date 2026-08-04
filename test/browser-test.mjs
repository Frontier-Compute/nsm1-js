import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { chromium } from "playwright";

const packageRoot = resolve(process.argv[2] ?? "dist");
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

const server = createServer(async (request, response) => {
  try {
    if (request.url === "/") {
      response.writeHead(200, { "content-type": mime[".html"] });
      response.end("<!doctype html><title>zap1 browser test</title>");
      return;
    }
    if (request.url !== "/index.js" && request.url !== "/blake2b.js") {
      response.writeHead(404);
      response.end("not found");
      return;
    }
    const path = resolve(packageRoot, request.url.slice(1));
    const bytes = await readFile(path);
    response.writeHead(200, {
      "content-type": mime[extname(path)] ?? "application/octet-stream",
    });
    response.end(bytes);
  } catch (error) {
    response.writeHead(500);
    response.end(String(error));
  }
});

await new Promise((resolveListen) =>
  server.listen(0, "127.0.0.1", resolveListen),
);
const address = server.address();
const origin = `http://127.0.0.1:${address.port}`;

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto(origin);
  const result = await page.evaluate(async () => {
    const zap1 = await import("/index.js");
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
    const valid = await zap1.verifyProof(bundle);
    const wrongCountBundle = structuredClone(bundle);
    wrongCountBundle.root.leaf_count = 3;
    const wrongCount = await zap1.verifyProof(wrongCountBundle);
    const unknownSchemeBundle = structuredClone(bundle);
    unknownSchemeBundle.root.scheme = "ZAP1_UNKNOWN";
    const unknownScheme = await zap1.verifyProof(unknownSchemeBundle);
    const malformedBundle = structuredClone(bundle);
    malformedBundle.proof[0].position = "sideways";
    let malformedRejected = false;
    try {
      await zap1.verifyProof(malformedBundle);
    } catch (error) {
      malformedRejected = error instanceof TypeError;
    }
    const legacyRootAsLeaf = await zap1.verifyProof(
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
    );
    return {
      valid,
      wrongCount,
      unknownScheme,
      malformedRejected,
      legacyRootAsLeaf,
      eventTypes: zap1.EVENT_TYPES.length,
      typedTypes: zap1.LEAF_HASH_TYPES.length,
    };
  });
  if (
    result.valid !== true ||
    result.wrongCount !== false ||
    result.unknownScheme !== false ||
    result.malformedRejected !== true ||
    result.legacyRootAsLeaf !== false ||
    result.eventTypes !== 18 ||
    result.typedTypes !== 2
  ) {
    throw new Error(`browser matrix failed: ${JSON.stringify(result)}`);
  }
  console.log("browser matrix passed");
} finally {
  await browser.close();
  await new Promise((resolveClose) => server.close(resolveClose));
}
