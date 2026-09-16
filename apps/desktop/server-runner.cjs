// stdout/stderr vers log + lancement du serveur local Botdeck.

const fs = require("node:fs");
const path = require("node:path");

const logFile = process.env.BOTDECK_SERVER_LOG;

if (logFile) {
	const logStream = fs.createWriteStream(logFile, { flags: "a" });
	logStream.isTTY = false;

	Object.defineProperty(process, "stdout", {
		configurable: true,
		value: logStream
	});

	Object.defineProperty(process, "stderr", {
		configurable: true,
		value: logStream
	});
}

require(path.join(__dirname, "botdeck-server.cjs"));
