import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "danger" | "icon" | "ghost" | "unstyled";
type ButtonSize = "sm" | "md" | "lg";

const variantClassName: Record<ButtonVariant, string> = {
	primary: "sendButton",
	secondary: "secondaryButton",
	danger: "dangerButton",
	icon: "iconButton",
	ghost: "secondaryButton",
	unstyled: ""
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
	variant?: ButtonVariant;
	size?: ButtonSize;
	isLoading?: boolean;
	children?: ReactNode;
};

export function Button({
	variant = "primary",
	size = "md",
	isLoading = false,
	className,
	disabled,
	children,
	...props
}: ButtonProps) {
	const classes = [
		"uiButton",
		`uiButton--${variant}`,
		`uiButton--${size}`,
		variantClassName[variant],
		isLoading ? "isLoading" : null,
		className
	]
		.filter(Boolean)
		.join(" ");

	return (
		<button className={classes} disabled={disabled || isLoading} aria-busy={isLoading || props["aria-busy"]} {...props}>
			{isLoading ? <span className="modalSpinner buttonSpinner" aria-hidden="true" /> : null}
			{children}
		</button>
	);
}
