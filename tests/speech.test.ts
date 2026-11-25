import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { appendChunk, collapseRepeats, endsSentence, flushDelay, PAUSE_AFTER_ENDING, PAUSE_WITHOUT_ENDING } from "../src/speech.ts";

describe("sentence end detection", () => {
  it("recognizes finished Korean sentences", () => {
    for (const t of ["엉덩이 들어보세요", "숨 크게 쉬세요.", "아프면 말씀해 주세요", "괜찮습니다", "아프세요?", "좋아요!", "다시 해볼까", "천천히 하자"]) {
      assert.equal(endsSentence(t), true, t);
    }
  });
  it("waits on unfinished clauses", () => {
    for (const t of ["엉덩이를", "숨을 크게 들이쉬고", "아프면", "무릎을 펴서", "천천히 일어나면서"]) {
      assert.equal(endsSentence(t), false, t);
    }
  });
  it("uses a longer pause when the sentence is not finished", () => {
    assert.equal(flushDelay("무릎을 펴서"), PAUSE_WITHOUT_ENDING);
    assert.equal(flushDelay("무릎 펴세요"), PAUSE_AFTER_ENDING);
  });
  it("joins chunks into one sentence without repeats", () => {
    let p = appendChunk("", "숨을 크게 들이쉬고");
    p = appendChunk(p, "천천히 내쉬세요");
    p = appendChunk(p, "천천히 내쉬세요");
    assert.equal(p, "숨을 크게 들이쉬고 천천히 내쉬세요");
  });
});

describe("android repeated chunks", () => {
  it("collapses restarted phrases", () => {
    assert.equal(collapseRepeats("여기 여기 매트에 여기 매트에 누워 여기 매트에 누워 보세요"), "여기 매트에 누워 보세요");
    assert.equal(collapseRepeats("별일 별일 없으셨나요"), "별일 없으셨나요");
    assert.equal(collapseRepeats("천천히 일어나세요"), "천천히 일어나세요");
  });
  it("merges cumulative and overlapping chunks", () => {
    let p = appendChunk("", "여기");
    p = appendChunk(p, "여기 매트에");
    p = appendChunk(p, "여기 매트에 누워");
    p = appendChunk(p, "누워 보세요");
    assert.equal(p, "여기 매트에 누워 보세요");
  });
});
