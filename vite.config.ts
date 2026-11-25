import { createReadStream, existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

const root = path.dirname(fileURLToPath(import.meta.url));
const vendoredDict = path.join(root, "vendor/kuromoji-dict");
const dictSrc = existsSync(vendoredDict) ? vendoredDict : path.join(root, "node_modules/kuromoji/dict");

function kuromojiDict(): Plugin {
  return {
    name: "kuromoji-dict",
    configureServer(server) {
      server.middlewares.use("/kuromoji-dict", (req, res, next) => {
        const name = decodeURIComponent((req.url ?? "").split("?")[0]).replace(/^\/+/, "");
        const target = path.join(dictSrc, name);
        if (!name || !target.startsWith(dictSrc) || !existsSync(target) || !statSync(target).isFile()) {
          next();
          return;
        }
        res.setHeader("Content-Type", "application/octet-stream");
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        createReadStream(target).pipe(res);
      });
    },
    generateBundle() {
      if (!existsSync(dictSrc)) return;
      for (const file of readdirSync(dictSrc)) {
        this.emitFile({
          type: "asset",
          fileName: `kuromoji-dict/${file}`,
          source: readFileSync(path.join(dictSrc, file)),
        });
      }
    },
  };
}

function zlibJsThis(): Plugin {
  return {
    name: "zlibjs-this",
    enforce: "pre",
    transform(code, id) {
      const file = id.split("?")[0].replace(/\\/g, "/");
      if (file.endsWith("zlibjs/bin/gunzip.min.js")) {
        return code.replace(/\.call\(this\)\s*;?\s*$/, ".call(module.exports);");
      }
      // Some static hosts mark .gz as Content-Encoding: gzip, so the browser
      // has already inflated the dictionary. Kuromoji must accept both.
      if (file.endsWith("kuromoji/src/loader/BrowserDictionaryLoader.js")) {
        return code.replace(
          "var arraybuffer = this.response;\n\n        var gz = new zlib.Zlib.Gunzip(new Uint8Array(arraybuffer));",
          `var arraybuffer = this.response;
        var bytes = new Uint8Array(arraybuffer);
        if (!(bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b)) {
          callback(null, arraybuffer);
          return;
        }
        var gz = new zlib.Zlib.Gunzip(bytes);`,
        );
      }
      return null;
    },
  };
}

// Local dev stays relative. GitHub Pages sets VITE_BASE=/jp-clinic-interpreter/
// so scripts, the dictionary, and the service worker resolve under that subpath.
const base = process.env.VITE_BASE || "./";

export default defineConfig({
  base,
  plugins: [zlibJsThis(), kuromojiDict()],
  resolve: {
    alias: { path: path.join(root, "src/shims/path.js") },
  },
  optimizeDeps: {
    include: ["kuromoji"],
    esbuildOptions: {
      plugins: [
        {
          name: "zlibjs-this",
          setup(build) {
            build.onLoad({ filter: /gunzip\.min\.js$/ }, async (args) => {
              const code = (await readFile(args.path, "utf8")).replace(
                /\.call\(this\)\s*;?\s*$/,
                ".call(typeof exports !== 'undefined' ? exports : globalThis);",
              );
              return { contents: code, loader: "js" };
            });
          },
        },
      ],
    },
  },
  server: { host: "0.0.0.0", port: 41723, strictPort: true },
  preview: { host: "0.0.0.0", port: 41723, strictPort: true },
  build: { target: "es2020" },
});
