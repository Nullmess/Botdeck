import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const stylesRoot = join(root, "apps", "web", "src", "app", "styles");

function walk(dir) {
	const entries = [];
	for (const name of readdirSync(dir)) {
		const fullPath = join(dir, name);
		const stat = statSync(fullPath);
		if (stat.isDirectory()) entries.push(...walk(fullPath));
		else if (name.endsWith(".css")) entries.push(fullPath);
	}
	return entries;
}

const errors = [];
const files = walk(stylesRoot);

for (const file of files) {
	const source = readFileSync(file, "utf8");
	const rel = relative(root, file);
	if (/part-\d+\.css$/.test(file) || /-parts[\\/]/.test(file)) {
		errors.push(`${rel}: split CSS part files are forbidden in the current stylesheet layout`);
	}
	if (/@import\s+["'][^"']*-parts\//.test(source)) {
		errors.push(`${rel}: imports a removed *-parts stylesheet`);
	}
	let balance = 0;
	for (const char of source) {
		if (char === "{") balance += 1;
		if (char === "}") balance -= 1;
		if (balance < 0) {
			errors.push(`${rel}: closing brace without matching opening brace`);
			break;
		}
	}
	if (balance !== 0) {
		errors.push(`${rel}: unbalanced CSS braces (${balance > 0 ? "missing closing brace" : "extra closing brace"})`);
	}
}

if (errors.length > 0) {
	console.error("Botdeck CSS check failed:");
	for (const error of errors) console.error(`- ${error}`);
	process.exit(1);
}

console.log(`Botdeck CSS check passed (${files.length} stylesheet files).`);
