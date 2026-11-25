export function join(...parts) {
  const first = parts.find((part) => part != null && part !== "") ?? "";
  const prefix = String(first).startsWith("/") ? "/" : String(first).startsWith("./") ? "./" : "";
  const segs = [];
  for (const part of parts) {
    if (!part) continue;
    for (const bit of String(part).split(/[/\\]+/)) {
      if (bit === "" || bit === ".") continue;
      if (bit === "..") segs.pop();
      else segs.push(bit);
    }
  }
  return prefix + segs.join("/");
}

export default { join };
