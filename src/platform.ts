export type PlatformKind = "ios" | "android" | "other";

export type PlatformInfo = {
  kind: PlatformKind;
  samsung: boolean;
  chromeOnIos: boolean;
  /** iOS ends each utterance; Android can keep one session but still drops it. */
  continuousRecognition: boolean;
};

export function detectPlatform(
  ua: string,
  extra?: { platform?: string; maxTouchPoints?: number },
): PlatformInfo {
  const iOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (extra?.platform === "MacIntel" && (extra.maxTouchPoints ?? 0) > 1);
  const android = /Android/i.test(ua);
  return {
    kind: iOS ? "ios" : android ? "android" : "other",
    samsung: /SamsungBrowser/i.test(ua),
    chromeOnIos: /CriOS|FxiOS|EdgiOS/i.test(ua),
    continuousRecognition: !iOS,
  };
}

export function restartDelay(kind: PlatformKind, quietRestarts: number): number {
  const base = kind === "ios" ? 300 : 180;
  if (quietRestarts <= 3) return base;
  return Math.min(1600, base + quietRestarts * 180);
}
