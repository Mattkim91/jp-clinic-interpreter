/** Notices a newer version on the site: a home-screen app can stay open for days without loading the page again. */

const CHECK_EVERY_MS = 60000;
const TRIED_KEY = "clinic-updated-to";

/** [3, 10] for "v3.10". */
function parts(version: string): number[] {
  return (version.match(/\d+/g) ?? []).map(Number);
}

/** The version a page shows, when it is newer than ours; otherwise "". */
export function newerVersion(html: string, current: string): string {
  const found = html.match(/app-version">\s*(v[\d.]+)/)?.[1] ?? "";
  if (!found) return "";
  const [a, b] = [parts(found), parts(current)];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff) return diff > 0 ? found : "";
  }
  return "";
}

export function watchForUpdates(options: {
  /** Nothing would be lost by loading the page again now. */
  idle: () => boolean;
  onFound: (version: string) => void;
}): void {
  const current = document.querySelector(".app-version")?.textContent ?? "";
  let checkedAt = Date.now();
  const check = async () => {
    if (document.visibilityState !== "visible" || Date.now() - checkedAt < CHECK_EVERY_MS) return;
    checkedAt = Date.now();
    try {
      const response = await fetch(window.location.pathname, { cache: "no-store", signal: AbortSignal.timeout(8000) });
      const version = response.ok ? newerVersion(await response.text(), current) : "";
      if (!version) return;
      // Only once per version, so a page that keeps coming back old cannot loop.
      if (options.idle() && sessionStorage.getItem(TRIED_KEY) !== version) {
        sessionStorage.setItem(TRIED_KEY, version);
        window.location.reload();
        return;
      }
      options.onFound(version);
    } catch {
      /* offline: keep using what is open */
    }
  };
  document.addEventListener("visibilitychange", () => void check());
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) void check();
  });
}
