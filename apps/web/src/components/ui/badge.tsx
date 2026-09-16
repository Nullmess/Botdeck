import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

function joinClassNames(...classNames: Array<string | undefined | false | null>) {
	return classNames.filter(Boolean).join(" ");
}

type BadgeTone = "default" | "muted" | "success" | "danger" | "warning" | "info" | "app" | "command" | "unstyled";
type BadgeSize = "sm" | "md";

const toneClassName: Record<BadgeTone, string> = {
	default: "discordSettingsBadge",
	muted: "discordMutedBadge",
	success: "discordSettingsBadge",
	danger: "discordDangerBadge",
	warning: "statusPill isWarn",
	info: "statusPill isActive",
	app: "appBadge",
	command: "applicationCommandBadge",
	unstyled: ""
};

export type BadgeProps<T extends ElementType> = {
	as?: T;
	children?: ReactNode;
	tone?: BadgeTone;
	size?: BadgeSize;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "children">;

export function Badge<T extends ElementType = "span">({
	as,
	children,
	tone = "default",
	size = "md",
	className,
	...props
}: BadgeProps<T>) {
	const Component = (as ?? "span") as ElementType;
	return (
		<Component className={joinClassNames("uiBadge", `uiBadge--${tone}`, `uiBadge--${size}`, toneClassName[tone], className as string | undefined)} {...props}>
			{children}
		</Component>
	);
}


export function Tag<T extends ElementType = "span">(props: BadgeProps<T>) {
	return <Badge {...props} />;
}

export function Chip<T extends ElementType = "span">(props: BadgeProps<T>) {
	return <Badge {...props} />;
}
