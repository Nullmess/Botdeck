"use client";

// Vues de démarrage, premier lancement et modales projet/TLS.


import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Card } from "@/components/ui/panel";
import { TabButton, Tabs } from "@/components/ui/tabs";
import {
	BotdeckLogo,
	appendFirstLaunchRedirectFlag,
	botdeckFetch,
	markFirstLaunchPresentationSeen,
	stripDiscriminator
} from "@/features/workspace/core";
import { botAccountIsReadOnly, type BotAccountSummary } from "@botdeck/shared";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { i18nText, type UiLanguage, type UiText } from "../core/botdeck-app-i18n";

// Écran de chargement.
export function LoadingScreen({ text }: { text: UiText }) {
	return (
		<main className="minimalBootShell" aria-label={text.loadingBotdeck}>
			<section className="minimalBootStage" role="status" aria-live="polite">
				<div className="minimalBootMark">
					<BotdeckLogo />
				</div>
				<h1>{i18nText("Botdeck")}</h1>
				<div className="minimalBootLoader" aria-hidden="true">
					<span />
					<span />
					<span />
				</div>
			</section>
		</main>
	);
}


// Présentation premier lancement.
type FirstLaunchPresentationSlide = {
	kicker: string;
	title: string;
	description: string;
	visual: "language" | "hero" | "features" | "creator" | "tls";
	cards: Array<{ title: string; description: string; icon: ReactNode }>;
};

const GitHubLogo = () => (
	<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
		<path d="M12 2.2c-5.5 0-10 4.5-10 10 0 4.4 2.9 8.1 6.8 9.5.5.1.7-.2.7-.5v-1.8c-2.8.6-3.4-1.2-3.4-1.2-.5-1.1-1.1-1.4-1.1-1.4-.9-.6.1-.6.1-.6 1 0 1.6 1 1.6 1 .9 1.5 2.3 1.1 2.8.8.1-.6.3-1.1.6-1.3-2.2-.3-4.6-1.1-4.6-4.9 0-1.1.4-2 1-2.7-.1-.3-.5-1.3.1-2.7 0 0 .8-.3 2.8 1 .8-.2 1.7-.3 2.6-.3.9 0 1.8.1 2.6.3 1.9-1.3 2.8-1 2.8-1 .6 1.4.2 2.4.1 2.7.6.7 1 1.6 1 2.7 0 3.8-2.3 4.6-4.6 4.9.4.3.7.9.7 1.9v2.7c0 .3.2.6.7.5 4-1.3 6.8-5.1 6.8-9.5 0-5.5-4.5-10-10-10Z" />
	</svg>
);

const KofiLogo = () => (
	<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
		<path d="M4 5.5h12.2c2.1 0 3.8 1.7 3.8 3.8s-1.7 3.8-3.8 3.8h-.4c-.7 3.1-3.2 5.4-6.7 5.4H6.8C5.2 18.5 4 17.2 4 15.7V5.5Zm12.1 5.4c.9 0 1.6-.7 1.6-1.6s-.7-1.6-1.6-1.6h-.2v3.2h.2Z" />
		<path d="M10.1 14.9 7.3 12.3c-1.4-1.3-.5-3.6 1.4-3.6.8 0 1.3.3 1.7.9.4-.6 1-.9 1.8-.9 1.8 0 2.7 2.3 1.3 3.6l-2.8 2.6a.5.5 0 0 1-.6 0Z" />
	</svg>
);

const CreatorAvatar = ({ className }: { className?: string }) => {
	const [failed, setFailed] = useState(false);
	if (failed) return <span className={`creatorAvatarFallback${className ? ` ${className}` : ""}`} aria-hidden="true">Mx</span>;
	return <img className={className} src="https://github.com/Nullmess.png?size=180" alt="" draggable={false} referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
};

const BOTDECK_VERSION = process.env.NEXT_PUBLIC_BOTDECK_VERSION || "1.0.0";

const SparkIcon = () => (
	<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
		<path d="M12 2.8 14.1 8l5.4 2-5.4 2-2.1 5.2L9.9 12l-5.4-2 5.4-2L12 2.8Z" />
		<path d="m18.6 15.6.8 1.9 2 .8-2 .7-.8 2-.8-2-2-.7 2-.8.8-1.9Z" />
	</svg>
);

const ShieldIcon = () => (
	<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
		<path d="M12 3.3 19 6v5.1c0 4.5-2.8 8-7 9.6-4.2-1.6-7-5.1-7-9.6V6l7-2.7Z" />
		<path d="m9.2 12 1.9 1.9 3.8-4.1" />
	</svg>
);

const CommandIcon = () => (
	<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
		<path d="M8.5 5.5h7A3 3 0 0 1 18.5 8.5v7a3 3 0 0 1-3 3h-7A3 3 0 0 1 5.5 15.5v-7a3 3 0 0 1 3-3Z" />
		<path d="M9 12h6" />
		<path d="M12 9v6" />
	</svg>
);

const LayoutIcon = () => (
	<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
		<path d="M4.5 6.5h15" />
		<path d="M7 10.5h4" />
		<path d="M7 14h7" />
		<path d="M7 17.5h5" />
		<path d="M4.5 4.5h15v15h-15z" />
	</svg>
);

const MessageIcon = () => (
	<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
		<path d="M5 6.5h14v8.2c0 1.2-1 2.2-2.2 2.2h-5.5l-3.7 3v-3H7.2C6 16.9 5 15.9 5 14.7V6.5Z" />
		<path d="M8.5 10h7" />
		<path d="M8.5 13h4.5" />
	</svg>
);

const ActivityIcon = () => (
	<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
		<path d="M4.5 13.5h3l2-5 4 9 2-4h4" />
	</svg>
);

const ArrowGlyph = ({ direction }: { direction: "left" | "right" }) => (
	<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
		{direction === "left" ? <path d="m15 6-6 6 6 6" /> : <path d="m9 6 6 6-6 6" />}
	</svg>
);

type TlsActionState = "idle" | "status" | "import" | "generate";
type TlsActionResponse = { ok?: boolean; configured?: boolean; mode?: "dual" | "https-only" | null; httpsUrl?: string; httpUrl?: string; message?: string; hint?: string; fingerprint?: string | null; willRestart?: boolean; restartRequired?: boolean; generated?: boolean; httpPort?: number; httpsPort?: number; currentProtocol?: string; validFrom?: string | null; validTo?: string | null };

function sanitizeHttpsPortInput(value: string): number | null {
	const parsed = Number.parseInt(value, 10);
	return Number.isFinite(parsed) && parsed >= 1024 && parsed <= 65535 ? parsed : null;
}

function TlsLoadingGlyph({ label }: { label: string }) {
	return (
		<span className="firstLaunchTlsButtonLoader" role="status" aria-label={label}>
			<span /><span /><span />
		</span>
	);
}

function buildTlsRedirectUrl(payload: TlsActionResponse, fallbackPort: number | null): string | null {
	if (typeof window === "undefined") return payload.httpsUrl ?? null;
	const port = payload.httpsPort ?? fallbackPort ?? 3443;
	const hostname = (() => {
		try {
			return payload.httpsUrl ? new URL(payload.httpsUrl).hostname : window.location.hostname;
		} catch {
			return window.location.hostname || "127.0.0.1";
		}
	})();
	const pathname = window.location.pathname || "/";
	const search = window.location.search || "";
	const hash = window.location.hash || "";
	return `https://${hostname}:${port}${pathname}${search}${hash}`;
}

function formatTlsDate(value: string | null | undefined, language: UiLanguage): string | null {
	if (!value) return null;
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return null;
	return new Intl.DateTimeFormat(language === "fr" ? "fr-FR" : "en-US", { dateStyle: "medium" }).format(date);
}

function TlsConfigurator({ language, onSkip, markOnRedirect = false, surface = "firstLaunch" }: { language: UiLanguage; onSkip?: () => void; markOnRedirect?: boolean; surface?: "firstLaunch" | "modal" }) {
	const isFrench = language === "fr";
	const certificateInputRef = useRef<HTMLInputElement | null>(null);
	const keyInputRef = useRef<HTMLInputElement | null>(null);
	const [tlsBusy, setTlsBusy] = useState<TlsActionState>("idle");
	const [tlsStatus, setTlsStatus] = useState<TlsActionResponse | null>(null);
	const [tlsMessage, setTlsMessage] = useState<string | null>(null);
	const [tlsCertificateFile, setTlsCertificateFile] = useState<File | null>(null);
	const [tlsKeyFile, setTlsKeyFile] = useState<File | null>(null);
	const [httpsPortInput, setHttpsPortInput] = useState("3443");
	const [tlsRedirecting, setTlsRedirecting] = useState(false);
	const currentIsHttps = typeof window !== "undefined" && window.location.protocol === "https:";
	const selectedHttpsPort = sanitizeHttpsPortInput(httpsPortInput);
	const tlsIsLocked = tlsBusy !== "idle" || tlsRedirecting;
	const tlsConfigured = Boolean(tlsStatus?.configured);
	const canEditExistingTls = tlsConfigured || currentIsHttps;

	useEffect(() => {
		let cancelled = false;
		fetch("/api/tls/status", { cache: "no-store" })
			.then(async (response) => await response.json() as TlsActionResponse)
			.then((payload) => {
				if (cancelled) return;
				setTlsStatus(payload);
				if (payload.httpsPort) setHttpsPortInput(String(payload.httpsPort));
			})
			.catch(() => {
				if (!cancelled) setTlsStatus(null);
			});
		return () => { cancelled = true; };
	}, []);

	const finishTlsAction = (action: TlsActionState, payload: TlsActionResponse): boolean => {
		setTlsStatus(payload);
		if (payload.httpsPort) setHttpsPortInput(String(payload.httpsPort));
		if (!payload.ok) {
			setTlsMessage(payload.message ?? (isFrench ? "Action TLS impossible." : "TLS action failed."));
			return false;
		}
		const redirectUrl = buildTlsRedirectUrl(payload, selectedHttpsPort);
		if (redirectUrl) {
			if (markOnRedirect) markFirstLaunchPresentationSeen();
			setTlsBusy(action);
			setTlsRedirecting(true);
			setTlsMessage(isFrench ? `Configuration appliquée. Redirection vers HTTPS sur le port ${payload.httpsPort ?? selectedHttpsPort ?? 3443}…` : `Configuration applied. Redirecting to HTTPS on port ${payload.httpsPort ?? selectedHttpsPort ?? 3443}…`);
			window.setTimeout(() => {
				window.location.href = markOnRedirect ? appendFirstLaunchRedirectFlag(redirectUrl) : redirectUrl;
			}, payload.willRestart ? 1800 : 700);
			return true;
		}
		setTlsMessage(isFrench ? "Configuration appliquée." : "Configuration applied.");
		return false;
	};

	const runTlsAction = async (action: TlsActionState, task: () => Promise<TlsActionResponse>) => {
		if (!selectedHttpsPort) {
			setTlsMessage(isFrench ? "Choisis un port HTTPS valide entre 1024 et 65535." : "Choose a valid HTTPS port between 1024 and 65535.");
			return;
		}
		setTlsBusy(action);
		setTlsMessage(null);
		try {
			const keepBusy = finishTlsAction(action, await task());
			if (!keepBusy) setTlsBusy("idle");
		} catch (error) {
			setTlsMessage(error instanceof Error ? error.message : (isFrench ? "Action TLS impossible." : "TLS action failed."));
			setTlsBusy("idle");
		}
	};

	const generateTlsCertificate = () => runTlsAction("generate", async () => {
		const response = await botdeckFetch("/api/tls/generate", {
			method: "POST",
			cache: "no-store",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ httpsPort: selectedHttpsPort })
		});
		return await response.json() as TlsActionResponse;
	});

	const importTlsCertificate = () => runTlsAction("import", async () => {
		if (!tlsCertificateFile || !tlsKeyFile) return { ok: false, message: isFrench ? "Ajoute le certificat et la clé privée." : "Add the certificate and private key." };
		const form = new FormData();
		form.set("certificate", tlsCertificateFile);
		form.set("key", tlsKeyFile);
		form.set("httpsPort", String(selectedHttpsPort ?? 3443));
		const response = await botdeckFetch("/api/tls/import", { method: "POST", body: form, cache: "no-store" });
		return await response.json() as TlsActionResponse;
	});


	const updateTlsPort = () => runTlsAction("status", async () => {
		const response = await botdeckFetch("/api/tls/port", {
			method: "POST",
			cache: "no-store",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ httpsPort: selectedHttpsPort })
		});
		return await response.json() as TlsActionResponse;
	});

	const onCertificateSelected = (file: File | null) => {
		if (!file) return;
		setTlsCertificateFile(file);
		setTlsKeyFile(null);
		setTlsMessage(isFrench ? "Certificat ajouté. Choisis maintenant la clé privée." : "Certificate added. Now choose the private key.");
		window.setTimeout(() => keyInputRef.current?.click(), 120);
	};

	const onKeySelected = (file: File | null) => {
		if (!file) return;
		setTlsKeyFile(file);
		setTlsMessage(isFrench ? "Clé privée ajoutée. Tu peux appliquer TLS." : "Private key added. You can apply TLS.");
	};

	const handleImportStep = () => {
		if (!tlsCertificateFile) {
			certificateInputRef.current?.click();
			return;
		}
		if (!tlsKeyFile) {
			keyInputRef.current?.click();
			return;
		}
		importTlsCertificate();
	};

	const importLabel = !tlsCertificateFile
		? (isFrench ? "Importer un certificat" : "Import certificate")
		: !tlsKeyFile
			? (isFrench ? "Ajouter la clé privée" : "Add private key")
			: (isFrench ? "Appliquer TLS" : "Apply TLS");
	const statusTitle = currentIsHttps
		? (isFrench ? "Botdeck est ouvert en HTTPS." : "Botdeck is open in HTTPS.")
		: tlsConfigured
			? (isFrench ? "TLS est configuré." : "TLS is configured.")
			: (isFrench ? "HTTP est actif pour le moment." : "HTTP is active for now.");
	const statusDescription = currentIsHttps
		? (isFrench ? "Tu peux changer le port ou remplacer le certificat." : "You can change the port or replace the certificate.")
		: tlsConfigured
			? (isFrench ? "Tu peux passer en HTTPS, remplacer le certificat ou changer le port." : "You can switch to HTTPS, replace the certificate or change the port.")
			: (isFrench ? "Importe un certificat, génère un certificat local, ou passe cette étape." : "Import a certificate, generate a local certificate, or skip this step.");
	const validToLabel = formatTlsDate(tlsStatus?.validTo, language);

	return (
		<div className={`firstLaunchTlsPanel tlsConfigurator is-${surface}`}>
			<div className={`firstLaunchTlsState${currentIsHttps || tlsConfigured ? " isSecure" : ""}`}>
				<ShieldIcon />
				<div>
					<strong>{statusTitle}</strong>
					<small>{statusDescription}</small>
					{validToLabel ? <small>{isFrench ? `Expiration du certificat : ${validToLabel}` : `Certificate expires: ${validToLabel}`}</small> : null}
				</div>
			</div>

			<div className={`firstLaunchTlsPortRow${canEditExistingTls ? " hasButton" : ""}`}>
				<label>
					<span>{isFrench ? "Port HTTPS" : "HTTPS port"}</span>
					<Input
						type="number"
						inputMode="numeric"
						min={1024}
						max={65535}
						placeholder="3443"
						value={httpsPortInput}
						onChange={(event) => setHttpsPortInput(event.currentTarget.value)}
						disabled={tlsIsLocked}
					/>
				</label>
				{canEditExistingTls ? (
					<Button variant="unstyled" className="firstLaunchTlsPortApply" type="button" onClick={updateTlsPort} disabled={tlsIsLocked || !selectedHttpsPort}>
						{tlsBusy === "status" ? <TlsLoadingGlyph label={isFrench ? "Application en cours" : "Applying"} /> : <span>{isFrench ? "Appliquer le port" : "Apply port"}</span>}
					</Button>
				) : null}
			</div>

			<div className="firstLaunchTlsImportStepper">
				<Input ref={certificateInputRef} type="file" accept=".crt,.cer,.pem" hidden onChange={(event) => onCertificateSelected(event.currentTarget.files?.[0] ?? null)} />
				<Input ref={keyInputRef} type="file" accept=".key,.pem" hidden onChange={(event) => onKeySelected(event.currentTarget.files?.[0] ?? null)} />
				<Button variant="unstyled" className="firstLaunchTlsImportButton" type="button" onClick={handleImportStep} disabled={tlsIsLocked || !selectedHttpsPort}>
					{tlsBusy === "import" ? <TlsLoadingGlyph label={isFrench ? "Import en cours" : "Importing"} /> : <span>{importLabel}</span>}
				</Button>
				<div className="firstLaunchTlsFileSteps" aria-live="polite">
					<span className={tlsCertificateFile ? "isDone" : ""}>1. {tlsCertificateFile?.name ?? (isFrench ? "Certificat" : "Certificate")}</span>
					<span className={tlsKeyFile ? "isDone" : ""}>2. {tlsKeyFile?.name ?? (isFrench ? "Clé privée" : "Private key")}</span>
				</div>
			</div>

			<div className="firstLaunchTlsActions">
				<Button variant="unstyled" className="isRecommended" type="button" onClick={generateTlsCertificate} disabled={tlsIsLocked || !selectedHttpsPort}>
					{tlsBusy === "generate" ? <TlsLoadingGlyph label={isFrench ? "Génération en cours" : "Generating"} /> : <span>{tlsConfigured ? (isFrench ? "Re-générer" : "Regenerate") : (isFrench ? "Générer automatiquement" : "Generate automatically")}</span>}
				</Button>
				{onSkip ? (
					<Button variant="unstyled" type="button" onClick={onSkip} disabled={tlsIsLocked}>
						<span>{isFrench ? "Passer" : "Skip"}</span>
					</Button>
				) : null}
			</div>

			{tlsMessage ? <p className="firstLaunchTlsMessage">{tlsMessage}</p> : null}
		</div>
	);
}


export function FirstLaunchPresentation({ language, onLanguageChange, onClose, onExternalLink }: { language: UiLanguage; onLanguageChange: (language: UiLanguage) => void; onClose: () => void; onExternalLink: (url: string, label?: string) => void }) {
	const [activeSlide, setActiveSlide] = useState(0);
	const [slideDirection, setSlideDirection] = useState<"next" | "previous">("next");
	const [tlsBusy, setTlsBusy] = useState<TlsActionState>("idle");
	const [tlsStatus, setTlsStatus] = useState<TlsActionResponse | null>(null);
	const [tlsMessage, setTlsMessage] = useState<string | null>(null);
	const [tlsCertificateFile, setTlsCertificateFile] = useState<File | null>(null);
	const [tlsKeyFile, setTlsKeyFile] = useState<File | null>(null);
	const isFrench = language === "fr";
	const currentIsHttps = typeof window !== "undefined" && window.location.protocol === "https:";
	const slides: FirstLaunchPresentationSlide[] = isFrench ? [
		{
			kicker: "Langue",
			title: "Choisis ta langue",
			description: "L’interface s’adapte tout de suite.",
			visual: "language",
			cards: []
		},
		{
			kicker: "Premier lancement",
			title: "Bienvenue dans Botdeck",
			description: "Pilote ton bot Discord dans une interface claire, rapide et propre.",
			visual: "hero",
			cards: []
		},
		{
			kicker: "Fonctionnalités",
			title: "Ce que tu peux faire",
			description: "Botdeck centralise les outils utiles pour administrer, tester et comprendre ton bot sans te perdre entre Discord, le code et les logs.",
			visual: "features",
			cards: [
				{ title: "Messages", description: "Lire, envoyer, répondre, épingler et suivre l’activité.", icon: <MessageIcon /> },
				{ title: "Commandes slash", description: "Créer, prévisualiser, synchroniser et organiser les commandes.", icon: <CommandIcon /> },
				{ title: "Permissions", description: "Vérifier ce que le bot peut faire selon les salons et les rôles.", icon: <ShieldIcon /> },
				{ title: "Embeds", description: "Composer des messages riches avec un rendu visuel propre.", icon: <LayoutIcon /> },
				{ title: "Automatisations", description: "Préparer des comportements serveur sans fouiller partout.", icon: <ActivityIcon /> },
				{ title: "Observabilité", description: "Voir l’état du bot, les logs et les erreurs importantes.", icon: <SparkIcon /> }
			]
		},
		{
			kicker: "Projet indépendant",
			title: "Développé par Nullmess",
			description: "Tu peux suivre le développement sur GitHub ou soutenir le projet via Ko-fi.",
			visual: "creator",
			cards: []
		},
		{
			kicker: "HTTPS / TLS",
			title: "Sécuriser l’accès local",
			description: "Choisis comment Botdeck doit gérer HTTPS avant d’arriver au menu principal.",
			visual: "tls",
			cards: []
		}
	] : [
		{
			kicker: "Language",
			title: "Choose your language",
			description: "The interface updates right away.",
			visual: "language",
			cards: []
		},
		{
			kicker: "First launch",
			title: "Welcome to Botdeck",
			description: "Manage your Discord bot in a clear, fast and clean interface.",
			visual: "hero",
			cards: []
		},
		{
			kicker: "Features",
			title: "What you can do",
			description: "Botdeck centralizes the useful tools you need to administer, test and understand your bot without jumping between Discord, code and logs.",
			visual: "features",
			cards: [
				{ title: "Messages", description: "Read, send, reply, pin and track activity.", icon: <MessageIcon /> },
				{ title: "Slash commands", description: "Create, preview, sync and organize commands.", icon: <CommandIcon /> },
				{ title: "Permissions", description: "Check what the bot can do depending on channels and roles.", icon: <ShieldIcon /> },
				{ title: "Embeds", description: "Build rich messages with a clean visual preview.", icon: <LayoutIcon /> },
				{ title: "Automations", description: "Prepare server behaviors without digging everywhere.", icon: <ActivityIcon /> },
				{ title: "Observability", description: "See bot health, logs and important errors.", icon: <SparkIcon /> }
			]
		},
		{
			kicker: "Independent project",
			title: "Built by Nullmess",
			description: "Follow the development on GitHub or support the project on Ko-fi.",
			visual: "creator",
			cards: []
		},
		{
			kicker: "HTTPS / TLS",
			title: "Secure local access",
			description: "Choose how Botdeck should handle HTTPS before opening the main menu.",
			visual: "tls",
			cards: []
		}
	];
	const slide = slides[activeSlide];
	const canGoPrevious = activeSlide > 0;
	const canGoNext = activeSlide < slides.length - 1;
	const nextLabel = canGoNext ? (isFrench ? "Suivant" : "Next") : (isFrench ? "Terminer" : "Finish");

	const goPrevious = () => {
		setSlideDirection("previous");
		setActiveSlide((current) => Math.max(0, current - 1));
	};
	const goNext = () => {
		if (!canGoNext) {
			onClose();
			return;
		}
		setSlideDirection("next");
		setActiveSlide((current) => Math.min(slides.length - 1, current + 1));
	};
	const goToSlide = (index: number) => {
		setSlideDirection(index > activeSlide ? "next" : "previous");
		setActiveSlide(index);
	};

	const finishTlsAction = (payload: TlsActionResponse) => {
		if (!payload.ok) {
			setTlsMessage(payload.message ?? (isFrench ? "Action TLS impossible." : "TLS action failed."));
			return;
		}
		if (payload.httpsUrl) {
			markFirstLaunchPresentationSeen();
			setTlsMessage(isFrench ? "Configuration appliquée. Redirection vers HTTPS…" : "Configuration applied. Redirecting to HTTPS…");
			window.setTimeout(() => {
				window.location.href = appendFirstLaunchRedirectFlag(payload.httpsUrl as string);
			}, payload.willRestart ? 1800 : 700);
			return;
		}
		markFirstLaunchPresentationSeen();
		setTlsMessage(isFrench ? "Configuration appliquée." : "Configuration applied.");
	};

	const runTlsAction = async (action: TlsActionState, task: () => Promise<TlsActionResponse>) => {
		setTlsBusy(action);
		setTlsMessage(null);
		try {
			finishTlsAction(await task());
		} catch (error) {
			setTlsMessage(error instanceof Error ? error.message : (isFrench ? "Action TLS impossible." : "TLS action failed."));
		} finally {
			setTlsBusy("idle");
		}
	};

	const generateTlsCertificate = () => runTlsAction("generate", async () => {
		const response = await botdeckFetch("/api/tls/generate", { method: "POST", cache: "no-store" });
		return await response.json() as TlsActionResponse;
	});

	const importTlsCertificate = () => runTlsAction("import", async () => {
		if (!tlsCertificateFile || !tlsKeyFile) return { ok: false, message: isFrench ? "Ajoute le certificat et la clé privée." : "Add the certificate and private key." };
		const form = new FormData();
		form.set("certificate", tlsCertificateFile);
		form.set("key", tlsKeyFile);
		const response = await botdeckFetch("/api/tls/import", { method: "POST", body: form, cache: "no-store" });
		return await response.json() as TlsActionResponse;
	});



	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "ArrowRight") goNext();
			if (event.key === "ArrowLeft") goPrevious();
			if (event.key === "Escape") onClose();
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [activeSlide, canGoNext, onClose]);

	return (
		<main className="firstLaunchShell" aria-label={isFrench ? "Présentation de Botdeck" : "Botdeck introduction"}>
			<div className="firstLaunchAura firstLaunchAuraOne" aria-hidden="true" />
			<div className="firstLaunchAura firstLaunchAuraTwo" aria-hidden="true" />

			<Modal backdropClassName="firstLaunchModalBackdrop" surfaceClassName="firstLaunchPanel" aria-labelledby="firstLaunchTitle" closeOnBackdrop={false} onClose={onClose}>
				<header className="firstLaunchHeader">
					<div className="firstLaunchBrand">
						<span className="firstLaunchLogoFrame"><BotdeckLogo /></span>
						<div>
							<strong>Botdeck</strong>
							<span>{isFrench ? "Cockpit Discord local" : "Local Discord cockpit"}</span>
						</div>
					</div>
					<Button variant="unstyled" className="firstLaunchSkip" type="button" onClick={onClose}>{isFrench ? "Passer" : "Skip"}</Button>
				</header>

				<div className={`firstLaunchSlide is-${slide.visual} is-moving-${slideDirection}`} key={activeSlide}>
					<div className="firstLaunchCopy">
						<p className="eyebrow firstLaunchEyebrow">{slide.kicker}</p>
						<h1 id="firstLaunchTitle">{slide.title}</h1>
						<p>{slide.description}</p>

						{slide.visual === "language" ? (
							<div className="firstLaunchLanguageGrid" role="group" aria-label={isFrench ? "Choix de la langue" : "Language selection"}>
								<Button variant="unstyled"
									type="button"
									className={`firstLaunchLanguageChoice${language === "fr" ? " isSelected" : ""}`}
									onClick={() => {
										onLanguageChange("fr");
										setSlideDirection("next");
										setActiveSlide(1);
									}}
								>
									<span className="firstLaunchLanguageFlag" aria-hidden="true">FR</span>
									<span>
										<strong>Français</strong>
										<small>Interface en français</small>
									</span>
								</Button>
								<Button variant="unstyled"
									type="button"
									className={`firstLaunchLanguageChoice${language === "en" ? " isSelected" : ""}`}
									onClick={() => {
										onLanguageChange("en");
										setSlideDirection("next");
										setActiveSlide(1);
									}}
								>
									<span className="firstLaunchLanguageFlag" aria-hidden="true">EN</span>
									<span>
										<strong>English</strong>
										<small>English interface</small>
									</span>
								</Button>
							</div>
						) : null}

						{slide.visual === "creator" ? (
							<div className="firstLaunchCreatorActions">
								<Button variant="unstyled" className="firstLaunchSocialButton" type="button" onClick={() => onExternalLink("https://github.com/Nullmess", "GitHub Nullmess")}>
									<GitHubLogo />
									<span>github.com/Nullmess</span>
								</Button>
								<Button variant="unstyled" className="firstLaunchSocialButton isKofi" type="button" onClick={() => onExternalLink("https://ko-fi.com/Macxzew", "Ko-fi Macxzew")}>
									<KofiLogo />
									<span>ko-fi.com/macxzew</span>
								</Button>
							</div>
						) : null}

						{slide.visual === "tls" ? (
							<TlsConfigurator language={language} onSkip={onClose} markOnRedirect />
						) : null}
					</div>

					{(slide.visual === "hero" || slide.visual === "creator") ? (
						<div className="firstLaunchVisual" aria-hidden="true">
							{slide.visual === "creator" ? (
								<Card as="div" className="firstLaunchCreatorCard">
									<CreatorAvatar />
									<div>
										<strong>Nullmess</strong>
										<span>{isFrench ? "Développeur de Botdeck" : "Botdeck developer"}</span>
									</div>
								</Card>
							) : (
								<div className="firstLaunchMockup">
									<div className="firstLaunchMockRail"><span /><span /><span /></div>
									<div className="firstLaunchMockSidebar"><span /><span /><span /><span /></div>
									<div className="firstLaunchMockContent">
										<span />
										<span />
										<span />
									</div>
								</div>
							)}
						</div>
					) : null}
				</div>

				{slide.cards.length ? (
					<div className="firstLaunchCards">
						{slide.cards.map((card) => (
							<Card className="firstLaunchCard" key={card.title}>
								<span className="firstLaunchCardIcon">{card.icon}</span>
								<strong>{card.title}</strong>
								<p>{card.description}</p>
							</Card>
						))}
					</div>
				) : null}

				<footer className="firstLaunchFooter">
					<Button variant="unstyled" className="firstLaunchArrow" type="button" onClick={goPrevious} disabled={!canGoPrevious} aria-label={isFrench ? "Slide précédente" : "Previous slide"}>
						<ArrowGlyph direction="left" />
					</Button>
					<Tabs className="firstLaunchDots" aria-label={isFrench ? "Progression" : "Progress"}>
						{slides.map((item, index) => (
							<TabButton key={item.title} active={index === activeSlide} type="button" onClick={() => goToSlide(index)} aria-label={`${isFrench ? "Aller à" : "Go to"} ${item.title}`} />
						))}
					</Tabs>
					<Button variant="unstyled" className="firstLaunchPrimary" type="button" onClick={goNext}>
						<span>{nextLabel}</span>
						<ArrowGlyph direction="right" />
					</Button>
				</footer>
			</Modal>
		</main>
	);
}

// Lanceur de bot.
export function BotLauncher({
	bots,
	onSelectBot,
	onOpenAddBot,
	onRemoveBot,
	onOpenProjectInfo,
	onOpenTlsSettings,
	language,
	onLanguageChange,
	text
}: {
	bots: BotAccountSummary[];
	onSelectBot: (botId: string) => void;
	onOpenAddBot: () => void;
	onRemoveBot: (bot: BotAccountSummary) => void;
	onOpenProjectInfo: () => void;
	onOpenTlsSettings: () => void;
	language: UiLanguage;
	onLanguageChange: (language: UiLanguage) => void;
	text: UiText;
}) {
	const hasBots = bots.length > 0;

	return (
		<main className={`launchShell botPickerShell${hasBots ? "" : " isEmpty"}`} aria-label={text.botLauncher}>
			<div className="botPickerDock" aria-label={text.availableBots}>
				{bots.map((bot, index) => {
					const botName = stripDiscriminator(bot.name);
					return (
						<div key={bot.id} className="launchBotSlot" style={{ "--slot-index": index } as CSSProperties}>
							<Button variant="unstyled" className="launchBotRound" type="button" onClick={() => onSelectBot(bot.id)} title={botName}>
								{bot.avatarUrl ? (
									<img className="botDockAvatar" src={bot.avatarUrl} alt="" aria-hidden="true" />
								) : (
									<span>{botName.slice(0, 1).toUpperCase()}</span>
								)}
							</Button>
							<Button variant="unstyled" className="launchBotRemove" type="button" aria-label={`${text.removeBot} ${botName}`} title={text.removeBot} onClick={() => onRemoveBot(bot)}>
								×
							</Button>
							<small>{botName}</small>
							{botAccountIsReadOnly(bot) ? (
								<Badge className="launchBotSafetyBadge" tone="unstyled" aria-label={text.slashStudioLocked}>
									<span aria-hidden="true">🔒</span>
								</Badge>
							) : null}
						</div>
					);
				})}
				<Button variant="unstyled" className="launchInlineAddButton" type="button" onClick={onOpenAddBot} title={text.addBot} aria-label={text.addBot}>
					<span>+</span>
				</Button>
			</div>
			<Button variant="unstyled" className="botPickerAboutButton botPickerTlsButton" type="button" onClick={onOpenTlsSettings} title={language === "fr" ? "HTTPS / TLS" : "HTTPS / TLS"} aria-label={language === "fr" ? "Configurer HTTPS et TLS" : "Configure HTTPS and TLS"}>
				<span className="botPickerAboutIcon" aria-hidden="true"><ShieldIcon /></span>
			</Button>
			<div className="botPickerActionGroup">
				<Button variant="unstyled" className="botPickerAboutButton" type="button" onClick={onOpenProjectInfo}>
					<span className="botPickerAboutIcon" aria-hidden="true"><BotdeckLogo /></span>
					<span>{language === "fr" ? "À propos" : "About"}</span>
				</Button>
			</div>
			<LanguagePicker language={language} text={text} onChange={onLanguageChange} />
		</main>
	);
}

export function BotdeckTlsModal({ language, onClose }: { language: UiLanguage; onClose: () => void }) {
	const isFrench = language === "fr";

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") onClose();
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [onClose]);

	return (
		<Modal backdropClassName="projectInfoOverlay tlsSettingsOverlay" surfaceClassName="projectInfoModal tlsSettingsModal" aria-labelledby="tlsSettingsTitle" onClose={onClose}>
				<Button variant="unstyled" className="projectInfoClose" type="button" aria-label={isFrench ? "Fermer" : "Close"} onClick={onClose}>×</Button>
				<div className="projectInfoHeader">
					<span className="projectInfoLogo"><ShieldIcon /></span>
					<div>
						<p className="eyebrow">HTTPS / TLS</p>
						<h2 id="tlsSettingsTitle">{isFrench ? "Sécurité locale" : "Local security"}</h2>
					</div>
				</div>
				<p className="tlsSettingsIntro">{isFrench ? "Active HTTPS, remplace le certificat, re-génère une paire locale ou change le port HTTPS." : "Enable HTTPS, replace the certificate, regenerate a local pair or change the HTTPS port."}</p>
				<TlsConfigurator language={language} surface="modal" />
		</Modal>
	);
}

export function BotdeckProjectModal({ language, onClose, onExternalLink }: { language: UiLanguage; onClose: () => void; onExternalLink: (url: string, label?: string) => void }) {
	const isFrench = language === "fr";


	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") onClose();
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [onClose]);

	return (
		<Modal backdropClassName="projectInfoOverlay" surfaceClassName="projectInfoModal" aria-labelledby="projectInfoTitle" onClose={onClose}>
				<Button variant="unstyled" className="projectInfoClose" type="button" aria-label={isFrench ? "Fermer" : "Close"} onClick={onClose}>×</Button>
				<div className="projectInfoHeader">
					<span className="projectInfoLogo"><BotdeckLogo /></span>
					<div>
						<p className="eyebrow">{isFrench ? "Projet indépendant" : "Independent project"}</p>
						<h2 id="projectInfoTitle">Botdeck</h2>
					</div>
				</div>
				<div className="projectInfoBody">
					<div className="projectInfoMeta" aria-label={isFrench ? `Version de Botdeck ${BOTDECK_VERSION}` : `Botdeck version ${BOTDECK_VERSION}`}>
						<span>{isFrench ? "Version" : "Version"}</span>
						<strong>v{BOTDECK_VERSION}</strong>
					</div>
					<div className="projectInfoCreator">
						<CreatorAvatar />
						<div>
							<strong>Nullmess</strong>
							<span>{isFrench ? "Développeur de Botdeck" : "Botdeck developer"}</span>
						</div>
					</div>
					<p>{isFrench ? "Suis le projet sur GitHub ou soutiens son développement via Ko-fi." : "Follow the project on GitHub or support its development through Ko-fi."}</p>
					<div className="projectInfoActions">
						<Button variant="unstyled" type="button" onClick={() => {
							onClose();
							onExternalLink("https://github.com/Nullmess", "GitHub Nullmess");
						}}>
							<GitHubLogo />
							<span>github.com/Nullmess</span>
						</Button>
						<Button variant="unstyled" className="isKofi" type="button" onClick={() => {
							onClose();
							onExternalLink("https://ko-fi.com/macxzew", "Ko-fi Macxzew");
						}}>
							<KofiLogo />
							<span>ko-fi.com/macxzew</span>
						</Button>
					</div>
				</div>
		</Modal>
	);
}

// Sélecteur de langue.
export function LanguagePicker({ language, text, onChange }: { language: UiLanguage; text: UiText; onChange: (language: UiLanguage) => void }) {
	const [open, setOpen] = useState(false);
	const pickerRef = useRef<HTMLDivElement | null>(null);
	const languages: Array<{ value: UiLanguage; code: string; label: string; nativeLabel: string }> = [
		{ value: "fr", code: "FR", label: text.french, nativeLabel: "Français" },
		{ value: "en", code: "EN", label: text.english, nativeLabel: "English" }
	];
	const selectedLanguage = languages.find((item) => item.value === language) ?? languages[0];

	useEffect(() => {
		if (!open) return;
		const handlePointerDown = (event: MouseEvent) => {
			if (!pickerRef.current?.contains(event.target as Node)) setOpen(false);
		};
		const handleKeyDown = (event: globalThis.KeyboardEvent) => {
			if (event.key === "Escape") setOpen(false);
		};
		document.addEventListener("mousedown", handlePointerDown);
		document.addEventListener("keydown", handleKeyDown);
		return () => {
			document.removeEventListener("mousedown", handlePointerDown);
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, [open]);

	return (
		<div ref={pickerRef} className={`languagePicker${open ? " isOpen" : ""}`} aria-label={text.language}>
			<Button variant="unstyled"
				type="button"
				className="languagePickerTrigger"
				onClick={() => setOpen((current) => !current)}
				aria-haspopup="listbox"
				aria-expanded={open}
			>
				<span className="languagePickerGlobe" aria-hidden="true">
					<svg viewBox="0 0 24 24" focusable="false">
						<path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
						<path d="M3.6 9h16.8M3.6 15h16.8M12 3c2.2 2.3 3.2 5.3 3.2 9s-1 6.7-3.2 9c-2.2-2.3-3.2-5.3-3.2-9s1-6.7 3.2-9Z" />
					</svg>
				</span>
				<span className="languagePickerCurrent">
					<strong>{selectedLanguage.code}</strong>
					<small>{selectedLanguage.nativeLabel}</small>
				</span>
				<span className="languagePickerChevron" aria-hidden="true">⌄</span>
			</Button>
			{open ? (
				<div className="languagePickerMenu" role="listbox" aria-label={text.language}>
					<div className="languagePickerMenuHeader">{text.language}</div>
					{languages.map((item) => {
						const selected = language === item.value;
						return (
							<Button variant="unstyled"
								key={item.value}
								type="button"
								className={`languagePickerOption${selected ? " isSelected" : ""}`}
								onClick={() => {
									onChange(item.value);
									setOpen(false);
								}}
								role="option"
								aria-selected={selected}
							>
								<span className="languagePickerFlag" aria-hidden="true">{item.code}</span>
								<span>
									<strong>{item.nativeLabel}</strong>
									<small>{item.code}</small>
								</span>
								{selected ? <span className="languagePickerCheck" aria-hidden="true">✓</span> : null}
							</Button>
						);
					})}
				</div>
			) : null}
		</div>
	);
}
