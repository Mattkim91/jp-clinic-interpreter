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
  partly(transcript: string) {
    this.onresult?.({ resultIndex: 0, results: [{ isFinal: false, 0: { transcript } }] });
  }
}

describe("sending a finished sentence before the recognizer confirms it", () => {
  let finals: string[] = [];
  let listener: Listener;
  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  beforeEach(() => {
    FakeRec.made = [];
    finals = [];
    (globalThis as Record<string, unknown>).window = { SpeechRecognition: FakeRec, setTimeout, clearTimeout };
    listener = createListener({ onFinal: (text) => finals.push(text), onInterim: () => {}, onState: () => {}, onError: () => {}, kind: "android" });
    listener.start("ko");
  });
  afterEach(() => {
    listener.stop();
    delete (globalThis as Record<string, unknown>).window;
  });

  it("counts the 0.5 s from when the words stop, and makes one card when the confirmation comes late", async () => {
    const rec = FakeRec.made[0];
    rec.partly("무릎을 천천히");
    rec.partly("무릎을 천천히 펴 보세요");
    await wait(420);
    assert.deepEqual(finals, []);
    await wait(150);
    assert.deepEqual(finals, ["무릎을 천천히 펴 보세요"]);
    rec.hear("무릎을 천천히 펴 보세요.");
    await wait(800);
    assert.deepEqual(finals, ["무릎을 천천히 펴 보세요"]);
  });

  it("waits again when more words come, and does not cut a sentence that goes on", async () => {
    const rec = FakeRec.made[0];
    rec.partly("숨을 참으세요");
    await wait(300);
    rec.partly("숨을 참으세요 아니 참지 마세요");
    await wait(380);
    assert.deepEqual(finals, []);
    await wait(200);
    assert.deepEqual(finals, ["숨을 참으세요 아니 참지 마세요"]);
  });

  it("does not hurry a sentence that has not ended", async () => {
    const rec = FakeRec.made[0];
    rec.partly("숨 참지");
    await wait(900);
    assert.deepEqual(finals, []);
    rec.hear("숨 참지 마세요");
    await wait(800);
    assert.deepEqual(finals, ["숨 참지 마세요"]);
  });

  it("keeps the timing when the confirmation comes during the wait", async () => {
    const rec = FakeRec.made[0];
    rec.partly("엉덩이 들어보세요");
    await wait(300);
    rec.hear("엉덩이 들어보세요");
    await wait(260);
    assert.deepEqual(finals, ["엉덩이 들어보세요"]);
  });

  it("keeps words that came after a sentence already sent", async () => {
    const rec = FakeRec.made[0];
    rec.partly("일어나세요");
    await wait(560);
    assert.deepEqual(finals, ["일어나세요"]);
    rec.hear("일어나세요 천천히 걸어 볼게요");
    await wait(800);
    assert.deepEqual(finals, ["일어나세요", "천천히 걸어 볼게요"]);
  });
});

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
