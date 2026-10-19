// Builds the browser demo's API worker (src/demo/worker.ts) into public/demo/, with the PGlite
// files it loads beside it. The app's real route handlers run inside it; server-only pieces
// (Postgres, Better Auth, email, push, AI, DNS) are swapped for the stand-ins in src/demo/shims.
import { copyFileSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";

const root = process.cwd();
const src = (p) => path.join(root, "src", p);
const out = path.join(root, "public", "demo");

// Endpoints with no meaning in a browser-only demo answer "not available" instead.
const SKIP = ["auth", "cron", "events", "changes", "push", "ai", "ical", "export", "import", "tokens", "webhooks", "invites"];

function routeFiles(dir, prefix = "") {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.isDirectory()) return routeFiles(path.join(dir, e.name), `${prefix}/${e.name}`);
    return e.name === "route.ts" ? [prefix] : [];
  });
}
const routes = routeFiles(src("app/api"))
  .filter((r) => !SKIP.includes(r.split("/")[1]))
  // Static segments before dynamic ones, so /tasks/x/comments isn't taken by /tasks/[id].
  .sort((a, b) => b.split("/").length - a.split("/").length || a.localeCompare(b));

const routesModule = routes
  .map((r, i) => `import * as m${i} from ${JSON.stringify(src(`app/api${r}/route.ts`))};`)
  .concat(
    `export const routes = [${routes
      .map((r, i) => {
        const keys = [...r.matchAll(/\[(\w+)\]/g)].map((m) => m[1]);
        const pattern = `^/api${r.replace(/\[\w+\]/g, "([^/]+)")}$`;
        return `{ pattern: new RegExp(${JSON.stringify(pattern)}), keys: ${JSON.stringify(keys)}, mod: m${i} }`;
      })
      .join(",\n")}];`,
  )
  .join("\n");

const journal = JSON.parse(readFileSync(path.join(root, "drizzle/meta/_journal.json"), "utf8"));
const migrations = journal.entries.map((e) => readFileSync(path.join(root, "drizzle", `${e.tag}.sql`), "utf8"));

const shim = (name) => src(`demo/shims/${name}.ts`);
const swaps = {
  "server-only": shim("empty"),
  "node:crypto": shim("crypto"),
  "node:async_hooks": shim("async-hooks"),
  "node:net": shim("net"),
  "node:dns/promises": shim("net"),
  "web-push": shim("empty"),
  nodemailer: shim("empty"),
  "@anthropic-ai/sdk": shim("empty"),
  "node:fs/promises": shim("fs"),
  "node:path": shim("fs"),
  // Imported (but never used in a browser) by dependencies.
  fs: shim("fs"),
  path: shim("fs"),
};

const demoPlugin = {
  name: "demo",
  setup(b) {
    b.onResolve({ filter: /^demo:routes$/ }, () => ({ path: "routes", namespace: "demo" }));
    b.onLoad({ filter: /.*/, namespace: "demo" }, () => ({ contents: routesModule, resolveDir: root, loader: "ts" }));
    b.onResolve({ filter: /.*/ }, (args) => {
      if (swaps[args.path]) return { path: swaps[args.path] };
      if (args.path.startsWith("@/")) return b.resolve(`./${args.path.slice(2)}`, { resolveDir: src(""), kind: args.kind });
    });
    // Server modules swapped wholesale, however they're imported: the database and Better Auth.
    const wholesale = new Map([
      [path.normalize(src("server/db/index.ts")), shim("db")],
      [path.normalize(src("server/auth.ts")), shim("auth")],
    ]);
    b.onLoad({ filter: /(index|auth)\.ts$/ }, (args) => {
      const to = wholesale.get(path.normalize(args.path));
      if (to) return { contents: `export * from ${JSON.stringify(to)};`, loader: "ts", resolveDir: root };
    });
  },
};

mkdirSync(out, { recursive: true });
await build({
  entryPoints: [src("demo/worker.ts")],
  outfile: path.join(out, "api-worker.js"),
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  minify: true,
  sourcemap: false,
  legalComments: "none",
  plugins: [demoPlugin],
  // Left to dynamic imports that only run under Node.
  external: ["fs/promises", "url", "module", "crypto", "util", "node:*"],
  define: {
    __DEMO_MIGRATIONS__: JSON.stringify(migrations),
    "process.env.NODE_ENV": '"production"',
  },
  banner: { js: "globalThis.process ??= { env: {} };" },
  logLevel: "warning",
});

const pglite = path.join(root, "node_modules/@electric-sql/pglite/dist");
for (const f of ["pglite.wasm", "pglite.data", "initdb.wasm"]) copyFileSync(path.join(pglite, f), path.join(out, f));
console.log(`[demo] built public/demo/api-worker.js (${routes.length} routes)`);
