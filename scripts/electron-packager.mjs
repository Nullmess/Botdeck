// Packaging Electron patché (Compat centralisée).

import path from "node:path";
import { pathToFileURL } from "node:url";

await import("./patch-electron-packager.mjs");
const cliPath = path.resolve(import.meta.dirname, "..", "node_modules", "@electron", "packager", "dist", "cli.js");
const { run } = await import(pathToFileURL(cliPath).toString());
await run(process.argv.slice(2));
