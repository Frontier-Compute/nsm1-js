import assert from "node:assert/strict";

export function trailingJson(text) {
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

export function publishedCandidate(value) {
  const candidates = Array.isArray(value)
    ? value
    : value?.name
      ? [value]
      : Object.values(value ?? {});
  assert.equal(candidates.length, 1, "expected one published package result");
  return candidates[0];
}
