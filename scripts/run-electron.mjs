// Lancement Electron npm (Env héritée nettoyée).

import { spawnSync } from "node:child_process";
import electronPath from "electron";

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const result = spawnSync(electronPath, ["."], {
	cwd: process.cwd(),
	env,
	stdio: "inherit"
});

if (result.error) {
	throw result.error;
}

process.exit(result.status ?? 0);
