import { isSided, placeWords, type Place, type Side } from "./answers";
import type { PatientLang } from "./lang";

export type View = "front" | "back";

type Box = { part: string; x: number; y: number; w: number; h: number; r?: number };

const WIDTH = 320;

/** Boxes on the left half of the picture; the other half is mirrored. */
const LIMBS: Record<View, Box[]> = {
  front: [
    { part: "shoulder", x: 64, y: 100, w: 50, h: 46, r: 20 },
    { part: "arm", x: 56, y: 149, w: 48, h: 46 },
    { part: "elbow", x: 50, y: 198, w: 48, h: 38 },
    { part: "forearm", x: 44, y: 239, w: 48, h: 44 },
    { part: "hand", x: 34, y: 286, w: 54, h: 52, r: 20 },
    { part: "hip", x: 104, y: 250, w: 54, h: 44 },
    { part: "thigh", x: 104, y: 297, w: 54, h: 60 },
    { part: "knee", x: 104, y: 360, w: 54, h: 42 },
    { part: "shin", x: 106, y: 405, w: 50, h: 56 },
    { part: "foot", x: 96, y: 464, w: 60, h: 44, r: 18 },
  ],
  back: [
    { part: "shoulder", x: 64, y: 100, w: 50, h: 46, r: 20 },
    { part: "arm", x: 56, y: 149, w: 48, h: 46 },
    { part: "elbow", x: 50, y: 198, w: 48, h: 38 },
    { part: "forearm", x: 44, y: 239, w: 48, h: 44 },
    { part: "hand", x: 34, y: 286, w: 54, h: 52, r: 20 },
    { part: "buttock", x: 104, y: 250, w: 54, h: 50, r: 18 },
    { part: "thighback", x: 104, y: 303, w: 54, h: 54 },
    { part: "kneeback", x: 104, y: 360, w: 54, h: 42 },
    { part: "calf", x: 106, y: 405, w: 50, h: 56 },
    { part: "foot", x: 96, y: 464, w: 60, h: 44, r: 18 },
  ],
};

const TRUNK: Record<View, Box[]> = {
  front: [
    { part: "head", x: 124, y: 4, w: 72, h: 66, r: 32 },
    { part: "neck", x: 138, y: 73, w: 44, h: 26 },
    { part: "chest", x: 117, y: 102, w: 86, h: 74 },
    { part: "belly", x: 117, y: 179, w: 86, h: 68 },
  ],
  back: [
    { part: "head", x: 124, y: 4, w: 72, h: 66, r: 32 },
    { part: "neck", x: 138, y: 73, w: 44, h: 26 },
    { part: "back", x: 117, y: 102, w: 86, h: 74 },
    { part: "waist", x: 117, y: 179, w: 86, h: 68 },
  ],
};

/** Facing us, the patient's right is on the left of the picture; from behind it is on the right. */
export function sideAt(view: View, half: "left" | "right"): Side {
  return (view === "front") === (half === "left") ? "right" : "left";
}

export function bodyZones(view: View): (Box & Place)[] {
  const limbs = LIMBS[view].flatMap((box) => [
    { ...box, side: sideAt(view, "left") },
    { ...box, x: WIDTH - box.x - box.w, side: sideAt(view, "right") },
  ]);
  return [...TRUNK[view], ...limbs];
}

export function bodySvg(view: View, lang: PatientLang): string {
  const zones = bodyZones(view)
    .map(({ part, side, x, y, w, h, r = 12 }) => {
      const words = placeWords({ part, side });
      return `<rect class="zone" role="button" tabindex="0" data-part="${part}" data-side="${isSided(part) ? side : ""}" aria-label="${words[lang]} (${words.ko})" x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/>`;
    })
    .join("");
  const face = view === "front" ? `<g class="face" aria-hidden="true"><circle cx="147" cy="32" r="3.5"/><circle cx="173" cy="32" r="3.5"/><path d="M148 49 Q160 57 172 49"/></g>` : "";
  return `<svg class="body-map" viewBox="20 0 280 512" role="group">${zones}${face}</svg>`;
}
