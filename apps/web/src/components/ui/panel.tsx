import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

function joinClassNames(...classNames: Array<string | undefined | false | null>) {
	return classNames.filter(Boolean).join(" ");
}

type PolymorphicProps<T extends ElementType> = {
	as?: T;
	children?: ReactNode;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "children">;

export function Panel<T extends ElementType = "section">({ as, className, children, ...props }: PolymorphicProps<T>) {
	const Component = (as ?? "section") as ElementType;
	return (
		<Component className={joinClassNames("uiPanel", className as string | undefined)} {...props}>
			{children}
		</Component>
	);
}

export function Card<T extends ElementType = "article">({ as, className, children, ...props }: PolymorphicProps<T>) {
	const Component = (as ?? "article") as ElementType;
	return (
		<Component className={joinClassNames("uiCard", className as string | undefined)} {...props}>
			{children}
		</Component>
	);
}

export function Section<T extends ElementType = "section">({ as, className, children, ...props }: PolymorphicProps<T>) {
	const Component = (as ?? "section") as ElementType;
	return (
		<Component className={joinClassNames("uiSection", className as string | undefined)} {...props}>
			{children}
		</Component>
	);
}
