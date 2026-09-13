"use client";
import { useLayoutEffect, useRef, type HTMLAttributes } from "react";

// Keep React from replacing DOM nodes under the cursor on each keystroke.
export function CrmTemplateText({ html, onHtmlChange, ...props }: HTMLAttributes<HTMLDivElement> & {
  html: string; onHtmlChange: (html: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const editor = ref.current;
    if (editor && editor.innerHTML !== html && document.activeElement !== editor) editor.innerHTML = html;
  }, [html]);
  return <div {...props} ref={ref} role="textbox" aria-multiline="true" contentEditable suppressContentEditableWarning
    onInput={(event) => onHtmlChange(event.currentTarget.innerHTML)}
    onBlur={(event) => onHtmlChange(event.currentTarget.innerHTML)} />;
}
