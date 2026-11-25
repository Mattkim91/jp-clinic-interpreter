import kuromoji, { type Tokenizer } from "kuromoji";

export type { Tokenizer };

export function loadTokenizer(dicPath: string): Promise<Tokenizer> {
  return new Promise((resolve, reject) => {
    kuromoji.builder({ dicPath }).build((err, tokenizer) => {
      if (err || !tokenizer) reject(err ?? new Error("발음 사전을 열지 못했습니다"));
      else resolve(tokenizer);
    });
  });
}
