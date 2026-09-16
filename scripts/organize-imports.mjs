// Tri imports TS

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import ts from "typescript";

const root = process.cwd();
const files = process.argv.slice(2);

if (!files.length) {
	console.error("Usage: node scripts/organize-imports.mjs <file...>");
	process.exit(1);
}

const servicesHost = {
	getScriptFileNames: () => files,
	getScriptVersion: () => "1",
	getScriptSnapshot: (fileName) => {
		const source = ts.sys.readFile(fileName);
		return source === undefined ? undefined : ts.ScriptSnapshot.fromString(source);
	},
	getCurrentDirectory: () => root,
	getCompilationSettings: () => ({
		allowJs: true,
		jsx: ts.JsxEmit.Preserve,
		module: ts.ModuleKind.ESNext,
		moduleResolution: ts.ModuleResolutionKind.Bundler,
		target: ts.ScriptTarget.ES2022
	}),
	getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
	fileExists: ts.sys.fileExists,
	readFile: ts.sys.readFile,
	readDirectory: ts.sys.readDirectory
};

const service = ts.createLanguageService(servicesHost, ts.createDocumentRegistry());

for (const fileName of files) {
	const absolutePath = join(root, fileName);
	const edits = service.organizeImports({ type: "file", fileName: absolutePath }, {}, {});
	if (!edits.length) continue;

	let source = await readFile(absolutePath, "utf8");
	for (const edit of edits.flatMap((change) => change.textChanges).sort((left, right) => right.span.start - left.span.start)) {
		source = `${source.slice(0, edit.span.start)}${edit.newText}${source.slice(edit.span.start + edit.span.length)}`;
	}
	await writeFile(absolutePath, source, "utf8");
}
