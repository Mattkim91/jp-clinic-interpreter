export type WakeMode = "native" | "video" | "unsupported";

type Sentinel = { release: () => Promise<void>; addEventListener: (type: "release", fn: () => void) => void };

export function createWake(video: HTMLVideoElement) {
  let sentinel: Sentinel | null = null;
  let mode: WakeMode = "unsupported";
  let holding = false;

  async function acquire(fromGesture: boolean): Promise<WakeMode> {
    holding = true;
    const nav = navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<Sentinel> } };
    if (nav.wakeLock) {
      try {
        const next = await nav.wakeLock.request("screen");
        sentinel = next;
        next.addEventListener("release", () => {
          if (sentinel === next) sentinel = null;
          if (holding && document.visibilityState === "visible") void acquire(false);
        });
        mode = "native";
        video.pause();
        return mode;
      } catch {
        /* iOS before 16.4, or a denied request */
      }
    }
    if (fromGesture) {
      try {
        video.muted = true;
        video.defaultMuted = true;
        video.playsInline = true;
        video.loop = true;
        await video.play();
        mode = "video";
        return mode;
      } catch {
        /* autoplay rejected */
      }
    }
    mode = "unsupported";
    return mode;
  }

  async function release(): Promise<void> {
    holding = false;
    try {
      await sentinel?.release();
    } catch {
      /* already released */
    }
    sentinel = null;
    video.pause();
    mode = "unsupported";
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && holding) void acquire(false);
  });

  return {
    acquire,
    release,
    current: () => mode,
  };
}
