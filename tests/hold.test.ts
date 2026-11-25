import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { createListener, type Listener } from "../src/speech";

class FakeRec {
  static made: FakeRec[] = [];
  lang = "";
  started = false;
  aborted = false;
  onresult: ((event: unknown) => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onstart: (() => void) | null = null;
  constructor() {
    FakeRec.made.push(this);
  }
  start() {
    this.started = true;
  }
  stop() {}
  abort() {
    this.aborted = true;
    this.onend?.();
  }
  hear(transcript: string) {
    this.onresult?.({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript } }] });
  }
}

describe("mic hold while the phone reads Korean aloud", () => {
  let finals: string[] = [];
  let states: string[] = [];
  let listener: Listener;

  beforeEach(() => {
    FakeRec.made = [];
    finals = [];
    states = [];
    (globalThis as Record<string, unknown>).window = { SpeechRecognition: FakeRec, setTimeout, clearTimeout };
    listener = createListener({
      onFinal: (text) => finals.push(text),
      onInterim: () => {},
      onState: (state) => states.push(state),
      onError: () => {},
      kind: "android",
    });
  });
  afterEach(() => {
    listener.stop();
    delete (globalThis as Record<string, unknown>).window;
  });

  it("closes the mic, keeps what was heard, and reopens in the same language", () => {
    listener.start("ja");
    FakeRec.made[0].hear("膝が痛いです");
    listener.hold();
    assert.deepEqual(finals, ["膝が痛いです"]);
    assert.equal(FakeRec.made[0].aborted, true);
    FakeRec.made[0].hear("ムルピ アパヨ");
    assert.deepEqual(finals, ["膝が痛いです"]);
    listener.release();
    assert.equal(FakeRec.made.length, 2);
    assert.equal(FakeRec.made[1].lang, "ja-JP");
    assert.equal(states.includes("idle"), false);
  });

  it("does not reopen after stop, and does nothing when the mic is off", () => {
    listener.hold();
    listener.release();
    assert.equal(FakeRec.made.length, 0);
    listener.start("ja");
    listener.hold();
    listener.stop();
    listener.release();
    assert.equal(FakeRec.made.length, 1);
  });

  it("lets a new mic start win over a hold", () => {
    listener.start("ja");
    listener.hold();
    listener.start("ko");
    listener.release();
    assert.equal(FakeRec.made.length, 2);
    assert.equal(FakeRec.made[1].lang, "ko-KR");
  });
});
