// Entrée Electron (UI desktop + serveur Next local).

const { app, BrowserWindow, Menu, nativeImage, shell } = require("electron");
const { spawn } = require("node:child_process");
const http = require("node:http");
const https = require("node:https");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const HOST = "127.0.0.1";
const PORT = 3000;
function fallbackDataDir() {
	return path.join(os.tmpdir(), "Botdeck");
}

function appDataDir() {
	try {
		return app.getPath("userData");
	} catch {
		return fallbackDataDir();
	}
}

const earlyLogPath = path.join(appDataDir(), "debug.log");

// Trace le démarrage avant le logger final.
function appendEarlyLog(message) {
	try {
		fs.mkdirSync(path.dirname(earlyLogPath), { recursive: true });
		fs.appendFileSync(earlyLogPath, `${message}\n`);
	} catch {
		// Log défensif, non bloquant.
	}
}

appendEarlyLog(`[main] loaded argv=${JSON.stringify(process.argv)} platform=${process.platform} execPath=${process.execPath}`);
app.disableHardwareAcceleration();
app.commandLine.appendSwitch("disable-gpu");
app.commandLine.appendSwitch("disable-gpu-compositing");
app.commandLine.appendSwitch("disable-features", "VaapiVideoDecoder,VaapiVideoEncoder,UseChromeOSDirectVideoDecoder");

let serverProcess = null;
let mainWindow = null;
let appIsQuitting = false;


// Nettoie les valeurs .env citées.
function unquoteEnvValue(value) {
	const trimmed = value.trim();
	if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
		return trimmed.slice(1, -1);
	}
	return trimmed;
}

// Charge le .env racine sans dépendance.
function loadRootEnv(root) {
	const envPath = path.join(root, ".env");
	if (!fs.existsSync(envPath)) return;

	for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("export ") && !trimmed.includes("=")) continue;

		const normalized = trimmed.startsWith("export ") ? trimmed.slice("export ".length).trim() : trimmed;
		const separatorIndex = normalized.indexOf("=");
		if (separatorIndex <= 0) continue;

		const key = normalized.slice(0, separatorIndex).trim();
		if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || process.env[key] !== undefined) continue;
		process.env[key] = unquoteEnvValue(normalized.slice(separatorIndex + 1));
	}
}

// Lit un argument CLI nommé.
function readArgValue(...names) {
	for (const name of names) {
		const exactIndex = process.argv.indexOf(name);
		if (exactIndex >= 0) {
			const value = process.argv[exactIndex + 1];
			if (value && !value.startsWith("--")) return value;
		}

		const prefix = `${name}=`;
		const inline = process.argv.find((arg) => arg.startsWith(prefix));
		if (inline) return inline.slice(prefix.length);
	}

	return null;
}

// Copie un ancien fichier seulement si la nouvelle destination n’existe pas.
function copyLegacyFile(legacyPath, targetPath, label) {
	try {
		if (!fs.existsSync(legacyPath) || fs.existsSync(targetPath)) return;
		fs.mkdirSync(path.dirname(targetPath), { recursive: true });
		fs.copyFileSync(legacyPath, targetPath);
		debugLog(`[storage:migrate] ${label} ${legacyPath} -> ${targetPath}`);
	} catch (err) {
		debugLog(`[storage:migrate:error] ${label} ${err.stack || err}`);
	}
}

// Migre les anciens fichiers SQLite du dossier projet vers userData.
function migrateLegacyDatabase(root, databasePath) {
	const legacyPath = path.join(root, ".botdeck", "database", "botdeck.db");
	copyLegacyFile(legacyPath, databasePath, "database");
	copyLegacyFile(`${legacyPath}-wal`, `${databasePath}-wal`, "database-wal");
	copyLegacyFile(`${legacyPath}-shm`, `${databasePath}-shm`, "database-shm");
}

// Prépare DATABASE_URL pour le process.
function databaseEnv(root, userDataDir) {
	const databaseUrl = readArgValue("--database-url", "--db-url") || process.env.BOTDECK_DATABASE_URL;
	if (databaseUrl) {
		return {
			BOTDECK_DATABASE_URL: databaseUrl,
			DATABASE_URL: databaseUrl
		};
	}

	const explicitDatabasePath = readArgValue("--database", "--database-path", "--db")
		|| process.env.BOTDECK_DATABASE_PATH
		|| (process.env.BOTDECK_DATABASE_DIR ? path.join(process.env.BOTDECK_DATABASE_DIR, "botdeck.db") : null);
	const databasePath = explicitDatabasePath || path.join(userDataDir, "database", "botdeck.db");
	fs.mkdirSync(path.dirname(databasePath), { recursive: true });
	if (!explicitDatabasePath) migrateLegacyDatabase(root, databasePath);
	return {
		BOTDECK_DATABASE_PATH: databasePath,
		DATABASE_URL: `file:${databasePath.replace(/\\/g, "/")}`
	};
}


// Résout l’icône packagée.
function assetIconPath() {
	const root = rootDir();
	if (process.platform === "win32") return path.join(root, "assets", "app-icon.ico");
	if (process.platform === "darwin") return path.join(root, "assets", "app-icon.icns");
	return path.join(root, "assets", "app-icon.png");
}

// Sélectionne l’icône selon la plateforme.
function windowIcon() {
	const iconPath = assetIconPath();
	return fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : undefined;
}

// Journalise dans userData pour éviter d’écrire dans resources/app.
function debugLog(message) {
	try {
		const logDir = appDataDir();
		fs.mkdirSync(logDir, { recursive: true });
		fs.appendFileSync(path.join(logDir, "debug.log"), `${message}\n`);
	} catch {
		// Diag exécution.
	}
}

process.on("uncaughtException", (err) => {
	debugLog(`[uncaughtException] ${err.stack || err}`);
	app.quit();
});

process.on("unhandledRejection", (err) => {
	debugLog(`[unhandledRejection] ${err?.stack || err}`);
	app.quit();
});

// Retrouve la racine projet.
function rootDir() {
	return app.isPackaged
		? path.join(process.resourcesPath, "app")
		: path.resolve(__dirname, "../..");
}

// Lit la configuration TLS persistée.
function readTlsConfig(userDataDir) {
	try {
		const configPath = path.join(userDataDir, "tls", "tls-config.json");
		const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
		if (!config?.enabled || !config.certificatePath || !config.keyPath) return null;
		if (!fs.existsSync(config.certificatePath) || !fs.existsSync(config.keyPath)) return null;
		return config;
	} catch {
		return null;
	}
}

function httpsPortFromConfig(config) {
	return Number.parseInt(String(config?.httpsPort || process.env.BOTDECK_HTTPS_PORT || "3443"), 10) || 3443;
}

function isPrivilegedPortForCurrentUser(port) {
	return process.platform !== "win32" && typeof process.getuid === "function" && process.getuid() !== 0 && port < 1024;
}

function launchUrl(userDataDir) {
	const config = readTlsConfig(userDataDir);
	if (config) {
		const httpsPort = httpsPortFromConfig(config);
		if (!isPrivilegedPortForCurrentUser(httpsPort)) return `https://${HOST}:${httpsPort}`;
	}
	return `http://${HOST}:${PORT}`;
}

function isBotdeckLocalUrl(url) {
	try {
		const parsed = new URL(url);
		if (parsed.hostname !== HOST && parsed.hostname !== "localhost") return false;
		return parsed.port === String(PORT) || parsed.port === String(httpsPortFromConfig(readTlsConfig(appDataDir()))) || parsed.port === String(Number.parseInt(process.env.BOTDECK_WSS_PORT || "3002", 10) || 3002);
	} catch {
		return false;
	}
}

// Attente Next.
function waitForServer(url, timeout = 45000) {
	const startedAt = Date.now();
	const parsed = new URL(url);
	const client = parsed.protocol === "https:" ? https : http;

	return new Promise((resolve, reject) => {
		const check = () => {
			const req = client.get({
				protocol: parsed.protocol,
				hostname: parsed.hostname,
				port: parsed.port,
				path: parsed.pathname || "/",
				rejectUnauthorized: false
			}, (res) => {
				res.resume();
				resolve();
			});

			req.on("error", () => {
				if (Date.now() - startedAt > timeout) {
					reject(new Error(`Server not ready: ${url}`));
				} else {
					setTimeout(check, 500);
				}
			});

			req.setTimeout(1000, () => req.destroy());
		};

		check();
	});
}

async function reloadMainWindowAfterServerRestart() {
	if (!mainWindow || mainWindow.isDestroyed()) return;
	const url = launchUrl(app.getPath("userData"));
	try {
		await waitForServer(url);
		await mainWindow.loadURL(url);
	} catch (err) {
		debugLog(`[server:reload-error] ${err.stack || err}`);
	}
}

// SRV Next embarqué.
function startServer() {
	debugLog("[startServer] start");
	const root = rootDir();
	loadRootEnv(root);
	const webDir = path.join(root, "apps", "web");
	const serverRunner = path.join(root, "apps", "desktop", "server-runner.cjs");
	const winNodePath = path.join(root, "bin", "win32-x64", "node.exe");
	const serverRuntime = process.platform === "win32" && app.isPackaged && fs.existsSync(winNodePath)
		? winNodePath
		: process.execPath;
	const userDataDir = app.getPath("userData");
	const secretsDir = path.join(userDataDir, "secrets");
	const runtimeSecretPath = path.join(secretsDir, "runtime.key");
	const dbEnv = databaseEnv(root, userDataDir);
	const databasePath = dbEnv.BOTDECK_DATABASE_PATH || dbEnv.BOTDECK_DATABASE_URL || dbEnv.DATABASE_URL;
	const logFile = path.join(userDataDir, "server.log");
	fs.mkdirSync(secretsDir, { recursive: true });
	copyLegacyFile(path.join(root, ".botdeck", "runtime.key"), runtimeSecretPath, "runtime-secret");
	copyLegacyFile(path.join(root, "apps", "web", ".botdeck", "runtime.key"), runtimeSecretPath, "runtime-secret-web");

	const serverEnv = {
		...process.env,
		...dbEnv,
		NODE_ENV: "production",
		BOTDECK_PROJECT_DIR: root,
		BOTDECK_DATA_DIR: userDataDir,
		BOTDECK_RUNTIME_SECRET_PATH: runtimeSecretPath,
		BOTDECK_SERVER_LOG: logFile,
		BOTDECK_ALLOW_SERVER_RESTART: "1"
	};

	if (serverRuntime === process.execPath) {
		serverEnv.ELECTRON_RUN_AS_NODE = "1";
	} else {
		delete serverEnv.ELECTRON_RUN_AS_NODE;
	}

	fs.writeFileSync(
		logFile,
		[
			`root=${root}`,
			`webDir=${webDir}`,
			`webDirExists=${fs.existsSync(webDir)}`,
			`nextPackage=${fs.existsSync(path.join(root, "node_modules", "next", "package.json"))}`,
			`resourcesPath=${process.resourcesPath}`,
			`execPath=${process.execPath}`,
			`serverRuntime=${serverRuntime}`,
			`databasePath=${databasePath}`,
			""
		].join("\n")
	);

	try {
		require.resolve("next/package.json", { paths: [root, webDir] });
	} catch (err) {
		fs.appendFileSync(logFile, `[resolve-error] ${err.stack || err}\n`);
		throw err;
	}

	serverProcess = spawn(
		serverRuntime,
		[serverRunner, "--dir", webDir, "--host", HOST, "--port", String(PORT), "--dev", "false"],
		{
			cwd: webDir,
			env: serverEnv,
			windowsHide: true,
			stdio: ["ignore", "pipe", "pipe"]
		}
	);
	debugLog(`[startServer] spawned pid=${serverProcess.pid ?? "unknown"}`);

	serverProcess.stdout.on("data", (data) => {
		fs.appendFileSync(logFile, `[stdout] ${data}`);
	});

	serverProcess.stderr.on("data", (data) => {
		fs.appendFileSync(logFile, `[stderr] ${data}`);
	});

	serverProcess.on("error", (err) => {
		fs.appendFileSync(logFile, `[error] ${err.stack || err}\n`);
	});

	serverProcess.on("exit", (code, signal) => {
		fs.appendFileSync(logFile, `[exit] code=${code} signal=${signal}\n`);
		serverProcess = null;
		if (!appIsQuitting && code === 42) {
			setTimeout(() => {
				try {
					startServer();
					void reloadMainWindowAfterServerRestart();
				} catch (err) {
					debugLog(`[server:restart-error] ${err.stack || err}`);
				}
			}, 500);
		}
	});
}

// Fenêtre principale Electron.
async function createWindow() {
	debugLog("[createWindow] start");
	Menu.setApplicationMenu(null);

	startServer();

	const win = new BrowserWindow({
		width: 1280,
		height: 800,
		backgroundColor: "#0b0f17",
		autoHideMenuBar: true,
		icon: windowIcon(),
		webPreferences: {
			contextIsolation: true,
			nodeIntegration: false
		}
	});

	mainWindow = win;

	win.webContents.setWindowOpenHandler(({ url }) => {
		if (isBotdeckLocalUrl(url)) return { action: "allow" };
		void shell.openExternal(url);
		return { action: "deny" };
	});

	win.webContents.on("will-navigate", (event, url) => {
		if (isBotdeckLocalUrl(url)) return;
		event.preventDefault();
		void shell.openExternal(url);
	});

	try {
		const url = launchUrl(app.getPath("userData"));
		await waitForServer(url);
		await win.loadURL(url);
	} catch (err) {
		await win.loadURL(
			"data:text/html;charset=utf-8," +
			encodeURIComponent(`<pre style="color:white;background:#0b0f17;padding:24px">${err.stack || err}</pre>`)
		);
	}
}

app.on("certificate-error", (event, _webContents, url, _error, _certificate, callback) => {
	if (isBotdeckLocalUrl(url)) {
		event.preventDefault();
		callback(true);
		return;
	}
	callback(false);
});

app.whenReady().then(createWindow);
app.on("ready", () => debugLog("[app] ready"));
app.on("render-process-gone", (_event, _webContents, details) => debugLog(`[app] render-process-gone ${JSON.stringify(details)}`));
app.on("child-process-gone", (_event, details) => debugLog(`[app] child-process-gone ${JSON.stringify(details)}`));
app.on("gpu-process-crashed", (_event, killed) => debugLog(`[app] gpu-process-crashed killed=${killed}`));
app.on("web-contents-created", (_event, contents) => {
	contents.on("console-message", (event) => {
		const details = event && typeof event === "object" ? event : null;
		const level = details?.level ?? "unknown";
		const message = details?.message ?? "";
		const sourceId = details?.sourceId ?? "";
		const line = details?.lineNumber ?? details?.line ?? 0;
		debugLog(`[renderer:console:${level}] ${message} (${sourceId}:${line})`);
	});
	contents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
		debugLog(`[renderer:did-fail-load] ${errorCode} ${errorDescription} ${validatedURL}`);
	});
	contents.on("render-process-gone", (_event, details) => {
		debugLog(`[renderer:gone] ${JSON.stringify(details)}`);
	});
});

app.on("before-quit", () => {
	appIsQuitting = true;
	if (serverProcess && !serverProcess.killed) {
		serverProcess.kill();
	}
});

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") app.quit();
});
