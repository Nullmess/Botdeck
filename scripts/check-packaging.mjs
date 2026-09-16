import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => readFileSync(path.join(root, file), "utf8");
const pkg = JSON.parse(read("package.json"));

for (const script of ["build-win", "build-lin", "build-mac", "build-all", "release:check", "package:check"]) {
	assert.ok(pkg.scripts?.[script], `missing package script ${script}`);
}

for (const file of [
	"README.md",
	"CHANGELOG.md",
	"CONTRIBUTING.md",
	"LICENSE",
	"apps/desktop/main.js",
	"apps/desktop/server-runner.cjs",
	"apps/desktop/botdeck-server.cjs",
	"assets/app-icon.ico",
	"assets/app-icon.icns",
	"assets/app-icon.png",
	"scripts/electron-packager.mjs",
	"scripts/prepare-win-runtime.mjs"
]) {
	assert.ok(existsSync(path.join(root, file)), `missing packaging file ${file}`);
}

const desktopMain = read("apps/desktop/main.js");
assert.match(desktopMain, /app\.getPath\("userData"\)/, "desktop data must use Electron userData");
assert.match(desktopMain, /DATABASE_URL/, "desktop runtime must provide database URL");
assert.match(desktopMain, /debug\.log/, "desktop runtime should keep a userData debug log");
assert.doesNotMatch(desktopMain, /resources\/app.*botdeck\.db/, "desktop must not write database into packaged resources");

const readme = read("README.md");
assert.match(readme, /npm run build-win/);
assert.match(readme, /npm run build-lin/);
assert.match(readme, /npm run build-mac/);
assert.match(readme, /npm run package:check/);

console.log("Packaging gate passed.");
