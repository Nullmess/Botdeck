import type { ComponentPropsWithoutRef, CSSProperties, ElementType, MouseEvent, ReactNode } from "react";
import { useModalLayer } from "@/components/ui/modal-stack";

function joinClassNames(...classNames: Array<string | undefined | false | null>) {
	return classNames.filter(Boolean).join(" ");
}

type ModalSurfaceElement = "section" | "div" | "aside";

type ModalProps<T extends ModalSurfaceElement = "section"> = {
	as?: T;
	children?: ReactNode;
	backdropClassName?: string;
	surfaceClassName?: string;
	onClose?: () => void;
	closeOnBackdrop?: boolean;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "children" | "className" | "role">;

export function Modal<T extends ModalSurfaceElement = "section">({
	as,
	children,
	backdropClassName,
	surfaceClassName,
	onClose,
	closeOnBackdrop = true,
	onMouseDown,
	style,
	...props
}: ModalProps<T>) {
	const Surface = (as ?? "section") as ElementType;
	const layer = useModalLayer();
	const handleBackdropMouseDown = (event: MouseEvent<HTMLDivElement>) => {
		if (closeOnBackdrop && event.target === event.currentTarget) {
			onClose?.();
		}
	};
	const handleSurfaceMouseDown = (event: MouseEvent) => {
		event.stopPropagation();
		onMouseDown?.(event as never);
	};

	return (
		<div
			className={joinClassNames("uiModalBackdrop", backdropClassName ?? "modalBackdrop")}
			role="presentation"
			onMouseDown={handleBackdropMouseDown}
			style={{ zIndex: layer.backdrop }}
		>
			<Surface
				className={joinClassNames("uiModal", surfaceClassName)}
				role="dialog"
				aria-modal="true"
				onMouseDown={handleSurfaceMouseDown}
				style={{ ...(style as CSSProperties | undefined), zIndex: layer.surface }}
				{...props}
			>
				{children}
			</Surface>
		</div>
	);
}
