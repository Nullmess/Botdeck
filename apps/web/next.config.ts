// Config Next courte

import type { NextConfig } from "next";
import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const appDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(/* turbopackIgnore: true */ appDir, "../..");
const rootPackage = JSON.parse(readFileSync(path.join(rootDir, "package.json"), "utf8")) as { version?: string };

const nextConfig: NextConfig = {
	allowedDevOrigins: ["127.0.0.1"],
	devIndicators: false,
	typescript: {
		ignoreBuildErrors: true
	},
	typedRoutes: true,
	turbopack: {
		root: rootDir
	},
	serverExternalPackages: ["discord.js", "ws"],
	env: {
		NEXT_PUBLIC_BOTDECK_VERSION: rootPackage.version || "1.0.0"
	}
};

export default nextConfig;
