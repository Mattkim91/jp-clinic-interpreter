import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { afterEarly } from "../src/speech.ts";

describe("endings clear enough to send early", () => {
  it("leaves endings that often continue to the recognizer", async () => {
    const { endsClearly } = await import("../src/speech.ts");
    for (const ko of ["무릎 펴 보세요", "아프세요?", "괜찮습니다", "앉을까"]) assert.equal(endsClearly(ko, "ko"), true, ko);
    for (const ko of ["숨 참지", "엉덩이 들고", "오른쪽 다리는", "잡으면 안 되지"]) assert.equal(endsClearly(ko, "ko"), false, ko);
    assert.equal(endsClearly("膝を伸ばしてください", "ja"), true);
    assert.equal(endsClearly("痛い", "ja"), false);
    assert.equal(endsClearly("My knee hurts.", "en"), true);
    assert.equal(endsClearly("My knee hurts", "en"), false);
  });
});

describe("confirmation of a sentence sent early", () => {
  it("drops the same sentence, a small correction, or a repeat, and keeps new words", () => {
    assert.equal(afterEarly("무릎 펴세요", "무릎 펴세요."), "");
    assert.equal(afterEarly("무릎 펴세요", "무릎을 펴세요"), "");
    assert.equal(afterEarly("膝を伸ばして", "膝を伸ばして"), "");
    assert.equal(afterEarly("일어나세요", "일어나세요 천천히 걸어 볼게요"), "천천히 걸어 볼게요");
    assert.equal(afterEarly("앉으세요", "다리를 쭉 펴고 천천히 일어나 보세요"), "다리를 쭉 펴고 천천히 일어나 보세요");
    assert.equal(afterEarly("Please sit", "Please sit."), "");
  });
});
import { appendChunk, collapseRepeats, endsSentence, endsSentenceJa, flushDelay, PAUSE_AFTER_ENDING, PAUSE_CLEAR_END, PAUSE_WITHOUT_ENDING, recognitionLang } from "../src/speech.ts";

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
    assert.equal(flushDelay("무릎 펴세요"), PAUSE_CLEAR_END);
    assert.equal(flushDelay("숨 참지"), PAUSE_AFTER_ENDING);
    assert.equal(PAUSE_AFTER_ENDING, 700);
    assert.equal(PAUSE_CLEAR_END, 500);
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

describe("japanese sentence end detection", () => {
  it("recognizes finished Japanese sentences", () => {
    for (const t of ["痛いです", "大丈夫です。", "少し疲れました", "できません", "もう一度お願いします", "ちょっと待ってください", "これでいいですか", "痛いですか？", "怖いね", "はい", "痛い", "分かった", "まだ無理だよ", "動かない", "頑張ります!", "少し休みたい…"]) {
      assert.equal(endsSentenceJa(t), true, t);
      assert.equal(endsSentence(t, "ja"), true, t);
    }
  });
  it("waits on unfinished Japanese clauses", () => {
    for (const t of ["右足を", "膝が", "ちょっと腰が痛くて", "歩くと", "それから", "昨日の夜から", "手を上げると肩が"]) {
      assert.equal(endsSentenceJa(t), false, t);
    }
  });
  it("uses the same pause logic in Japanese", () => {
    assert.equal(flushDelay("痛いです", "ja"), PAUSE_CLEAR_END);
    assert.equal(flushDelay("痛い", "ja"), PAUSE_AFTER_ENDING);
    assert.equal(flushDelay("膝が", "ja"), PAUSE_WITHOUT_ENDING);
  });
  it("keeps Korean detection as the default", () => {
    assert.equal(flushDelay("무릎 펴세요"), PAUSE_CLEAR_END);
    assert.equal(endsSentence("痛いです"), false);
    assert.equal(recognitionLang("ja"), "ja-JP");
    assert.equal(recognitionLang("ko"), "ko-KR");
  });
});

describe("japanese chunk merging", () => {
  it("drops Android re-sent Japanese chunks", () => {
    let p = appendChunk("", "膝が痛い", "ja");
    p = appendChunk(p, "膝が痛い", "ja");
    assert.equal(p, "膝が痛い");
    p = appendChunk(p, "膝が痛いです", "ja");
    assert.equal(p, "膝が痛いです");
  });
  it("joins Japanese chunks without spaces and merges overlaps", () => {
    assert.equal(appendChunk("右足が", "少し痛い", "ja"), "右足が少し痛い");
    assert.equal(appendChunk("右足が少し", "少し痛いです", "ja"), "右足が少し痛いです");
    assert.equal(collapseRepeats("痛い 痛い です"), "痛い です");
  });
});
