// Checks statiques Botdeck.
// Objectif: vérifier les invariants produit/sécurité qui cassent facilement lors des refactors.

import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const root = new URL("..", import.meta.url);
const fromRoot = (path) => new URL(path, root);

async function read(path) {
	return readFile(fromRoot(path), "utf8");
}

async function readIfExists(path) {
	try {
		return await read(path);
	} catch {
		return "";
	}
}

async function listFiles(dir, predicate = () => true) {
	const out = [];
	async function walk(current) {
		const entries = await readdir(fromRoot(current), { withFileTypes: true });
		for (const entry of entries) {
			const relative = join(current, entry.name).replaceAll("\\", "/");
			if (entry.isDirectory()) {
				await walk(relative);
			} else if (predicate(relative)) {
				out.push(relative);
			}
		}
	}
	await walk(dir);
	return out;
}

const componentFiles = [
	...await listFiles("apps/web/src/components", (file) => /\.(ts|tsx)$/.test(file)),
	...await listFiles("apps/web/src/features", (file) => /\.(ts|tsx)$/.test(file))
];
const serverFiles = [
	...await listFiles("apps/web/src/server", (file) => /\.(ts|tsx)$/.test(file)),
	...await listFiles("apps/web/src/features", (file) => /\.(ts|tsx)$/.test(file))
];
const cssFiles = await listFiles("apps/web/src/app/styles", (file) => file.endsWith(".css"));

const appEntry = await read("apps/web/src/components/botdeck-app.tsx");
const appCore = await read("apps/web/src/features/workspace/core/index.tsx");
const appI18n = await read("apps/web/src/features/workspace/core/botdeck-app-i18n.ts");
const components = (await Promise.all(componentFiles.map(read))).join("\n");
const server = (await Promise.all(serverFiles.map(read))).join("\n");
const cssImports = await read("apps/web/src/app/globals.css");
const css = `${cssImports}\n${(await Promise.all(cssFiles.map(read))).join("\n")}`;
const protocol = await read("packages/shared/src/protocol.ts");
const errors = await read("packages/shared/src/discord-errors.ts");
const gifResolveApi = await read("apps/web/src/app/api/gif/resolve/route.ts");
const searchApi = `${await readIfExists("apps/web/src/app/api/search/messages/route.ts")}\n${await readIfExists("apps/web/src/server/search/message-search-service.ts")}`;
const desktopMain = await read("apps/desktop/main.js");
const dbBootstrap = await read("apps/web/src/server/database-bootstrap.ts");
const runtimeSecret = await read("apps/web/src/server/runtime-secret.ts");
const bootstrapApi = await read("apps/web/src/app/api/bootstrap/route.ts");
const transportHook = `${await read("apps/web/src/components/botdeck-app.tsx")}\n${await read("apps/web/src/features/workspace/core/index.tsx")}\n${await read("apps/web/src/features/workspace/core/botdeck-transport.ts")}`;

const expectations = [
	["SlashCommandsPanel exists", /export function SlashCommandsPanel\s*\(/.test(components)],
	["Slash Studio has explicit sync state", /type SlashSyncState/.test(components) && /slashCommandSyncState/.test(components)],
	["Slash Studio persists local draft", /readStoredSlashCommandDraft/.test(components) && /writeStoredSlashCommandDraft/.test(components)],
	["Read-only mode exposes selectable policy options", /botAccountIsReadOnly/.test(components) && /readOnlyModeWriteBlocked/.test(components) && /commandBlockedByReadOnlyPolicy/.test(components) && /getReadOnlyCommandBlockKind/.test(server)],
	["Reaction picker uses a portal", /createPortal\(\(/.test(components) && /reactionPicker/.test(components)],
	["Removed bot-only reaction ghosts are hidden without hiding newly-added first reactions", /getVisibleMessageReactions/.test(components) && /hiddenBotOnlyReactionKeys/.test(components) && /reactionIdentityKey/.test(components) && /visibleReactions\.map/.test(components)],
	["Legacy botOpsTabs removed", !/botOpsTabs/.test(components)],
	["Readonly badge style exists", /topbarReadonlyBadge/.test(css)],
	["Slash sync status style exists", /slashSyncStatus/.test(css)],
	["Discord errors are normalized", /normalizeDiscordError/.test(errors) && /50013/.test(errors) && /50035/.test(errors)],
	["Server-side SQLite search endpoint exists", /api\/search\/messages/.test(searchApi) || /MessageSummary/.test(searchApi)],
	["Search panel can merge SQLite results", /mergeMessageSearchGroups/.test(components) && /serverMessageSearch/.test(components)],
	["Queue status is emitted through protocol", /sync\.queue/.test(protocol) && /lastSyncQueueToastRef/.test(components)],
	["Sync notifications use unified toasts", /lastSyncQueueEvent/.test(components) && /pushToast\(message, tone\)/.test(components) && !/<SyncQueueIndicator/.test(components)],
	["Unified toast style exists", /toastStack/.test(css) && /\.toast\b/.test(css)],
	["Embed composer supports pages and multiple embeds", /EmbedComposerPageDraft/.test(components) && /embedDraftPayloadsFromPages/.test(components) && /onSend\(embeds, content\)/.test(components) && /embedStudioModal/.test(css)],
	["Embed messages use Discord pagination buttons", /embedPagination:\s*embeds\.length > 1/.test(components) && /function messageEmbedPagePayload/.test(server) && /new ActionRowBuilder<ButtonBuilder>\(\)\.addComponents/.test(server) && /botdeck:messageembedpage/.test(server)],
	["Botdeck app is split into workspace core and i18n modules", /features\/workspace\/core/.test(appEntry) && /botdeck-app-i18n/.test(appCore) && /export const uiText/.test(appI18n)],
	["Botdeck UI widgets are split into a widgets module", /botdeck-app-widgets/.test(appEntry) && /slash-studio-widgets/.test(await read("apps/web/src/components/botdeck-app-widgets.tsx")) && /export function SlashCommandsPanel/.test(components)],
	["Control plane is split into helper module", /control-plane-helpers/.test(await read("apps/web/src/server/control-plane.ts")) && /export function runtimeReplyPayload/.test(await read("apps/web/src/server/control-plane-helpers.ts"))],
	["Bot session is split from control plane", /features\/bot-session\/server\/bot-session/.test(await read("apps/web/src/server/control-plane.ts")) && /export class BotSession/.test(await read("apps/web/src/features/bot-session/server/bot-session.ts"))],
	["Large helpers are split by domain", /control-plane-command-validation/.test(await read("apps/web/src/server/control-plane-helpers.ts")) && /control-plane-primitives/.test(await read("apps/web/src/server/control-plane-helpers.ts")) && /export function isCommandEnvelope/.test(await read("apps/web/src/server/control-plane-command-validation.ts"))],
	["Bot session cache helpers are isolated", /bot-session-cache/.test(await read("apps/web/src/features/bot-session/server/bot-session.ts")) && /export function modalResponsePayload/.test(await read("apps/web/src/features/bot-session/server/bot-session-cache.ts"))],
	["Dangerous channel modals are isolated", /features\/workspace\/components\/channel-modals/.test(appEntry) && /export function ChannelRecreateModal/.test(await read("apps/web/src/features/workspace/components/channel-modals.tsx"))],
	["Message search has server service module", /searchStoredMessages/.test(server) && /parseSearchOperators/.test(server)],
	["Botdeck widgets are split by domain slices", /slash-studio-widgets/.test(await read("apps/web/src/components/botdeck-app-widgets.tsx")) && /message-search-panel/.test(await read("apps/web/src/components/botdeck-app-widgets.tsx")) && /embed-composer/.test(await read("apps/web/src/components/botdeck-app-widgets.tsx"))],
	["Global CSS is split into style slices", /@import "\.\/styles\//.test(cssImports) && cssFiles.length >= 10],
	["Tenor and Giphy page GIF links resolve to inline media", /needsInlineGifResolution/.test(components) && /api\/gif\/resolve/.test(components) && /tenor\.com\/oembed/.test(gifResolveApi) && /media\\\.tenor\\\.com/.test(gifResolveApi)],
	["WebSocket auth token is exposed only through bootstrap", /createBrowserAuthToken/.test(bootstrapApi) && /wsAuthToken/.test(bootstrapApi)],
	["WebSocket client sends auth token", /wsAuthToken/.test(transportHook) && /searchParams\.set\("auth"/.test(transportHook)],
	["WebSocket server validates upgrade", /verifyClient/.test(await read("apps/web/src/server/control-plane.ts")) && /validateWebSocketClient/.test(server)],
	["Desktop storage uses userData", /app\.getPath\("userData"\)/.test(desktopMain) && /BOTDECK_DATA_DIR/.test(desktopMain) && /BOTDECK_RUNTIME_SECRET_PATH/.test(desktopMain)],
	["Runtime secret supports explicit userData path", /BOTDECK_RUNTIME_SECRET_PATH/.test(runtimeSecret) && /BOTDECK_DATA_DIR/.test(runtimeSecret)],
	["Database bootstrap uses migrations instead of destructive db push", /migrate deploy/.test(dbBootstrap) && !/--accept-data-loss/.test(dbBootstrap) && !/db push/.test(dbBootstrap)],
	["Read-only mode is stored explicitly", /readOnlyMode/.test(server) && /readOnlyMode/.test(await read("apps/web/prisma/schema.prisma")) && /20260627122000_read_only_mode/.test((await listFiles("apps/web/prisma/migrations")).join("\n"))],
	["Read-only optional policy is stored explicitly", /readOnlyBlockMessages/.test(server) && /readOnlyBlockChannels/.test(server) && /readOnlyBlockModeration/.test(server) && /20260627123500_read_only_policy_options/.test((await listFiles("apps/web/prisma/migrations")).join("\n"))]
];

const failures = expectations.filter(([, ok]) => !ok).map(([label]) => label);
if (failures.length) {
	console.error("Botdeck static check failed:");
	for (const failure of failures) console.error(`- ${failure}`);
	process.exit(1);
}

let balance = 0;
for (const char of css) {
	if (char === "{") balance += 1;
	if (char === "}") balance -= 1;
	if (balance < 0) break;
}
if (balance !== 0) {
	console.error(`CSS brace balance failed: ${balance}`);
	process.exit(1);
}

console.log("Botdeck static check passed.");
