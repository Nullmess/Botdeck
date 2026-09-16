import type { ChannelSummary } from "@botdeck/shared";
import type { UiText } from "@/features/workspace/core";
import { ChatChannelTag } from "@/components/botdeck-app-chat-widgets";
import { Button } from "./ui/button";
import { Badge } from "@/components/ui/badge";

type BotdeckChatTopbarProps = {
	activeBotId: string | null;
	activeBotReadOnly: boolean;
	activeChannel: ChannelSummary | null;
	botDashboardOpen: boolean;
	botdeckHomeOpen: boolean;
	messageSearchOpen: boolean;
	permissionsPanelOpen: boolean;
	pinsPanelOpen: boolean;
	slashCommandsOpen: boolean;
	title: string;
	subtitle: string;
	text: UiText;
	onExitBot: () => void;
	onOpenBotDashboard: () => void;
	onOpenChannelDrawer: () => void;
	onOpenMessageSearch: () => void;
	onOpenPermissions: () => void;
	onOpenPins: () => void;
	onOpenSlashStudio: () => void;
};

export function BotdeckChatTopbar({
	activeBotId,
	activeBotReadOnly,
	activeChannel,
	botDashboardOpen,
	botdeckHomeOpen,
	messageSearchOpen,
	permissionsPanelOpen,
	pinsPanelOpen,
	slashCommandsOpen,
	title,
	subtitle,
	text,
	onExitBot,
	onOpenBotDashboard,
	onOpenChannelDrawer,
	onOpenMessageSearch,
	onOpenPermissions,
	onOpenPins,
	onOpenSlashStudio
}: BotdeckChatTopbarProps) {
	const canShowMessageTools = !botdeckHomeOpen && activeChannel && activeChannel.type !== "voice" && activeChannel.type !== "forum";
	const canShowChannelPermissions = !botdeckHomeOpen && activeChannel;

	return (
		<header className="chatTopbar">
			<div className="chatTopbarLeft">
				<Button variant="icon" className="mobileChannelToggle" type="button" aria-label={text.openChannels} onClick={onOpenChannelDrawer}>
					☰
				</Button>
				<ChatChannelTag botdeckHomeOpen={botdeckHomeOpen} channel={activeChannel} />
				<div>
					<h2>{title}</h2>
					<p>{subtitle}</p>
				</div>
			</div>
			<div className="chatTopbarRight">
				{canShowMessageTools ? (
					<Button variant="icon" className={`topbarIconButton searchTopbarButton${messageSearchOpen ? " isActive" : ""}`} type="button" onClick={onOpenMessageSearch} aria-label={text.searchMessages} title={text.searchMessages}>
						<svg className="topbarSvgIcon searchGlyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
							<circle cx="10.75" cy="10.75" r="5.75" />
							<path d="m15.1 15.1 4.15 4.15" />
						</svg>
					</Button>
				) : null}

				{canShowMessageTools ? (
					<Button variant="icon" className={`topbarIconButton pinTopbarButton${pinsPanelOpen ? " isActive" : ""}`} type="button" onClick={onOpenPins} aria-label={text.pinnedMessages} title={text.pinnedMessages}>
						<svg className="topbarSvgIcon pinTopbarGlyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
							<path d="m14.5 4.5 5 5" />
							<path d="m9.5 9.5 5-5 5 5-5 5" />
							<path d="m12.1 12.9-6.6 6.6" />
							<path d="m7.75 8.5 7.75 7.75" />
						</svg>
					</Button>
				) : null}

				{activeBotId ? (
					<>
						<Button
							variant="icon"
							className={`topbarIconButton slashCommandTopbarButton${slashCommandsOpen ? " isActive" : ""}${activeBotReadOnly ? " isDisabled" : ""}`}
							type="button"
							onClick={onOpenSlashStudio}
							aria-label={text.slashCommands}
							title={activeBotReadOnly ? text.slashStudioDisabledToast : text.slashCommands}
						>
							<svg className="topbarSvgIcon slashCommandGlyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
								<path className="slashCommandGlyphSlash" d="M15.75 4.25 8.25 19.75" />
							</svg>
							{activeBotReadOnly ? <Badge className="topbarReadonlyBadge" tone="unstyled" aria-hidden="true">🔒</Badge> : null}
						</Button>
						<Button
							variant="icon"
							className={`topbarIconButton botHealthTopbarButton${botDashboardOpen ? " isActive" : ""}`}
							type="button"
							onClick={onOpenBotDashboard}
							aria-label={text.botHealth}
							title={text.botHealth}
						>
							<svg className="botHealthGlyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
								<path d="M8.2 3.5h7.6l1.25 3.1 3.2 1.23v7.66l-3.18 1.2-1.27 3.31H8.2l-1.27-3.31-3.18-1.2V7.83L6.95 6.6 8.2 3.5Z" />
								<path d="M11 7.5h2v3.25h3.25v2H13V16h-2v-3.25H7.75v-2H11V7.5Z" />
							</svg>
						</Button>
					</>
				) : null}

				{canShowChannelPermissions ? (
					<Button
						variant="icon"
						className={`topbarIconButton permissionTopbarButton${permissionsPanelOpen ? " isActive" : ""}`}
						type="button"
						onClick={onOpenPermissions}
						aria-label={text.channelPermissions}
						title={text.channelPermissions}
					>
						<svg viewBox="0 0 24 24" aria-hidden="true" className="permissionGlyph">
							<path d="M12 2.75 19 5.6v5.45c0 4.45-2.83 8.4-7 9.82-4.17-1.42-7-5.37-7-9.82V5.6l7-2.85Z" />
							<path d="M12 11.2a2.35 2.35 0 1 0 0-4.7 2.35 2.35 0 0 0 0 4.7Z" />
							<path d="M7.95 15.95c.7-1.9 2.2-3.05 4.05-3.05s3.35 1.15 4.05 3.05c-1.02 1.18-2.38 2.12-4.05 2.75-1.67-.63-3.03-1.57-4.05-2.75Z" />
						</svg>
					</Button>
				) : null}

				<Button variant="icon" className="topbarIconButton" type="button" onClick={onExitBot} aria-label={text.exitBot}>
					×
				</Button>
			</div>
		</header>
	);
}
