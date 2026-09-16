import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

function joinClassNames(...classNames: Array<string | undefined | false | null>) {
	return classNames.filter(Boolean).join(" ");
}

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className, ...props }, ref) {
	return <input ref={ref} className={joinClassNames("uiInput", className)} {...props} />;
});

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ className, ...props }, ref) {
	return <select ref={ref} className={joinClassNames("uiSelect", className)} {...props} />;
});

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ className, ...props }, ref) {
	return <textarea ref={ref} className={joinClassNames("uiTextarea", className)} {...props} />;
});
