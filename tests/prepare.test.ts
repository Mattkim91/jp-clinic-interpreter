import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { prepare } from "../src/prepare.ts";

describe("clinic phrase preparation", () => {
  it("pins the five sample lines to polite Japanese", () => {
    assert.equal(prepare("엉덩이 들어보세요").overrideJa, "お尻を上げてください");
    assert.equal(prepare("숨 크게 쉬세요").overrideJa, "息を大きく吸ってください");
    assert.equal(prepare("아프면 말씀해 주세요").overrideJa, "痛い場合は教えてください");
    assert.equal(prepare("천천히 일어나세요").overrideJa, "ゆっくり起きてください");
    assert.equal(prepare("무릎 펴세요").overrideJa, "膝を伸ばしてください");
  });

  it("catches the same lines without spaces and the dangerous homonyms", () => {
    assert.equal(prepare("엉덩이들어보세요").overrideJa, "お尻を上げてください");
    assert.equal(prepare("배에 힘 주세요").overrideJa, "お腹に力を入れてください");
    assert.equal(prepare("깊게 들이쉬고 내쉬세요").overrideJa, "深く息を吸って吐いてください");
  });

  it("rewrites other body-part lifts so 들다 is not heard as listen", () => {
    const prepared = prepare("다리 들어보세요");
    assert.equal(prepared.overrideJa, undefined);
    assert.equal(prepared.query, "다리를 위로 올려 주세요");
  });
});
