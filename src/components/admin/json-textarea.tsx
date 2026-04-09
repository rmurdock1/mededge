"use client";

import { useState, useCallback } from "react";
import { type z } from "zod";
import { parseJsonField } from "@/lib/admin/schemas";

interface JsonTextareaProps {
  name: string;
  label: string;
  schema: z.ZodType;
  defaultValue?: unknown;
  onChange?: (value: unknown) => void;
  error?: string;
}

export function JsonTextarea({
  name,
  label,
  schema,
  defaultValue,
  onChange,
  error: externalError,
}: JsonTextareaProps) {
  const initialText =
    defaultValue != null ? JSON.stringify(defaultValue, null, 2) : "";
  const [text, setText] = useState(initialText);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleBlur = useCallback(() => {
    if (!text.trim()) {
      setValidationError(null);
      onChange?.(null);
      return;
    }

    const result = parseJsonField(text, schema, name);
    if (result.success) {
      setValidationError(null);
      onChange?.(result.data);
    } else {
      setValidationError(result.error);
    }
  }, [text, schema, name, onChange]);

  const handleFormat = useCallback(() => {
    if (!text.trim()) return;
    try {
      const parsed = JSON.parse(text);
      setText(JSON.stringify(parsed, null, 2));
    } catch {
      // Can't format invalid JSON — the blur handler will show the error
    }
  }, [text]);

  const displayError = externalError || validationError;

  return (
    <div>
      <div className="flex items-center justify-between">
        <label
          htmlFor={name}
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          {label}
        </label>
        <button
          type="button"
          onClick={handleFormat}
          className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          Format JSON
        </button>
      </div>
      <textarea
        id={name}
        name={name}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={handleBlur}
        rows={18}
        className={`mt-1 block w-full rounded-md border px-3 py-2 font-mono text-sm ${
          displayError
            ? "border-red-400 bg-red-50 dark:border-red-600 dark:bg-red-950"
            : "border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900"
        } text-zinc-900 dark:text-zinc-100`}
        spellCheck={false}
      />
      {displayError && (
        <p className="mt-1 whitespace-pre-wrap text-sm text-red-600 dark:text-red-400">
          {displayError}
        </p>
      )}
    </div>
  );
}
