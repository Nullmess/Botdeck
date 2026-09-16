import assert from "node:assert/strict";
import { test } from "node:test";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");

function listFiles(dir, predicate = () => true) {
	const result = [];
	for (const entry of readdirSync(join(root, dir))) {
		const relative = join(dir, entry).replaceAll("\\", "/");
		const stat = statSync(join(root, relative));
		if (stat.isDirectory()) result.push(...listFiles(relative, predicate));
		else if (predicate(relative)) result.push(relative);
	}
	return result;
}

test("quality scripts are available for external testers", () => {
	const pkg = JSON.parse(read("package.json"));
	for (const script of ["lint", "test", "typecheck", "check", "check:static", "check:secrets", "check:deps"]) {
		assert.ok(pkg.scripts?.[script], `missing ${script}`);
	}
});



test("release dependencies are pinned to stable channels", () => {
	const rootPkg = JSON.parse(read("package.json"));
	const webPkg = JSON.parse(read("apps/web/package.json"));
	const lockfile = JSON.parse(read("package-lock.json"));

	assert.equal(webPkg.dependencies.next, "16.2.9");
	assert.equal(webPkg.dependencies.react, "19.2.7");
	assert.equal(webPkg.dependencies["react-dom"], webPkg.dependencies.react);
	assert.equal(rootPkg.devDependencies.electron, "42.5.0");
	assert.equal(rootPkg.scripts["check:deps"], "node scripts/check-dependencies.mjs");
	assert.match(rootPkg.scripts.check, /check:deps/);
	for (const section of [rootPkg.dependencies, rootPkg.devDependencies, webPkg.dependencies, webPkg.devDependencies]) {
		for (const version of Object.values(section || {})) assert.doesNotMatch(version, /canary|preview|alpha|beta|rc/i);
	}
	assert.equal(lockfile.packages["node_modules/next"].version, "16.2.9");
	assert.equal(lockfile.packages["node_modules/react"].version, "19.2.7");
	assert.equal(lockfile.packages["node_modules/react-dom"].version, "19.2.7");
	assert.equal(lockfile.packages["node_modules/electron"].version, "42.5.0");
	assert.equal(rootPkg.overrides.postcss, "8.5.15");
	assert.equal(lockfile.packages["node_modules/postcss"].version, "8.5.15");
});

test("ci workflow runs the same public quality gate", () => {
	const workflow = read(".github/workflows/ci.yml");
	assert.match(workflow, /npm ci/);
	assert.match(workflow, /npm run check/);
});

test("websocket control plane requires local auth", () => {
	const controlPlane = read("apps/web/src/server/control-plane.ts");
	const websocketAuth = read("apps/web/src/server/websocket-auth.ts");
	const bootstrap = read("apps/web/src/app/api/bootstrap/route.ts");
	const app = `${read("apps/web/src/components/botdeck-app.tsx")}\n${read("apps/web/src/features/workspace/core/index.tsx")}\n${read("apps/web/src/features/workspace/core/botdeck-transport.ts")}`;

	assert.match(controlPlane, /verifyClient/);
	assert.match(controlPlane, /validateWebSocketClient/);
	assert.match(websocketAuth, /timingSafeEqual/);
	assert.match(websocketAuth, /originIsAllowed/);
	assert.match(bootstrap, /wsAuthToken/);
	assert.match(app, /searchParams\.set\("auth"/);
});

test("desktop runtime data is routed to userData", () => {
	const desktopMain = read("apps/desktop/main.js");
	const runtimeSecret = read("apps/web/src/server/runtime-secret.ts");
	const databaseUrl = read("apps/web/src/lib/database-url.ts");

	assert.match(desktopMain, /app\.getPath\("userData"\)/);
	assert.match(desktopMain, /BOTDECK_DATA_DIR/);
	assert.match(desktopMain, /BOTDECK_RUNTIME_SECRET_PATH/);
	assert.match(runtimeSecret, /BOTDECK_RUNTIME_SECRET_PATH/);
	assert.match(databaseUrl, /BOTDECK_DATA_DIR/);
});

test("database bootstrap uses versioned migrations and backup, never data-loss push", () => {
	const bootstrap = read("apps/web/src/server/database-bootstrap.ts");
	const backups = read("apps/web/src/server/database-backups.ts");
	const introspection = read("apps/web/src/server/database-introspection.ts");
	const migrations = listFiles("apps/web/prisma/migrations", (file) => file.endsWith("migration.sql"));

	assert.ok(migrations.length >= 1, "expected at least one Prisma migration");
	assert.match(bootstrap, /migrate deploy/);
	assert.match(bootstrap, /backupDatabaseBeforeMigration/);
	assert.match(backups, /copySqliteSidecarIfPresent/);
	assert.match(introspection, /listAppliedMigrations/);
	assert.doesNotMatch(`${bootstrap}\n${backups}\n${introspection}`, /--accept-data-loss/);
	assert.doesNotMatch(`${bootstrap}\n${backups}\n${introspection}`, /prisma\s+db\s+push/);
});

test("legacy static check stays aligned with current source layout", () => {
	const checkScript = read("scripts/check.mjs");
	assert.match(checkScript, /listFiles\("apps\/web\/src\/components"/);
	assert.match(checkScript, /listFiles\("apps\/web\/src\/features"/);
	assert.match(checkScript, /listFiles\("apps\/web\/src\/app\/styles"/);
});

test("repository contains persistent CI and tests", () => {
	assert.ok(existsSync(join(root, ".github/workflows/ci.yml")), "missing CI workflow");
	assert.ok(existsSync(join(root, "tests/quality-gates.test.mjs")), "missing quality tests");
});



test("public release package includes docs and reproducible setup files", () => {
	for (const file of [
		".github/workflows/ci.yml",
		".node-version",
		".nvmrc",
		".env.example",
		".gitignore",
		"README.md",
		"CHANGELOG.md",
		"CONTRIBUTING.md"
	]) {
		assert.ok(existsSync(join(root, file)), `missing public release file ${file}`);
	}

	const readme = read("README.md");
	const pkg = JSON.parse(read("package.json"));
	assert.doesNotMatch(readme, /status-alpha/i);
	assert.equal(read(".node-version").trim(), "24.17.0");
	assert.equal(read(".nvmrc").trim(), "24.17.0");
	assert.match(read(".gitignore"), /\.botdeck\//);
	assert.match(read(".env.example"), /BOTDECK_WS_HOST=127\.0\.0\.1/);
	assert.match(pkg.scripts["release:check"], /npm run quality/);
});



test("build assets are static and build-safe", () => {
	assert.ok(existsSync(join(root, "apps/web/public/app-icon.png")), "missing static app icon");
	assert.ok(existsSync(join(root, "apps/web/public/favicon.ico")), "missing static favicon");
	assert.ok(!existsSync(join(root, "apps/web/src/app/app-icon.png/route.ts")), "app icon should not be a dynamic route");
	assert.ok(!existsSync(join(root, "apps/web/src/app/favicon.ico/route.ts")), "favicon should not be a dynamic route");
	assert.ok(!existsSync(join(root, "apps/web/src/server/project-assets.ts")), "project asset resolver should not be traced by Next build");
});

test("workspace runner exits after successful scripts", () => {
	assert.match(read("scripts/run-workspaces.mjs"), /process\.exit\(0\);\s*$/);
});

test("large modules are split into focused slices", () => {
	const app = read("apps/web/src/components/botdeck-app.tsx");
	const appCore = read("apps/web/src/features/workspace/core/index.tsx");
	const controlHelpers = read("apps/web/src/server/control-plane-helpers.ts");
	const botSession = read("apps/web/src/features/bot-session/server/bot-session.ts");

	assert.match(app, /features\/workspace\/components\/channel-modals/);
	assert.match(app, /features\/workspace\/components\/guild-rail/);
	assert.match(appCore, /botdeck-app-i18n/);
	assert.match(controlHelpers, /control-plane-command-validation/);
	assert.match(controlHelpers, /control-plane-primitives/);
	assert.match(botSession, /bot-session-cache/);

	assert.ok(existsSync(join(root, "apps/web/src/features/workspace/core/botdeck-app-i18n.ts")), "missing workspace core i18n slice");
	assert.ok(existsSync(join(root, "apps/web/src/features/workspace/components/channel-modals.tsx")), "missing channel modal feature slice");
	assert.ok(existsSync(join(root, "apps/web/src/features/workspace/components/guild-rail.tsx")), "missing guild rail feature slice");
	assert.ok(existsSync(join(root, "apps/web/src/server/control-plane-command-validation.ts")), "missing command validation slice");
	assert.ok(existsSync(join(root, "apps/web/src/server/control-plane-primitives.ts")), "missing control-plane primitive slice");
	assert.ok(existsSync(join(root, "apps/web/src/features/bot-session/server/bot-session-cache.ts")), "missing session cache slice");
});


test("large UI and runtime domains live under feature folders", () => {
	for (const file of [
		"apps/web/src/features/slash-studio/components/command-content-step.tsx",
		"apps/web/src/features/slash-studio/components/slash-studio-command-factory.ts",
		"apps/web/src/features/server-settings/components/server-settings-panel.tsx",
		"apps/web/src/features/bot-session/server/bot-session.ts",
		"apps/web/src/features/messages/components/message-overlays.tsx",
		"apps/web/src/features/permissions/components/channel-permissions-panel.tsx",
		"apps/web/src/features/workspace/components/channel-modals.tsx"
	]) {
		assert.ok(existsSync(join(root, file)), `missing feature-owned module ${file}`);
	}

	assert.ok(!existsSync(join(root, "apps/web/src/components/slash-studio/command-content-step.tsx")), "legacy slash studio compatibility export should be removed");
	assert.ok(!existsSync(join(root, "apps/web/src/server/sessions/bot-session.ts")), "legacy session compatibility export should be removed");
	assert.match(read("apps/web/src/server/control-plane.ts"), /@\/features\/bot-session\/server\/bot-session/);
});


test("BotSession slices use typed this context", () => {
	const sessionFiles = listFiles("apps/web/src/features/bot-session/server", (file) => file.endsWith(".ts"));
	const source = sessionFiles.map(read).join("\n");

	assert.ok(existsSync(join(root, "apps/web/src/features/bot-session/server/bot-session-context.ts")), "missing BotSessionContext contract");
	assert.doesNotMatch(source, /this\s*:\s*any/);
	assert.match(source, /interface BotSessionContext/);
	assert.match(source, /this\s*:\s*BotSessionContext/);
});


test("read-only mode has mandatory and optional policy enforcement", () => {
	const protocolAccess = read("packages/shared/src/command-access.ts");
	const controlPlane = read("apps/web/src/server/control-plane.ts");
	const app = read("apps/web/src/components/botdeck-app.tsx");
	const models = read("packages/shared/src/models.ts");
	const schema = read("apps/web/prisma/schema.prisma");
	const migration = read("apps/web/prisma/migrations/20260627122000_read_only_mode/migration.sql");

	const optionMigration = read("apps/web/prisma/migrations/20260627123500_read_only_policy_options/migration.sql");

	assert.match(protocolAccess, /READ_ONLY_SLASH_STUDIO_COMMAND_TYPES/);
	assert.match(protocolAccess, /READ_ONLY_AUTOMATION_COMMAND_TYPES/);
	assert.match(protocolAccess, /READ_ONLY_MESSAGE_COMMAND_TYPES/);
	assert.match(protocolAccess, /READ_ONLY_CHANNEL_COMMAND_TYPES/);
	assert.match(protocolAccess, /READ_ONLY_MODERATION_COMMAND_TYPES/);
	assert.match(protocolAccess, /getReadOnlyCommandBlockKind/);
	assert.match(protocolAccess, /commandBlockedByReadOnlyPolicy/);
	assert.match(controlPlane, /assertBotWriteAccessEnabled/);
	assert.match(controlPlane, /getReadOnlyCommandBlockKind\(bot\?\.account, commandType\)/);
	assert.match(controlPlane, /assertBotWriteAccessEnabled\(bot, command\.type\)/);
	assert.match(app, /readOnlyBlockMessages/);
	assert.match(app, /readOnlyBlockChannels/);
	assert.match(app, /readOnlyBlockModeration/);
	assert.match(app, /commandBlockedByReadOnlyPolicy/);
	assert.match(models, /readOnlyMode\?: boolean/);
	assert.match(models, /readOnlyBlockMessages\?: boolean/);
	assert.match(schema, /readOnlyMode\s+Boolean\s+@default\(false\)/);
	assert.match(schema, /readOnlyBlockMessages\s+Boolean\s+@default\(false\)/);
	assert.match(migration, /ALTER TABLE "BotAccount" ADD COLUMN "readOnlyMode"/);
	assert.match(optionMigration, /ALTER TABLE "BotAccount" ADD COLUMN "readOnlyBlockMessages"/);
});

test("read-only optional blocks are visible on matching UI actions", () => {
	const app = read("apps/web/src/components/botdeck-app.tsx");
	const composer = read("apps/web/src/components/botdeck-message-composer.tsx");
	const messageOverlays = read("apps/web/src/features/messages/components/message-overlays.tsx");
	const chatWidgets = read("apps/web/src/components/botdeck-app-chat-widgets.tsx");
	const shellPanels = read("apps/web/src/components/botdeck-shell-panels.tsx");
	const css = read("apps/web/src/app/styles/read-only-action-locks.css");

	assert.match(app, /activeBotMessagesLocked/);
	assert.match(composer, /composerAttachButton\$\{activeBotMessagesLocked/);
	assert.match(composer, /composerEmbedButton\$\{activeBotMessagesLocked/);
	assert.match(composer, /composerInput\$\{activeBotMessagesLocked/);
	assert.match(app, /activeBotChannelsLocked/);
	assert.match(app, /readOnlyLocked=\{activeBotChannelsLocked\}/);
	assert.match(messageOverlays, /messagesLocked/);
	assert.match(messageOverlays, /messagesLocked/);
	assert.match(chatWidgets, /readOnlyLocked/);
	assert.match(shellPanels, /moderationLocked/);
	assert.match(shellPanels, /member\.role\.(remove|add)/);
	assert.match(css, /lecture seule/);
	assert.match(css, /button\.isReadonlyLocked::after/);
	assert.match(css, /composerInputShell\.isReadonlyLocked::after/);
	assert.doesNotMatch(`${app}\n${messageOverlays}\n${chatWidgets}\n${shellPanels}`, /readonlyButtonLock|readonlyInputLock|readonlyToolbarLock|contextMenuLockBadge|readonlyInlineLock/);
});

test("local TLS generation is packaged without external OpenSSL", () => {
	const tlsManagement = read("apps/web/src/server/tls-management.ts");
	const tlsGenerateRoute = read("apps/web/src/app/api/tls/generate/route.ts");

	assert.doesNotMatch(tlsManagement, /spawn\(["']openssl["']/);
	assert.match(tlsManagement, /generateKeyPairSync/);
	assert.doesNotMatch(tlsGenerateRoute, /OpenSSL/i);
});


test("read-only channel menu does not render duplicate hint", () => {
	const chatWidgets = read("apps/web/src/components/botdeck-app-chat-widgets.tsx");
	const readOnlyCss = read("apps/web/src/app/styles/read-only-action-locks.css");

	assert.doesNotMatch(chatWidgets, /contextMenuHint isReadonlyLocked/);
	assert.match(chatWidgets, /!readOnlyLocked && !canManage/);
	assert.doesNotMatch(readOnlyCss, /contextMenuHint\.isReadonlyLocked/);
});

test("channel destructive menu actions share the danger button variant", () => {
	const chatWidgets = read("apps/web/src/components/botdeck-app-chat-widgets.tsx");
	const recreatePurgeButton = chatWidgets.match(/<Button[^>]+onClick=\{onRecreatePurge\}[^>]*>/s)?.[0] ?? "";
	const deleteButton = chatWidgets.match(/<Button[^>]+onClick=\{onDelete\}[^>]*>/s)?.[0] ?? "";

	assert.match(recreatePurgeButton, /variant="danger"/);
	assert.match(recreatePurgeButton, /className=\{readOnlyLocked \? "isReadonlyLocked" : "danger"\}/);
	assert.match(deleteButton, /variant="danger"/);
	assert.match(deleteButton, /className=\{readOnlyLocked \? "isReadonlyLocked" : "danger"\}/);
});

test("bot settings navigation uses the shared server tab styling", () => {
	const botSettings = read("apps/web/src/components/ui/app-icons-and-settings.tsx");
	const botSettingsNav = botSettings.slice(botSettings.indexOf('className="serverSettingsNav"'));

	assert.doesNotMatch(botSettingsNav, /<TabButton\s+variant="ghost"/);
	assert.match(botSettingsNav, /<TabButton active=\{tab === "info"\}/);
	assert.match(botSettingsNav, /<TabButton active=\{tab === "activity"\}/);
	assert.match(botSettingsNav, /<TabButton active=\{tab === "invitation"\}/);
	assert.match(botSettingsNav, /<TabButton active=\{tab === "interface"\}/);
});


test("destructive confirmation modals use compact headers without separators", () => {
	const actions = read("apps/web/src/features/members/components/member-moderation-actions.tsx");
	const channelModals = read("apps/web/src/features/workspace/components/channel-modals.tsx");
	const messageOverlays = read("apps/web/src/features/messages/components/message-overlays.tsx");
	const css = read("apps/web/src/app/styles/modal-unified.css");

	assert.match(actions, /surfaceClassName="botModal actionConfirmModal memberModerationModal"/);
	assert.match(channelModals, /surfaceClassName="botModal actionConfirmModal channelRecreateModal"/);
	assert.match(channelModals, /surfaceClassName="botModal actionConfirmModal" aria-label=\{language === "fr" \? "Confirmer la suppression" : "Confirm deletion"\}/);
	assert.match(messageOverlays, /surfaceClassName="botModal actionConfirmModal" aria-label=\{text\.confirmRemoveBot\}/);
	assert.match(css, /\.actionConfirmModal \.botModalHeader \{[^}]*border-bottom: 0 !important;[^}]*padding-bottom: 0;/s);
});

test("server member context menu supports kick and ban reason modals", () => {
	const app = read("apps/web/src/components/botdeck-app.tsx");
	const panels = read("apps/web/src/components/botdeck-app-panels.tsx");
	const serverSettings = read("apps/web/src/features/server-settings/components/server-settings-panel.tsx");
	const messageList = read("apps/web/src/components/botdeck-message-list.tsx");
	const channelSidebar = read("apps/web/src/components/botdeck-channel-sidebar.tsx");
	const hook = read("apps/web/src/features/members/hooks/use-member-moderation-actions.ts");
	const actions = read("apps/web/src/features/members/components/member-moderation-actions.tsx");
	const i18n = read("apps/web/src/features/workspace/core/botdeck-app-i18n.ts");
	const layoutCss = read("apps/web/src/app/styles/layout.css");

	assert.match(app, /useMemberModerationActions/);
	assert.match(messageList, /onOpenMemberContextMenu/);
	assert.match(channelSidebar, /onOpenMemberContextMenu/);
	assert.match(serverSettings, /onOpenMemberContextMenu\?:/);
	assert.match(serverSettings, /onContextMenu=\{\(event: ReactMouseEvent<HTMLDivElement>\) => \{\s*onOpenMemberContextMenu\?\.\(event, guildId, member\.userId\);\s*\}\}/s);
	assert.match(panels, /onOpenMemberContextMenu=\{openMemberContextMenu\}/);
	assert.match(panels, /<MemberContextMenu/);
	assert.match(panels, /<MemberModerationModal/);
	assert.match(actions, /text\.kickMember/);
	assert.match(actions, /text\.banMember/);
	assert.match(actions, /moderationReasonOptional/);
	assert.match(actions, /maxLength=\{512\}/);
	assert.match(hook, /type: "member\.kick"/);
	assert.match(hook, /type: "member\.ban"/);
	assert.match(hook, /deleteMessageSeconds: 0/);
	assert.match(hook, /membersByGuildId\[guildId\]/);
	assert.match(i18n, /kickMember: "Expulser le membre"/);
	assert.match(i18n, /banMember: "Ban member"/);
	assert.match(layoutCss, /\.contextMenuBackdrop \{[^}]*z-index: 1202;/s);
	assert.match(layoutCss, /\.messageContextMenu \{[^}]*z-index: 1203;/s);
});

test("server settings include a searchable paginated member directory", () => {
	const panel = read("apps/web/src/features/server-settings/components/server-settings-panel.tsx");
	const model = read("apps/web/src/features/server-settings/server-automation-model.ts");
	const labels = read("apps/web/src/features/server-settings/server-settings-text.ts");
	const css = read("apps/web/src/app/styles/settings-panels.css");

	assert.match(model, /ServerSettingsTab = "overview" \| "members" \| "invites" \| "bans" \| "automations" \| "templates"/);
	assert.match(panel, /function ServerMembersPanel/);
	assert.match(panel, /SERVER_MEMBERS_PAGE_SIZE = 24/);
	assert.match(panel, /type: "guild\.members\.fetch"/);
	assert.match(panel, /active=\{tab === "members"\}/);
	assert.match(panel, /labels\.membersSearchPlaceholder/);
	assert.match(panel, /className="serverMembersSearchHeader"/);
	assert.doesNotMatch(panel, /serverMembersToolbarHeader/);
	assert.match(panel, /visibleMemberPages\(safePage, pageCount\)/);
	assert.match(panel, /<div className="discordSettingsBlockHeader">\s*<h3>\{labels\.serverMembersTitle\}<\/h3>\s*<p>\{labels\.serverMembersHelp\}<\/p>/);
	assert.doesNotMatch(panel, /serverMembersTitleRow/);
	assert.match(panel, /className="serverMembersTable"/);
	assert.match(panel, /labels\.memberColumnUsername/);
	assert.doesNotMatch(panel, /labels\.memberColumnName/);
	assert.doesNotMatch(panel, /className="serverMemberId"/);
	assert.doesNotMatch(panel, /className="serverMemberUsername"/);
	assert.match(panel, /member\.role\.add/);
	assert.match(panel, /member\.role\.remove/);
	assert.match(panel, /memberAvailableRoles\(rolePickerMember, roles\)/);
	assert.match(panel, /createPortal\(/);
	assert.match(panel, /serverMemberRolePickerPortal/);
	assert.match(panel, /event\.stopPropagation\(\);/);
	assert.match(panel, /aria-haspopup="menu"/);
	assert.match(panel, /aria-sort=\{sortKey ===/);
	assert.match(labels, /memberBotBadge: "APP"/);
	assert.match(labels, /memberAddRole: "Ajouter un rôle"/);
	assert.match(labels, /membersTab: "Membres"/);
	assert.match(labels, /membersTab: "Members"/);
	assert.match(labels, /membersSearchPlaceholder: "Nom, pseudo, ID utilisateur ou rôle\.\.\."/);
	assert.match(labels, /membersSearchPlaceholder: "Name, username, user ID, or role\.\.\."/);
	assert.match(css, /\.serverSettingsFormSurface\.serverMembersPanel \{[^}]*padding: 28px 22px 22px !important;/s);
	assert.match(css, /\.serverMembersSearchHeader \{[^}]*justify-content: space-between;/s);
	assert.doesNotMatch(css, /serverMembersToolbarHeader/);
	assert.match(css, /\.serverMembersTableScroller \{[^}]*overflow: auto;/s);
	assert.match(css, /\.serverMembersTableRow \{[^}]*grid-template-columns:/s);
	assert.match(css, /\.serverMembersTableHeader/);
	assert.match(css, /\.serverMemberPseudoCell/);
	assert.match(css, /\.serverMemberRoleAdd/);
	assert.match(css, /\.serverMemberRolePickerPortal \{[^}]*position: fixed !important;[^}]*z-index: 1400;/s);
	assert.match(css, /\.serverMembersPagination/);
});


test("server settings include an invite directory with create and delete actions", () => {
	const panel = read("apps/web/src/features/server-settings/components/server-settings-panel.tsx");
	const model = read("apps/web/src/features/server-settings/server-automation-model.ts");
	const labels = read("apps/web/src/features/server-settings/server-settings-text.ts");
	const protocol = read("packages/shared/src/protocol.ts");
	const state = read("packages/shared/src/state.ts");
	const controlPlane = read("apps/web/src/server/control-plane.ts");

	assert.match(model, /"invites"/);
	assert.match(panel, /function ServerInvitesPanel/);
	assert.match(panel, /SERVER_INVITES_PAGE_SIZE/);
	assert.match(panel, /type: "guild\.invites\.fetch"/);
	assert.match(panel, /type: "guild\.invite\.create"/);
	assert.match(panel, /type: "guild\.invite\.delete"/);
	assert.match(panel, /active=\{tab === "invites"\}/);
	assert.match(panel, /labels\.invitesSearchPlaceholder/);
	assert.match(panel, /className="serverInvitesTable"/);
	assert.match(labels, /serverInvitesTitle: "Invitations du serveur"/);
	assert.match(protocol, /state\.guildInvites/);
	assert.match(protocol, /guild\.invite\.create/);
	assert.match(state, /invitesByGuildId/);
	assert.match(controlPlane, /bot\.createGuildInvite/);
	assert.match(controlPlane, /bot\.deleteGuildInvite/);
});

test("server settings manage bans without expression categories", () => {
	const protocol = read("packages/shared/src/protocol.ts");
	const model = read("apps/web/src/features/server-settings/server-automation-model.ts");
	const panel = read("apps/web/src/features/server-settings/components/server-settings-panel.tsx");
	const session = read("apps/web/src/features/bot-session/server/bot-session-guild-channels.ts");
	const labels = read("apps/web/src/features/server-settings/server-settings-text.ts");

	assert.match(model, /"bans" \| "automations"/);
	assert.doesNotMatch(model, /"emojis"/);
	assert.doesNotMatch(model, /"stickers"/);
	assert.doesNotMatch(model, /"soundboard"/);
	for (const command of [
		"guild.bans.fetch",
		"guild.ban.create",
		"guild.ban.delete"
	]) {
		assert.ok(protocol.includes(command), `missing protocol command ${command}`);
		assert.ok((panel + session).includes(command), `missing implementation for ${command}`);
	}
	for (const removed of [
		"guild.emojis.fetch",
		"guild.emoji.create",
		"guild.emoji.delete",
		"guild.stickers.fetch",
		"guild.sticker.create",
		"guild.sticker.delete",
		"guild.soundboard"
	]) {
		assert.ok(!protocol.includes(removed), `removed command should not stay in protocol: ${removed}`);
		assert.ok(!(panel + session).includes(removed), `removed implementation should not stay visible: ${removed}`);
	}
	assert.doesNotMatch(panel, /active=\{tab === "emojis"\}/);
	assert.doesNotMatch(panel, /active=\{tab === "stickers"\}/);
	assert.doesNotMatch(panel, /ServerExpressionsPanel/);
	assert.doesNotMatch(labels, /emojisTab/);
	assert.doesNotMatch(labels, /stickersTab/);
	assert.doesNotMatch(labels, /serverEmojisTitle/);
	assert.doesNotMatch(labels, /serverStickersTitle/);
});

test("modal overlays use a shared stack so the latest dialog stays on top", () => {
	const modal = read("apps/web/src/components/ui/modal.tsx");
	const stack = read("apps/web/src/components/ui/modal-stack.ts");
	const serverSettings = read("apps/web/src/features/server-settings/components/server-settings-panel.tsx");
	const shellPanels = read("apps/web/src/components/botdeck-shell-panels.tsx");
	const memberActions = read("apps/web/src/features/members/components/member-moderation-actions.tsx");
	const messageOverlays = read("apps/web/src/features/messages/components/message-overlays.tsx");
	const modalCss = read("apps/web/src/app/styles/modal-unified.css");
	const launcherCss = read("apps/web/src/app/styles/launcher.css");

	assert.match(stack, /MODAL_LAYER_BASE = 1400/);
	assert.match(stack, /MODAL_LAYER_STEP = 10/);
	assert.match(stack, /\+\+modalLayerSeed/);
	assert.match(modal, /useModalLayer\(\)/);
	assert.match(modal, /style=\{\{ zIndex: layer\.backdrop \}\}/);
	assert.match(modal, /style=\{\{ \.\.\.\(style as CSSProperties \| undefined\), zIndex: layer\.surface \}\}/);
	assert.match(serverSettings, /style=\{\{ "--server-settings-backdrop-z": layer\.backdrop \} as CSSProperties\}/);
	assert.match(serverSettings, /style=\{\{ "--server-settings-panel-z": layer\.surface \} as CSSProperties\}/);
	assert.match(serverSettings, /overlayLayer=\{layer\.surface \+ 2\}/);
	assert.match(serverSettings, /zIndex: overlayLayer/);
	assert.match(shellPanels, /style=\{\{ zIndex: layer\.backdrop \}\}/);
	assert.match(shellPanels, /zIndex: layer\.surface/);
	assert.match(memberActions, /useModalLayer\(\)/);
	assert.match(memberActions, /style=\{\{ left: position\.x, top: position\.y, zIndex: layer\.surface \}\}/);
	assert.match(messageOverlays, /useModalLayer\(\)/);
	assert.match(messageOverlays, /style=\{\{ left: position\.x, top: position\.y, zIndex: layer\.surface \}\}/);
	assert.match(modalCss, /z-index: var\(--server-settings-panel-z, 1201\) !important;/);
	assert.match(launcherCss, /z-index: var\(--server-settings-backdrop-z, 1200\);/);
});


test("runtime startup avoids noisy database and Discord deprecation warnings", () => {
	const bootstrap = read("apps/web/src/server/database-bootstrap.ts");
	const botSessionHandlers = read("apps/web/src/features/bot-session/server/bot-session-event-handlers.ts");

	assert.match(bootstrap, /applySqlitePragma/);
	assert.match(bootstrap, /\$queryRawUnsafe\(statement\)/);
	assert.match(bootstrap, /NO_UPDATE_NOTIFIER: "1"/);
	assert.match(bootstrap, /PRISMA_HIDE_UPDATE_MESSAGE: "true"/);
	assert.doesNotMatch(bootstrap, /\$executeRawUnsafe\("PRAGMA journal_mode = WAL"\)/);
	assert.match(botSessionHandlers, /Events\.ClientReady/);
	assert.doesNotMatch(botSessionHandlers, /once\(["']ready["']/);
});

test("member directory fetches avoid startup gateway rate-limit spam", () => {
	const guildChannels = read("apps/web/src/features/bot-session/server/bot-session-guild-channels.ts");

	assert.match(guildChannels, /guildMemberFetchRateLimits = new Map<string, number>\(\)/);
	assert.match(guildChannels, /retryAfterFromMemberFetchError/);
	assert.match(guildChannels, /Retry after \(\[0-9\]\+/);
	assert.match(guildChannels, /Discord limite temporairement la synchronisation complète des membres/);
	assert.match(guildChannels, /level: "info"/);
	assert.match(guildChannels, /guildMemberFetchRateLimits\.set\(key, Date\.now\(\) \+ retryAfterMs\)/);
	assert.match(guildChannels, /const memberCollection = guild\.members\.cache;/);
	assert.doesNotMatch(guildChannels, /const fetchedMembers = await safeFetchGuildMembers\(this, guild\);/);
	assert.doesNotMatch(guildChannels, /Could not fetch every server member\. Botdeck is showing cached members instead\./);
});
