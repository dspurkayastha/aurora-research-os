"use client";

import { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { clsx } from "clsx";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export function Input({ label, error, helperText, className = "", ...props }: InputProps) {
  return (
    <div className="w-full space-y-2">
      {label && (
        <label className="block text-sm font-semibold text-neutral-700">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          className={clsx(
            "w-full rounded-xl border-2 px-4 py-3 text-sm transition-all duration-300",
            "focus:outline-none focus:ring-2 focus:ring-offset-2",
            "backdrop-blur-sm",
            error
              ? clsx(
                  "border-red-400/60 bg-red-50/80",
                  "focus:border-red-500 focus:ring-red-500",
                  "focus:shadow-[0_0_20px_rgba(239,68,68,0.2)]"
                )
              : clsx(
                  "border-neutral-300/60 bg-white/90",
                  "hover:border-indigo-400/60 hover:bg-white",
                  "focus:border-indigo-500 focus:ring-indigo-500",
                  "focus:shadow-[0_0_20px_rgba(99,102,241,0.2),0_0_0_3px_rgba(99,102,241,0.1)]",
                  "hover:shadow-[0_2px_8px_0_rgba(99,102,241,0.1)]"
                ),
            className
          )}
          {...props}
        />
      </div>
      {error && (
        <p className="text-xs font-medium text-red-600 flex items-start gap-1.5 mt-1">
          <span className="flex-shrink-0">⚠</span>
          <span className="break-words">{error}</span>
        </p>
      )}
      {helperText && !error && (
        <p className="text-xs text-neutral-500 mt-1 leading-relaxed">{helperText}</p>
      )}
    </div>
  );
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export function Textarea({ label, error, helperText, className = "", ...props }: TextareaProps) {
  return (
    <div className="w-full space-y-2">
      {label && (
        <label className="block text-sm font-semibold text-neutral-700">
          {label}
        </label>
      )}
      <div className="relative">
        <textarea
          className={clsx(
            "w-full rounded-xl border-2 px-4 py-3 text-sm transition-all duration-300 resize-y",
            "focus:outline-none focus:ring-2 focus:ring-offset-2",
            "backdrop-blur-sm",
            "min-h-[120px]",
            error
              ? clsx(
                  "border-red-400/60 bg-red-50/80",
                  "focus:border-red-500 focus:ring-red-500",
                  "focus:shadow-[0_0_20px_rgba(239,68,68,0.2)]"
                )
              : clsx(
                  "border-neutral-300/60 bg-white/90",
                  "hover:border-indigo-400/60 hover:bg-white",
                  "focus:border-indigo-500 focus:ring-indigo-500",
                  "focus:shadow-[0_0_20px_rgba(99,102,241,0.2),0_0_0_3px_rgba(99,102,241,0.1)]",
                  "hover:shadow-[0_2px_8px_0_rgba(99,102,241,0.1)]"
                ),
            className
          )}
          {...props}
        />
      </div>
      {error && (
        <p className="text-xs font-medium text-red-600 flex items-start gap-1.5 mt-1">
          <span className="flex-shrink-0">⚠</span>
          <span className="break-words">{error}</span>
        </p>
      )}
      {helperText && !error && (
        <p className="text-xs text-neutral-500 mt-1 leading-relaxed">{helperText}</p>
      )}
    </div>
  );
}

