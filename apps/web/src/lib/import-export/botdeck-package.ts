import {
	BOTDECK_PACKAGE_FORMAT,
	BOTDECK_PACKAGE_VERSION,
	isBotdeckPackage,
	validateBotdeckPackage,
	type ApplicationCommandDraft,
	type BotdeckCommandPackageItem,
	type BotdeckPackage,
	type BotdeckPackageKind,
	type BotdeckPackageValidationResult,
	type BotdeckTemplatePackageItem,
	type BotdeckTemplateType
} from "@botdeck/shared";

export type TemplateExportInput = {
	templateType: BotdeckTemplateType;
	name: string;
	payload: Record<string, unknown>;
};

export function safePackageName(value: string, fallback = "package") {
	return (value || fallback)
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9-_]+/g, "-")
		.replace(/--+/g, "-")
		.replace(/^-|-$/g, "") || fallback;
}

export function buildBotdeckPackage(params: {
	kind: BotdeckPackageKind;
	name: string;
	description?: string | null;
	items: BotdeckPackage["items"];
}): BotdeckPackage {
	return {
		format: BOTDECK_PACKAGE_FORMAT,
		version: BOTDECK_PACKAGE_VERSION,
		kind: params.kind,
		name: params.name,
		description: params.description ?? null,
		createdWith: "Botdeck",
		createdAt: new Date().toISOString(),
		items: params.items
	};
}

export function commandDraftToPackageItem(draft: ApplicationCommandDraft): BotdeckCommandPackageItem {
	return {
		kind: "command",
		schemaVersion: 1,
		name: draft.name || "command",
		draft: {
			...draft,
			id: undefined,
			raw: draft.raw ? { ...draft.raw, id: undefined, application_id: undefined, version: undefined } : null
		}
	};
}

export function templateToPackageItem(input: TemplateExportInput): BotdeckTemplatePackageItem {
	return {
		kind: "template",
		schemaVersion: 1,
		name: input.name,
		templateType: input.templateType,
		payload: input.payload
	};
}

export function downloadJsonPackage(pkg: BotdeckPackage, filename: string) {
	const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: "application/json" });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	link.remove();
	URL.revokeObjectURL(url);
}

export function readTextFile(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
		reader.onerror = () => reject(reader.error ?? new Error("Could not read file."));
		reader.readAsText(file);
	});
}

export function parseJsonFileContent(content: string): unknown {
	return JSON.parse(content);
}

export function parseBotdeckPackage(value: unknown): { package: BotdeckPackage | null; validation: BotdeckPackageValidationResult } {
	const validation = validateBotdeckPackage(value);
	return { package: isBotdeckPackage(value) ? value : null, validation };
}

export function commandConflictKey(draft: Pick<ApplicationCommandDraft, "scope" | "guildId" | "type" | "name">) {
	return `${draft.scope}:${draft.guildId ?? "global"}:${draft.type}:${draft.name.toLowerCase()}`;
}

export function duplicateCommandName(name: string, existingNames: Set<string>) {
	const base = safePackageName(name, "imported-command").slice(0, 24) || "imported-command";
	let index = 2;
	let candidate = `${base}-imported`;
	while (existingNames.has(candidate.toLowerCase())) {
		candidate = `${base}-${index}`;
		index += 1;
	}
	return candidate;
}

export function duplicateTemplateName(name: string, existingNames: Set<string>) {
	const base = name.trim() || "Imported template";
	let index = 2;
	let candidate = `${base} imported`;
	while (existingNames.has(candidate.toLowerCase())) {
		candidate = `${base} ${index}`;
		index += 1;
	}
	return candidate;
}
