import { defineConfig } from "tsup"
import { readFileSync } from "node:fs"

const packageVersion = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8")
).version
const define = { __PACKAGE_VERSION__: JSON.stringify(packageVersion) }

export default defineConfig([
  {
    entry: ["src/index.ts", "src/cli.ts"],
    format: ["cjs"],
    outDir: "dist/commonjs",
    clean: false,
    define,
  },
  {
    entry: ["src/index.ts", "src/cli.ts"],
    format: ["esm"],
    outDir: "dist/module",
    outExtension: () => ({ js: ".js" }),
    clean: false,
    define,
  },
])
