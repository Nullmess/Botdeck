import type { ApplicationCommandDraft } from "./models";

export const BOTDECK_PACKAGE_FORMAT = "botdeck.package" as const;
export const BOTDECK_PACKAGE_VERSION = 1 as const;

export type BotdeckPackageKind = "command" | "commands" | "template" | "templates";

export type BotdeckTemplateType = "embed" | "welcome" | "goodbye" | "log" | "automation_message";

export interface BotdeckPackageBaseItem {
	kind: "command" | "template";
	schemaVersion: 1;
	name: string;
}

export interface BotdeckCommandPackageItem extends BotdeckPackageBaseItem {
	kind: "command";
	draft: ApplicationCommandDraft;
}

export interface BotdeckTemplatePackageItem extends BotdeckPackageBaseItem {
	kind: "template";
	templateType: BotdeckTemplateType;
	payload: Record<string, unknown>;
}

export type BotdeckPackageItem = BotdeckCommandPackageItem | BotdeckTemplatePackageItem;

export interface BotdeckPackage {
	format: typeof BOTDECK_PACKAGE_FORMAT;
	version: typeof BOTDECK_PACKAGE_VERSION;
	kind: BotdeckPackageKind;
	name: string;
	description?: string | null;
	createdWith: "Botdeck";
	createdAt: string;
	items: BotdeckPackageItem[];
}

export interface BotdeckPackageValidationResult {
	valid: boolean;
	reason?: string;
}

export function isBotdeckPackage(value: unknown): value is BotdeckPackage {
	if (!value || typeof value !== "object" || Array.isArray(value)) return false;
	const record = value as Record<string, unknown>;
	return record.format === BOTDECK_PACKAGE_FORMAT && record.version === BOTDECK_PACKAGE_VERSION && Array.isArray(record.items);
}

export function validateBotdeckPackage(value: unknown): BotdeckPackageValidationResult {
	if (!value || typeof value !== "object" || Array.isArray(value)) return { valid: false, reason: "Invalid JSON object." };
	const record = value as Record<string, unknown>;
	if (record.format !== BOTDECK_PACKAGE_FORMAT) return { valid: false, reason: "Not a Botdeck package." };
	if (record.version !== BOTDECK_PACKAGE_VERSION) return { valid: false, reason: "Unsupported Botdeck package version." };
	if (!["command", "commands", "template", "templates"].includes(String(record.kind))) return { valid: false, reason: "Unsupported package kind." };
	if (!Array.isArray(record.items)) return { valid: false, reason: "Package items must be an array." };
	if (record.items.length === 0) return { valid: false, reason: "Package is empty." };
	if (record.items.length > 100) return { valid: false, reason: "Package has too many items." };
	return { valid: true };
}
