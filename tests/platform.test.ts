import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectPlatform, restartDelay } from "../src/platform.ts";
import { collectUtterance } from "../src/speech.ts";

describe("platform detection", () => {
  it("treats iPhone Safari and Chrome on iOS as one-shot recognition", () => {
    const safari = detectPlatform(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    );
    assert.equal(safari.kind, "ios");
    assert.equal(safari.continuousRecognition, false);

    const crios = detectPlatform(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1",
    );
    assert.equal(crios.kind, "ios");
    assert.equal(crios.chromeOnIos, true);
    assert.equal(crios.continuousRecognition, false);
  });

  it("keeps a continuous session on Android Chrome and Samsung Internet", () => {
    const chrome = detectPlatform(
      "Mozilla/5.0 (Linux; Android 14; SM-S928N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
    );
    assert.equal(chrome.kind, "android");
    assert.equal(chrome.continuousRecognition, true);

    const samsung = detectPlatform(
      "Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S928N) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36",
    );
    assert.equal(samsung.samsung, true);
    assert.equal(samsung.continuousRecognition, true);
  });

  it("backs off when recognition ends without hearing anything", () => {
    assert.ok(restartDelay("ios", 0) >= 280);
    assert.ok(restartDelay("android", 8) > restartDelay("android", 0));
  });
});

describe("recognition results", () => {
  it("separates final sentences from the interim tail", () => {
    const heard = collectUtterance(
      [
        { isFinal: true, transcript: "엉덩이 들어보세요" },
        { isFinal: false, transcript: "숨 크게" },
      ],
      0,
    );
    assert.deepEqual(heard.finals, ["엉덩이 들어보세요"]);
    assert.equal(heard.interim, "숨 크게");
  });
});
