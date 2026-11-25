declare module "kuromoji" {
  export interface IpadicFeatures {
    surface_form: string;
    pos: string;
    pos_detail_1: string;
    pos_detail_2?: string;
    pos_detail_3?: string;
    conjugated_type?: string;
    conjugated_form?: string;
    basic_form?: string;
    reading?: string;
    pronunciation?: string;
  }

  export interface Tokenizer {
    tokenize(text: string): IpadicFeatures[];
  }

  export interface Builder {
    build(callback: (err: Error | null, tokenizer: Tokenizer) => void): void;
  }

  export interface KuromojiStatic {
    builder(options: { dicPath: string }): Builder;
  }

  const kuromoji: KuromojiStatic;
  export default kuromoji;
}
