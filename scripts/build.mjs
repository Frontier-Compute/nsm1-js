import { copyFile, mkdir, rm } from "node:fs/promises";

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
await Promise.all([
  copyFile("src/index.js", "dist/index.js"),
  copyFile("src/index.d.ts", "dist/index.d.ts"),
  copyFile("src/blake2b.js", "dist/blake2b.js"),
]);
