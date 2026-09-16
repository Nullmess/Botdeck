import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

function joinClassNames(
  ...classNames: Array<string | undefined | false | null>
) {
  return classNames.filter(Boolean).join(" ");
}

type LayoutGap = "none" | "xs" | "sm" | "md" | "lg" | "xl";
type LayoutAlign = "start" | "center" | "end" | "stretch" | "baseline";
type LayoutJustify = "start" | "center" | "end" | "between" | "around";

type PolymorphicLayoutProps<T extends ElementType> = {
  as?: T;
  children?: ReactNode;
  gap?: LayoutGap;
  align?: LayoutAlign;
  justify?: LayoutJustify;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "children">;

const gapClassName: Record<LayoutGap, string> = {
  none: "uiGap--none",
  xs: "uiGap--xs",
  sm: "uiGap--sm",
  md: "uiGap--md",
  lg: "uiGap--lg",
  xl: "uiGap--xl",
};

const alignClassName: Record<LayoutAlign, string> = {
  start: "uiAlign--start",
  center: "uiAlign--center",
  end: "uiAlign--end",
  stretch: "uiAlign--stretch",
  baseline: "uiAlign--baseline",
};

const justifyClassName: Record<LayoutJustify, string> = {
  start: "uiJustify--start",
  center: "uiJustify--center",
  end: "uiJustify--end",
  between: "uiJustify--between",
  around: "uiJustify--around",
};

export function Stack<T extends ElementType = "div">({
  as,
  children,
  className,
  gap = "md",
  align = "stretch",
  justify = "start",
  ...props
}: PolymorphicLayoutProps<T>) {
  const Component = (as ?? "div") as ElementType;
  return (
    <Component
      className={joinClassNames(
        "uiLayout",
        "uiStack",
        gapClassName[gap],
        alignClassName[align],
        justifyClassName[justify],
        className as string | undefined,
      )}
      {...props}
    >
      {children}
    </Component>
  );
}

export function Inline<T extends ElementType = "div">({
  as,
  children,
  className,
  gap = "sm",
  align = "center",
  justify = "start",
  ...props
}: PolymorphicLayoutProps<T>) {
  const Component = (as ?? "div") as ElementType;
  return (
    <Component
      className={joinClassNames(
        "uiLayout",
        "uiInline",
        gapClassName[gap],
        alignClassName[align],
        justifyClassName[justify],
        className as string | undefined,
      )}
      {...props}
    >
      {children}
    </Component>
  );
}

export function Grid<T extends ElementType = "div">({
  as,
  children,
  className,
  gap = "md",
  align = "stretch",
  justify = "start",
  ...props
}: PolymorphicLayoutProps<T>) {
  const Component = (as ?? "div") as ElementType;
  return (
    <Component
      className={joinClassNames(
        "uiLayout",
        "uiGrid",
        gapClassName[gap],
        alignClassName[align],
        justifyClassName[justify],
        className as string | undefined,
      )}
      {...props}
    >
      {children}
    </Component>
  );
}

export function Split<T extends ElementType = "div">({
  as,
  children,
  className,
  gap = "md",
  align = "center",
  justify = "between",
  ...props
}: PolymorphicLayoutProps<T>) {
  const Component = (as ?? "div") as ElementType;
  return (
    <Component
      className={joinClassNames(
        "uiLayout",
        "uiSplit",
        gapClassName[gap],
        alignClassName[align],
        justifyClassName[justify],
        className as string | undefined,
      )}
      {...props}
    >
      {children}
    </Component>
  );
}
