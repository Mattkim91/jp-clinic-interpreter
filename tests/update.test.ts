import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { newerVersion } from "../src/update.ts";

const page = (version: string) => `<h1>치료 통역 <span class="app-version">${version}</span></h1>`;

describe("noticing a newer version", () => {
  it("compares by number and never goes back", () => {
    assert.equal(newerVersion(page("v3.4"), "v3.3"), "v3.4");
    assert.equal(newerVersion(page("v3.10"), "v3.9"), "v3.10");
    assert.equal(newerVersion(page("v4.0"), "v3.9"), "v4.0");
    assert.equal(newerVersion(page("v3.3"), "v3.3"), "");
    assert.equal(newerVersion(page("v3.2"), "v3.3"), "");
    assert.equal(newerVersion("<html>not found</html>", "v3.3"), "");
  });

  it("finds the version in the real page", () => {
    assert.match(newerVersion(readFileSync("index.html", "utf8"), "v0.1"), /^v\d+\.\d+$/);
  });
});
