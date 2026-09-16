import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");

function listFiles(dir, predicate = () => true) {
	const base = join(root, dir);
	if (!existsSync(base)) return [];
	const result = [];
	for (const entry of readdirSync(base)) {
		const relative = join(dir, entry).replaceAll("\\", "/");
		const stat = statSync(join(root, relative));
		if (stat.isDirectory()) result.push(...listFiles(relative, predicate));
		else if (predicate(relative)) result.push(relative);
	}
	return result;
}

function countMatches(files, pattern) {
	return files.reduce((count, file) => count + (read(file).match(pattern) || []).length, 0);
}

const tsxFiles = () => listFiles("apps/web/src", (file) => file.endsWith(".tsx"));
const sourceFiles = () => listFiles("apps/web/src", (file) => /\.(ts|tsx)$/.test(file));

test("design system owns primitive buttons and fields", () => {
	const files = tsxFiles();
	const nativeButtonFiles = files.filter((file) => read(file).includes("<button"));
	const nativeInputFiles = files.filter((file) => read(file).includes("<input"));
	const nativeSelectFiles = files.filter((file) => read(file).includes("<select"));
	const nativeTextareaFiles = files.filter((file) => read(file).includes("<textarea"));

	assert.deepEqual(nativeButtonFiles, ["apps/web/src/components/ui/button.tsx"]);
	assert.deepEqual(nativeInputFiles, ["apps/web/src/components/ui/field.tsx"]);
	assert.deepEqual(nativeSelectFiles, ["apps/web/src/components/ui/field.tsx"]);
	assert.deepEqual(nativeTextareaFiles, ["apps/web/src/components/ui/field.tsx"]);

	const combined = files.map(read).join("\n");
	assert.ok((combined.match(/<Button\b/g) || []).length >= 300, "expected migrated Button usage");
	assert.ok((combined.match(/<Input\b/g) || []).length >= 100, "expected migrated Input usage");
	assert.ok((combined.match(/<Select\b/g) || []).length >= 20, "expected migrated Select usage");
	assert.ok((combined.match(/<Textarea\b/g) || []).length >= 10, "expected migrated Textarea usage");
});

test("design system owns dialogs and navigation tabs", () => {
	const files = tsxFiles();
	const dialogFiles = files.filter((file) => read(file).includes('role="dialog"'));
	const tablistFiles = files.filter((file) => read(file).includes('role="tablist"'));

	assert.deepEqual(dialogFiles, ["apps/web/src/components/ui/modal.tsx"]);
	assert.deepEqual(tablistFiles, ["apps/web/src/components/ui/tabs.tsx"]);

	const combined = files.map(read).join("\n");
	assert.ok((combined.match(/<Modal\b/g) || []).length >= 15, "expected Modal usage");
	assert.ok((combined.match(/<Tabs\b/g) || []).length >= 5, "expected Tabs usage");
	assert.ok((combined.match(/<TabButton\b/g) || []).length >= 10, "expected TabButton usage");
});

test("design system primitives stay present", () => {
	for (const file of [
		"apps/web/src/components/ui/button.tsx",
		"apps/web/src/components/ui/field.tsx",
		"apps/web/src/components/ui/tabs.tsx",
		"apps/web/src/components/ui/panel.tsx",
		"apps/web/src/components/ui/modal.tsx",
		"apps/web/src/components/ui/badge.tsx",
		"apps/web/src/components/ui/layout.tsx",
		"apps/web/src/app/styles/tokens.css",
		"apps/web/src/app/styles/layout-system.css"
	]) {
		assert.ok(existsSync(join(root, file)), `design system file missing: ${file}`);
	}

	const uiSource = read("apps/web/src/components/ui/button.tsx") + read("apps/web/src/components/ui/field.tsx") + read("apps/web/src/components/ui/panel.tsx") + read("apps/web/src/components/ui/badge.tsx") + read("apps/web/src/components/ui/layout.tsx");
	for (const exportName of ["Button", "Input", "Select", "Textarea", "Tabs", "TabButton", "Panel", "Card", "Section", "Badge", "Tag", "Chip", "Stack", "Inline", "Grid", "Split"]) {
		assert.match(uiSource + read("apps/web/src/components/ui/tabs.tsx"), new RegExp(`export .*${exportName}|export function ${exportName}|export const ${exportName}`), `missing ${exportName}`);
	}
});

test("frontend architecture has no legacy compatibility wrappers", () => {
	for (const path of [
		"apps/web/src/components/slash-studio",
		"apps/web/src/components/server-settings",
		"apps/web/src/server/sessions"
	]) {
		assert.ok(!existsSync(join(root, path)), `legacy compatibility path should be gone: ${path}`);
	}

	const app = read("apps/web/src/components/botdeck-app.tsx");
	const core = read("apps/web/src/features/workspace/core/index.tsx");
	assert.ok(app.split("\n").length < 2600, "botdeck-app.tsx split threshold exceeded");
	assert.ok(core.split("\n").length < 350, "workspace core index should stay an orchestrator");
});

test("API routes use shared response helpers where migrated", () => {
	const helper = read("apps/web/src/server/api-response.ts");
	assert.match(helper, /okJson/);
	assert.match(helper, /errorJson/);
	assert.match(helper, /noStoreJson/);

	for (const file of [
		"apps/web/src/app/api/bootstrap/route.ts",
		"apps/web/src/app/api/bots/route.ts",
		"apps/web/src/app/api/gif/resolve/route.ts",
		"apps/web/src/app/api/health/route.ts",
		"apps/web/src/app/api/search/messages/route.ts",
		"apps/web/src/app/api/tls/status/route.ts"
	]) {
		assert.match(read(file), /(okJson|errorJson|noStoreJson|errorMessage)/, `${file} should use API helpers`);
	}
});

test("backend cleanup slices remain in place", () => {
	for (const file of [
		"apps/web/src/server/database-introspection.ts",
		"apps/web/src/server/database-backups.ts",
		"apps/web/src/features/bot-session/server/bot-session-lifecycle.ts"
	]) {
		assert.ok(existsSync(join(root, file)), `missing cleanup artifact ${file}`);
	}

	const bootstrapLines = read("apps/web/src/server/database-bootstrap.ts").split("\n").length;
	const botSessionLines = read("apps/web/src/features/bot-session/server/bot-session.ts").split("\n").length;
	assert.ok(bootstrapLines < 330, "database bootstrap should stay split");
	assert.ok(botSessionLines < 1900, "bot session should not grow back past cleanup threshold");
});


test("about modal displays the release version from package metadata", () => {
	const nextConfig = read("apps/web/next.config.ts");
	const launcherViews = read("apps/web/src/features/workspace/components/botdeck-launcher-views.tsx");
	const styles = read("apps/web/src/app/styles/first-launch.css");

	assert.match(nextConfig, /rootPackage\.version/);
	assert.match(nextConfig, /NEXT_PUBLIC_BOTDECK_VERSION/);
	assert.match(launcherViews, /BOTDECK_VERSION/);
	assert.match(launcherViews, /projectInfoMeta/);
	assert.match(launcherViews, /v\{BOTDECK_VERSION\}/);
	assert.match(styles, /\.projectInfoMeta\b/);
});

test("local WebSocket uses direct HTTP and same-origin HTTPS transports", () => {
	const desktopServer = read("apps/desktop/botdeck-server.cjs");
	const transport = read("apps/web/src/features/workspace/core/botdeck-transport.ts");
	const bootstrap = read("apps/web/src/app/api/bootstrap/route.ts");
	const controlPlane = read("apps/web/src/server/control-plane.ts");

	assert.match(desktopServer, /attachBotdeckWebSocketProxy/);
	assert.match(desktopServer, /pathname === "\/botdeck-ws"/);
	assert.match(desktopServer, /getUpgradeHandler/);
	assert.ok(desktopServer.indexOf("await app.prepare()") < desktopServer.indexOf("getUpgradeHandler"), "Next upgrade handler must be created after app.prepare()");
	assert.match(transport, /BOTDECK_WS_PATH = "\/botdeck-ws"/);
	assert.match(transport, /window\.location\.protocol === "https:"/);
	assert.match(transport, /return runtimeUrl \|\| "ws:\/\/127\.0\.0\.1:3001"/);
	assert.match(transport, /wss:\/\/\$\{host\}\$\{BOTDECK_WS_PATH\}/);
	assert.match(bootstrap, /wsUrl: plane\.createBrowserWebSocketUrl\(request\)/);
	assert.match(controlPlane, /createBrowserWebSocketUrl/);
	assert.doesNotMatch(transport, /secure \? "3002" : "3001"/);
});


test("embed composer modal keeps its editor scrollable", () => {
	const composer = read("apps/web/src/components/embeds/embed-composer.tsx");
	const styles = read("apps/web/src/app/styles/messages.css");

	assert.match(composer, /className="embedComposerUnifiedEditor"/);
	assert.match(styles, /\.embedComposerModal\s*\{[\s\S]*grid-template-rows:\s*auto minmax\(0, 1fr\) auto/);
	assert.match(styles, /\.embedComposerUnifiedEditor\s*\{[\s\S]*min-height:\s*0/);
	assert.match(styles, /\.embedComposerUnifiedEditor\s*\{[\s\S]*overflow-y:\s*auto/);
});
