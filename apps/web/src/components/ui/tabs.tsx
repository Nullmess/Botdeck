import type { HTMLAttributes, ReactNode } from "react";
import { Button, type ButtonProps } from "./button";

function joinClassNames(...classNames: Array<string | undefined | false | null>) {
	return classNames.filter(Boolean).join(" ");
}

export type TabsProps = HTMLAttributes<HTMLElement> & {
	as?: "div" | "nav";
	children: ReactNode;
};

export function Tabs({ as = "div", className, children, ...props }: TabsProps) {
	const Component = as;
	return (
		<Component className={joinClassNames("uiTabs", className)} role="tablist" {...props}>
			{children}
		</Component>
	);
}

export type TabButtonProps = Omit<ButtonProps, "variant"> & {
	active?: boolean;
	locked?: boolean;
	variant?: ButtonProps["variant"];
};

export function TabButton({ active = false, locked = false, className, children, variant = "unstyled", ...props }: TabButtonProps) {
	return (
		<Button
			variant={variant}
			role="tab"
			aria-selected={active}
			className={joinClassNames("uiTab", active ? "isActive" : null, locked ? "isReadonlyLocked" : null, className)}
			{...props}
		>
			{children}
		</Button>
	);
}
