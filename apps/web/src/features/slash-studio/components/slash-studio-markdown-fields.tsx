"use client";

// Champs Markdown réutilisables du Slash Studio.


import { Input, Textarea } from "../../../components/ui/field";
import { useRef, useState, type RefObject } from "react";
import { i18nText } from "@/features/workspace/core";

import { embedLimitTone } from "./slash-studio-command-runtime";
import { Button } from "../../../components/ui/button";

export function MarkdownTextarea({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <MarkdownField
      label={label}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      maxLength={maxLength}
    />
  );
}

function applyMarkdownToggle(
  value: string,
  selection: { start: number; end: number },
  before: string,
  after = before,
) {
  const start = selection.start;
  const end = selection.end;
  const selected = value.slice(start, end);
  const left = value.slice(0, start);
  const right = value.slice(end);
  if (before === "> " && !after) {
    const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
    const lineEndMatch = value.indexOf("\n", end);
    const lineEnd = lineEndMatch < 0 ? value.length : lineEndMatch;
    const block = value.slice(lineStart, lineEnd);
    const quotedLines = block.split("\n");
    const alreadyQuoted = quotedLines.every((line) => line.startsWith("> "));
    const replacement = quotedLines
      .map((line) => (alreadyQuoted ? line.slice(2) : `> ${line}`))
      .join("\n");
    return {
      value: `${value.slice(0, lineStart)}${replacement}${value.slice(lineEnd)}`,
      start: lineStart,
      end: lineStart + replacement.length,
    };
  }
  if (
    selected.startsWith(before) &&
    selected.endsWith(after) &&
    selected.length >= before.length + after.length
  ) {
    const inner = selected.slice(before.length, selected.length - after.length);
    return {
      value: `${left}${inner}${right}`,
      start,
      end: start + inner.length,
    };
  }
  if (left.endsWith(before) && right.startsWith(after)) {
    return {
      value: `${left.slice(0, -before.length)}${selected}${right.slice(after.length)}`,
      start: start - before.length,
      end: end - before.length,
    };
  }
  return {
    value: `${left}${before}${selected}${after}${right}`,
    start: start + before.length,
    end: start + before.length + selected.length,
  };
}

export function MarkdownVisualField({
  className,
  value,
  maxLength,
  onChange,
  placeholder,
  singleLine = false,
  previewKey: _previewKey,
}: {
  className: string;
  value: string;
  maxLength: number;
  onChange: (value: string) => void;
  placeholder: string;
  singleLine?: boolean;
  previewKey: string;
}) {
  const counterTone = embedLimitTone(value.length, maxLength);
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const [focused, setFocused] = useState(false);
  const [selection, setSelection] = useState<{ start: number; end: number }>({
    start: 0,
    end: 0,
  });
  const hasSelection = selection.end > selection.start;
  const updateSelection = () => {
    const input = ref.current;
    if (!input) return;
    setSelection({
      start: input.selectionStart ?? 0,
      end: input.selectionEnd ?? 0,
    });
  };
  const format = (before: string, after = before) => {
    const input = ref.current;
    if (!input || !hasSelection) return;
    const next = applyMarkdownToggle(value, selection, before, after);
    onChange(next.value.slice(0, maxLength));
    requestAnimationFrame(() => {
      input.focus();
      const safeEnd = Math.max(0, Math.min(next.end, maxLength));
      input.setSelectionRange(safeEnd, safeEnd);
      setSelection({ start: safeEnd, end: safeEnd });
    });
  };
  return (
    <div className="commandMarkdownVisualField">
      {focused && hasSelection ? (
        <MarkdownToolbar onFormat={format} blockEnabled={!singleLine} />
      ) : null}
      {singleLine ? (
        <Input
          ref={ref as RefObject<HTMLInputElement>}
          className={className}
          value={value}
          maxLength={maxLength}
          onFocus={() => {
            setFocused(true);
            updateSelection();
          }}
          onSelect={updateSelection}
          onKeyUp={updateSelection}
          onMouseUp={updateSelection}
          onBlur={() => window.setTimeout(() => setFocused(false), 120)}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
      ) : (
        <Textarea
          ref={ref as RefObject<HTMLTextAreaElement>}
          className={className}
          value={value}
          maxLength={maxLength}
          onFocus={() => {
            setFocused(true);
            updateSelection();
          }}
          onSelect={updateSelection}
          onKeyUp={updateSelection}
          onMouseUp={updateSelection}
          onBlur={() => window.setTimeout(() => setFocused(false), 120)}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
      )}
      <small className={`commandMarkdownVisualCounter${counterTone}`}>
        {value.length}/{maxLength}
      </small>
    </div>
  );
}

// Champ Markdown contrôlé.
export function MarkdownField({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  singleLine = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  singleLine?: boolean;
}) {
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const [selection, setSelection] = useState<{
    start: number;
    end: number;
  } | null>(null);
  const hasSelection = selection ? selection.end > selection.start : false;
  const updateSelection = () => {
    const input = ref.current;
    if (!input) return;
    setSelection({
      start: input.selectionStart ?? 0,
      end: input.selectionEnd ?? 0,
    });
  };
  const wrapSelection = (before: string, after = before) => {
    const input = ref.current;
    if (!input || !hasSelection || !selection) return;
    const start = selection.start;
    const end = selection.end;
    const next = applyMarkdownToggle(value, { start, end }, before, after);
    onChange(next.value);
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(next.end, next.end);
      setSelection(null);
    });
  };
  return (
    <label
      className={
        singleLine
          ? "commandMarkdownField"
          : "commandFlowTextarea commandMarkdownField"
      }
    >
      <span>
        {label}
        {maxLength ? (
          <small className={embedLimitTone(value.length, maxLength)}>
            {value.length}/{maxLength}
          </small>
        ) : null}
      </span>
      {hasSelection ? (
        <MarkdownToolbar onFormat={wrapSelection} blockEnabled={!singleLine} />
      ) : null}
      {singleLine ? (
        <Input
          ref={ref as RefObject<HTMLInputElement>}
          value={value}
          maxLength={maxLength}
          onSelect={updateSelection}
          onKeyUp={updateSelection}
          onMouseUp={updateSelection}
          onBlur={() => window.setTimeout(() => setSelection(null), 120)}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
      ) : (
        <Textarea
          ref={ref as RefObject<HTMLTextAreaElement>}
          value={value}
          maxLength={maxLength}
          onSelect={updateSelection}
          onKeyUp={updateSelection}
          onMouseUp={updateSelection}
          onBlur={() => window.setTimeout(() => setSelection(null), 120)}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
      )}
    </label>
  );
}

// Barre d’outils Markdown.
export function MarkdownToolbar({
  onFormat,
  blockEnabled,
}: {
  onFormat: (before: string, after?: string) => void;
  blockEnabled: boolean;
}) {
  return (
    <div
      className="commandMarkdownToolbar"
      onMouseDown={(event) => event.preventDefault()}
    >
      <Button variant="unstyled" type="button" onClick={() => onFormat("**")}>
        B
      </Button>
      <Button variant="unstyled" type="button" onClick={() => onFormat("*")}>
        I
      </Button>
      <Button variant="unstyled" type="button" onClick={() => onFormat("__")}>
        U
      </Button>
      <Button variant="unstyled" type="button" onClick={() => onFormat("~~")}>
        S
      </Button>
      <Button variant="unstyled" type="button" onClick={() => onFormat("||")}>
        {i18nText("Spoiler")}
      </Button>
      <Button variant="unstyled" type="button" onClick={() => onFormat("`")}>
        {i18nText("Code")}
      </Button>
      {blockEnabled ? (
        <Button variant="unstyled" type="button" onClick={() => onFormat("```\\n", "\\n```")}>
          {i18nText("Bloc")}
        </Button>
      ) : null}
      <Button variant="unstyled" type="button" onClick={() => onFormat("> ", "")}>
        {i18nText("Citation")}
      </Button>
    </div>
  );
}

