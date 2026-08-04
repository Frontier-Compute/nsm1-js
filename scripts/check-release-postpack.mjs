if (process.env.npm_command === "pack") {
  console.log("release postpack gate skipped for non-publish pack");
} else {
  await import("./check-release.mjs");
}
