import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { describe, it } from "node:test";
import { hangulFromTokens, type JaToken } from "../src/reading.ts";

const require = createRequire(import.meta.url);
const kuromoji = require("kuromoji") as {
  builder: (opts: { dicPath: string }) => {
    build: (cb: (err: Error | null, tokenizer: { tokenize: (s: string) => JaToken[] }) => void) => void;
  };
};

function tokenizer() {
  return new Promise<{ tokenize: (s: string) => JaToken[] }>((resolve, reject) => {
    kuromoji.builder({ dicPath: "node_modules/kuromoji/dict" }).build((err, built) => {
      if (err || !built) reject(err ?? new Error("no tokenizer"));
      else resolve(built);
    });
  });
}

describe("analyzer readings", () => {
  it("reads the five rehab lines the way a Korean therapist should say them", async () => {
    const tokens = await tokenizer();
    const cases: [string, string][] = [
      ["お尻を上げてください", "오시리오 아게테 쿠다사이"],
      ["息を大きく吸ってください", "이키오 오오키쿠 슷테 쿠다사이"],
      ["痛い場合は教えてください", "이타이 바아이와 오시에테 쿠다사이"],
      ["ゆっくり起きてください", "윳쿠리 오키테 쿠다사이"],
      ["膝を伸ばしてください", "히자오 노바시테 쿠다사이"],
    ];
    for (const [ja, hangul] of cases) {
      assert.equal(hangulFromTokens(tokens.tokenize(ja)), hangul, ja);
    }
  });

  it("keeps other cue lines readable", async () => {
    const tokens = await tokenizer();
    const expect: Record<string, string> = {
      "力を抜いてください": "치카라오 누이테 쿠다사이",
      "今休んでください": "이마 야슨데 쿠다사이",
      "十回繰り返してください": "주우카이 쿠리카에시테 쿠다사이",
      "頑張ってください": "간밧테 쿠다사이",
      "反対側に向かって横になってください": "한타이가와니 무캇테 요코니 낫테 쿠다사이",
      "お腹に力を入れてください": "오나카니 치카라오 이레테 쿠다사이",
      "上げています": "아게테 이마스",
      "東京": "토오쿄오",
      "先生": "센세에",
    };
    for (const [ja, hangul] of Object.entries(expect)) {
      assert.equal(hangulFromTokens(tokens.tokenize(ja)), hangul, ja);
    }
  });
});
