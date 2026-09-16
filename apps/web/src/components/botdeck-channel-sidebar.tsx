import type { DragEvent, MouseEvent, PointerEvent as ReactPointerEvent } from "react";
import type { ChannelSummary, ForumPostSummary, VoiceStateSummary, WorkspaceState } from "@botdeck/shared";
import type { ChannelActivityState, ChannelCategoryGroup, RetainedDmChannel, UiText } from "@/features/workspace/core";
import { displayUserName, dmGuildId, resolveDmChannelUser, stripDiscriminator } from "@/features/workspace/core";
import { ChannelTypeIcon, WorkspaceSkeleton } from "@/components/botdeck-app-widgets";
import { serverLabels } from "@/features/server-settings/server-settings-text";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export type SelectedForumPostState = {
	forumId: string;
	post: ForumPostSummary;
	parentForum: ChannelSummary | null;
} | null;

type RecoverableDmThread = {
	channel: RetainedDmChannel;
	guild: WorkspaceState["guilds"][number];
};

type BotdeckChannelSidebarProps = {
	activeBotId: string | null;
	activeBotUserId: string | null;
	activeChannel: ChannelSummary | null;
	activeChannelGroups: ChannelCategoryGroup[];
	activeChannels: ChannelSummary[];
	activeGuildId: string | null;
	activeGuildLabel: string | null;
	activeVoiceStates: VoiceStateSummary[];
	canOpenServerSettings: boolean;
	channelActivity: ChannelActivityState;
	channelDrawerOpen: boolean;
	channelDragSource: ChannelSummary | null;
	channelDropTarget: { targetId: string | null } | null;
	collapsedCategories: Record<string, boolean>;
	isDmView: boolean;
	recoverableDmThreads: RecoverableDmThread[];
	selectedForumPost: SelectedForumPostState;
	syncingChannelId: string | null;
	text: UiText;
	workspace: WorkspaceState;
	botdeckHomeOpen: boolean;
	onBeginChannelDrag: (event: DragEvent<HTMLElement>, channel: ChannelSummary) => void;
	onCancelChannelDrag: () => void;
	onChannelDragAllowed: (channel: ChannelSummary) => boolean;
	onChannelDropClass: (channelId: string, position: "before" | "after" | "inside") => string;
	onCloseDrawer: () => void;
	onCloseRetainedDm: (channelId: string) => void;
	onFinishChannelDrop: (event: DragEvent<HTMLElement>, channel: ChannelSummary | null) => void;
	onOpenChannelContextMenu: (event: MouseEvent<HTMLElement>, channel: ChannelSummary | null) => void;
	onOpenMemberContextMenu: (event: MouseEvent<HTMLElement>, guildId: string | null, userId: string) => boolean;
	onOpenForumPost: (post: ForumPostSummary) => void;
	onOpenMemberProfile: (guildId: string | null, userId: string) => void;
	onOpenRecoverableThread: (guildId: string, channelId: string) => void;
	onOpenServerSettings: () => void;
	onSelectChannel: (channelId: string) => void;
	onStartResize: (event: ReactPointerEvent<HTMLButtonElement>) => void;
	onToggleCategory: (categoryId: string) => void;
	onUpdateChannelDropTarget: (event: DragEvent<HTMLElement>, channel: ChannelSummary | null) => void;
};

export function BotdeckChannelSidebar({
	activeBotId,
	activeBotUserId,
	activeChannel,
	activeChannelGroups,
	activeChannels,
	activeGuildId,
	activeGuildLabel,
	activeVoiceStates,
	canOpenServerSettings,
	channelActivity,
	channelDrawerOpen,
	channelDragSource,
	channelDropTarget,
	collapsedCategories,
	isDmView,
	recoverableDmThreads,
	selectedForumPost,
	syncingChannelId,
	text,
	workspace,
	botdeckHomeOpen,
	onBeginChannelDrag,
	onCancelChannelDrag,
	onChannelDragAllowed,
	onChannelDropClass,
	onCloseDrawer,
	onCloseRetainedDm,
	onFinishChannelDrop,
	onOpenChannelContextMenu,
	onOpenForumPost,
	onOpenMemberProfile,
	onOpenMemberContextMenu,
	onOpenRecoverableThread,
	onOpenServerSettings,
	onSelectChannel,
	onStartResize,
	onToggleCategory,
	onUpdateChannelDropTarget
}: BotdeckChannelSidebarProps) {
	return (
		<section className={`channelSidebar${channelDrawerOpen ? " isOpen" : ""}`}>
			<Button variant="unstyled" className="channelSidebarResizeHandle" type="button" aria-label={text.resizeChannels} onPointerDown={onStartResize} />
			<header className="serverHeader">
				<div className="serverHeaderTitle">
					<p className="eyebrow">{botdeckHomeOpen || isDmView ? "Botdeck" : text.server}</p>
					<h1>{botdeckHomeOpen || isDmView ? text.privateMessages : activeGuildLabel ?? (activeBotId ? text.loadingServers : text.noServerSelected)}</h1>
				</div>
				<div className="serverHeaderActions">
					{canOpenServerSettings ? (
						<Button variant="unstyled" className="serverSettingsButton" type="button" aria-label={serverLabels(text).serverSettingsTitle} title={serverLabels(text).serverSettingsTitle} onClick={onOpenServerSettings}>
							<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
								<path d="M19.43 12.98c.04-.32.07-.65.07-.98s-.02-.66-.07-.98l2.04-1.58a.48.48 0 0 0 .11-.61l-1.93-3.34a.49.49 0 0 0-.59-.22l-2.4.96a7.12 7.12 0 0 0-1.7-.98l-.36-2.54A.49.49 0 0 0 14.12 2h-3.86a.49.49 0 0 0-.48.41l-.36 2.54c-.61.24-1.18.56-1.7.98l-2.4-.96a.49.49 0 0 0-.59.22L2.8 8.53a.48.48 0 0 0 .11.61l2.04 1.58c-.04.32-.07.65-.07.98s.02.66.07.98L2.91 14.56a.48.48 0 0 0-.11.61l1.93 3.34c.12.21.38.3.59.22l2.4-.96c.52.41 1.09.74 1.7.98l.36 2.54c.04.24.24.41.48.41h3.86c.24 0 .44-.17.48-.41l.36-2.54c.61-.24 1.18-.56 1.7-.98l2.4.96c.22.08.47-.01.59-.22l1.93-3.34a.48.48 0 0 0-.11-.61l-2.04-1.58ZM12.2 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z" />
							</svg>
						</Button>
					) : null}
					<Button variant="unstyled" className="sidebarCloseButton" type="button" aria-label={text.closeChannels} onClick={onCloseDrawer}>
						×
					</Button>
				</div>
			</header>
			{botdeckHomeOpen ? (
				<div className="channelGroups">
					<section className="channelGroup">
						<div className="channelGroupLabel">{text.privateMessages}</div>
						<nav className="channelList" aria-label={text.recoverableThreads}>
							{recoverableDmThreads.length ? (
								recoverableDmThreads.map(({ channel, guild }) => {
									const dmUser = channel.type === "dm" ? resolveDmChannelUser(channel, workspace, activeBotUserId) : null;
									const label = dmUser ? displayUserName(dmUser) : stripDiscriminator(channel.name);
									const activity = channelActivity[channel.id];
									const unreadCount = activity?.unreadCount ?? 0;
									return (
										<Button variant="unstyled" key={`${guild.id}-${channel.id}`} className={`channelButton${channel.type === "dm" ? " dmChannelButton" : ""}`} type="button" onClick={() => onOpenRecoverableThread(guild.id, channel.id)}>
											{channel.type === "dm" ? (
												<>
													<span className="globalMemberAvatar dmChannelAvatar">
														{dmUser?.avatarUrl ? <img src={dmUser.avatarUrl} alt="" aria-hidden="true" /> : label.slice(0, 1).toUpperCase()}
													</span>
													<span className="channelName dmChannelName">
														<span>{label}</span>
														<span className="dmChannelActions">
															{unreadCount ? <Badge className={`dmUnreadBadge${activity?.mentionCount ? " hasMention" : ""}`} tone="unstyled">{unreadCount > 99 ? "99+" : unreadCount}</Badge> : null}
															<span className="dmCloseButton" role="button" tabIndex={0} aria-label={`${text.close} ${label}`} onClick={(event) => { event.stopPropagation(); onCloseRetainedDm(channel.id); }} onKeyDown={(event) => { if (event.key !== "Enter" && event.key !== " ") return; event.preventDefault(); event.stopPropagation(); onCloseRetainedDm(channel.id); }}>×</span>
														</span>
													</span>
												</>
											) : (
												<>
													<span className="channelName">{channel.name}</span>
													<span className="channelMeta">{channel.type}</span>
												</>
											)}
										</Button>
									);
								})
							) : (
								<div className="channelLoading">{text.noRecoverableDm}</div>
							)}
						</nav>
					</section>
				</div>
			) : isDmView ? (
				<div className="channelGroups">
					<section className="channelGroup">
						<div className="channelGroupLabel">{text.privateMessages}</div>
						<nav className="channelList" aria-label={text.privateMessages}>
							{activeChannels.length ? (
								activeChannels.map((channel) => {
									const dmUser = resolveDmChannelUser(channel, workspace, activeBotUserId);
									const label = dmUser ? displayUserName(dmUser) : stripDiscriminator(channel.name);
									const activity = channelActivity[channel.id];
									const unreadCount = activity?.unreadCount ?? 0;
									return (
										<Button variant="unstyled" key={channel.id} className={`channelButton dmChannelButton${channel.id === activeChannel?.id ? " isActive" : ""}`} type="button" onClick={() => onOpenRecoverableThread(dmGuildId, channel.id)}>
											<span className="globalMemberAvatar dmChannelAvatar">
												{dmUser?.avatarUrl ? <img src={dmUser.avatarUrl} alt="" aria-hidden="true" /> : label.slice(0, 1).toUpperCase()}
											</span>
											<span className="channelName dmChannelName">
												<span>{label}</span>
												<span className="dmChannelActions">
													{unreadCount ? <Badge className={`dmUnreadBadge${activity?.mentionCount ? " hasMention" : ""}`} tone="unstyled">{unreadCount > 99 ? "99+" : unreadCount}</Badge> : null}
													<span className="dmCloseButton" role="button" tabIndex={0} aria-label={`${text.close} ${label}`} onClick={(event) => { event.stopPropagation(); onCloseRetainedDm(channel.id); }} onKeyDown={(event) => { if (event.key !== "Enter" && event.key !== " ") return; event.preventDefault(); event.stopPropagation(); onCloseRetainedDm(channel.id); }}>×</span>
												</span>
											</span>
										</Button>
									);
								})
							) : (
								<div className="channelLoading">{text.noOpenDm}</div>
							)}
						</nav>
					</section>
				</div>
			) : (
				<div className="channelGroups">
					<section className="channelGroup">
						<div className="channelGroupLabel">{text.channels}</div>
						<nav className={`channelList${channelDropTarget?.targetId === null ? " isDropAfter" : ""}`} onContextMenu={(event) => onOpenChannelContextMenu(event, null)} onDragOver={(event) => onUpdateChannelDropTarget(event, null)} onDrop={(event) => onFinishChannelDrop(event, null)}>
							{activeBotId && !workspace.guilds.length ? (
								<WorkspaceSkeleton variant="channels" />
							) : activeChannelGroups.length ? (
								activeChannelGroups.map((group) => {
									const collapsed = group.category ? Boolean(collapsedCategories[group.id]) : false;
									return (
										<div key={group.id} className="channelCategoryBlock">
											{group.category ? (
												<Button variant="unstyled" className={`channelCategoryHeader${onChannelDropClass(group.category.id, "before")}${onChannelDropClass(group.category.id, "after")}${onChannelDropClass(group.category.id, "inside")}${channelDragSource?.id === group.category.id ? " isDraggingChannel" : ""}`} type="button" draggable={onChannelDragAllowed(group.category)} aria-expanded={!collapsed} onClick={() => onToggleCategory(group.id)} onContextMenu={(event) => onOpenChannelContextMenu(event, group.category!)} onDragStart={(event) => onBeginChannelDrag(event, group.category!)} onDragOver={(event) => onUpdateChannelDropTarget(event, group.category!)} onDrop={(event) => onFinishChannelDrop(event, group.category!)} onDragEnd={onCancelChannelDrag}>
													<span className={`categoryChevron${collapsed ? " isCollapsed" : ""}`} aria-hidden="true">⌄</span>
													<span>{group.label}</span>
												</Button>
											) : group.label ? (
												<div className="channelCategoryHeader isStatic">{group.label}</div>
											) : null}
											{collapsed ? null : group.channels.map((channel) => {
												if (channel.type === "voice") {
													const voiceMembers = activeVoiceStates.filter((state) => state.channelId === channel.id);
													return (
														<div key={channel.id} className={`voiceChannelBlock${channel.id === activeChannel?.id ? " isActive" : ""}${onChannelDropClass(channel.id, "before")}${onChannelDropClass(channel.id, "after")}${channelDragSource?.id === channel.id ? " isDraggingChannel" : ""}`} draggable={onChannelDragAllowed(channel)} onContextMenu={(event) => onOpenChannelContextMenu(event, channel)} onDragStart={(event) => onBeginChannelDrag(event, channel)} onDragOver={(event) => onUpdateChannelDropTarget(event, channel)} onDrop={(event) => onFinishChannelDrop(event, channel)} onDragEnd={onCancelChannelDrag}>
															<div className="channelButton voiceChannelButton">
																<Button variant="unstyled" className="voiceChannelSelect" type="button" onClick={() => onSelectChannel(channel.id)}>
																	<span className="channelName channelNameWithType"><ChannelTypeIcon type="voice" /><span>{channel.name}</span></span>
																</Button>
																<span className="channelSide"><span className="channelMeta">{voiceMembers.length || channel.memberCount || 0}</span></span>
															</div>
															{voiceMembers.length ? (
																<div className="voiceMemberList">
																	{voiceMembers.map((state) => {
																		const user = workspace.usersById[state.userId];
																		const label = displayUserName(user, state.userId);
																		return <Button variant="unstyled" key={state.userId} className="voiceMemberButton" type="button" onClick={() => onOpenMemberProfile(activeGuildId, state.userId)} onContextMenu={(event) => onOpenMemberContextMenu(event, activeGuildId, state.userId)}><span className="voiceMemberDot" aria-hidden="true" /><span>{label}</span>{state.serverMuted || state.selfMuted ? <small>{text.muted}</small> : null}</Button>;
																	})}
																</div>
															) : null}
														</div>
													);
												}

												const activity = channelActivity[channel.id];
												const unreadCount = activity?.unreadCount ?? channel.unreadCount ?? 0;
												const mentionCount = activity?.mentionCount ?? channel.mentionCount ?? 0;
												const badgeCount = mentionCount || unreadCount;
												const selectedChildPost = selectedForumPost?.forumId === channel.id ? selectedForumPost.post : null;
												const channelIsActive = channel.id === activeChannel?.id || Boolean(selectedChildPost);
												return (
													<div key={channel.id} className={`channelWithThreads${selectedChildPost ? " hasOpenThread" : ""}${onChannelDropClass(channel.id, "before")}${onChannelDropClass(channel.id, "after")}${channelDragSource?.id === channel.id ? " isDraggingChannel" : ""}`} draggable={onChannelDragAllowed(channel)} onContextMenu={(event) => onOpenChannelContextMenu(event, channel)} onDragStart={(event) => onBeginChannelDrag(event, channel)} onDragOver={(event) => onUpdateChannelDropTarget(event, channel)} onDrop={(event) => onFinishChannelDrop(event, channel)} onDragEnd={onCancelChannelDrag}>
														<Button variant="unstyled" className={`channelButton${channelIsActive ? " isActive" : ""}`} type="button" onClick={() => onSelectChannel(channel.id)}>
															<span className="channelName channelNameWithType"><ChannelTypeIcon type={channel.type} /><span>{channel.name}</span></span>
															<span className="channelSide">{syncingChannelId === channel.id ? <span className="miniSpinner" aria-label={text.loadingHistory} /> : null}{badgeCount ? <Badge className={`channelUnread${mentionCount ? " hasMention" : ""}`} tone="unstyled">{badgeCount > 99 ? "99+" : badgeCount}</Badge> : null}</span>
														</Button>
														{selectedChildPost ? (
															<div className="forumThreadChildren"><Button variant="unstyled" type="button" className="forumThreadChildButton isActive" onClick={() => onOpenForumPost(selectedChildPost)}><span className="channelName channelNameWithType"><ChannelTypeIcon type="thread" /><span>{selectedChildPost.name}</span></span></Button></div>
														) : null}
													</div>
												);
											})}
										</div>
									);
								})
							) : activeBotId ? (
								<div className="channelLoading">{text.noCachedChannel}</div>
							) : null}
						</nav>
					</section>
				</div>
			)}
		</section>
	);
}
