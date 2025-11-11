"use client";

import { motion } from "framer-motion";
import { ReactNode, ButtonHTMLAttributes } from "react";
import { clsx } from "clsx";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  isLoading = false,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  const baseClasses = clsx(
    "font-semibold rounded-xl transition-all duration-300",
    "focus:outline-none focus:ring-2 focus:ring-offset-2",
    "relative overflow-hidden",
    "flex items-center justify-center gap-2",
    "whitespace-nowrap"
  );
  
  const variantClasses = {
    primary: clsx(
      "bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600",
      "text-white",
      "shadow-[0_4px_14px_0_rgba(99,102,241,0.4),0_0_20px_rgba(99,102,241,0.2)]",
      "hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500",
      "hover:shadow-[0_6px_20px_0_rgba(99,102,241,0.5),0_0_30px_rgba(99,102,241,0.3)]",
      "focus:ring-indigo-500",
      "active:scale-[0.98]",
      "before:absolute before:inset-0 before:bg-gradient-to-r before:from-white/20 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300"
    ),
    secondary: clsx(
      "bg-gradient-to-r from-slate-600 via-slate-700 to-slate-800",
      "text-white",
      "shadow-[0_4px_14px_0_rgba(71,85,105,0.3)]",
      "hover:from-slate-500 hover:via-slate-600 hover:to-slate-700",
      "hover:shadow-[0_6px_20px_0_rgba(71,85,105,0.4)]",
      "focus:ring-slate-500",
      "active:scale-[0.98]"
    ),
    outline: clsx(
      "border-2 border-indigo-500/60",
      "bg-white/80 backdrop-blur-sm",
      "text-indigo-600",
      "shadow-[0_2px_8px_0_rgba(99,102,241,0.1)]",
      "hover:border-indigo-600 hover:bg-indigo-50/90",
      "hover:shadow-[0_4px_12px_0_rgba(99,102,241,0.2),0_0_20px_rgba(99,102,241,0.15)]",
      "focus:ring-indigo-500",
      "active:scale-[0.98]"
    ),
    ghost: clsx(
      "text-indigo-600",
      "hover:bg-indigo-50/80",
      "hover:shadow-[0_2px_8px_0_rgba(99,102,241,0.1)]",
      "focus:ring-indigo-500",
      "active:scale-[0.98]"
    ),
  };

  const sizeClasses = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-5 py-2.5 text-sm",
    lg: "px-7 py-3.5 text-base",
  };

  const isDisabled = disabled || isLoading;

  return (
    <motion.button
      whileHover={!isDisabled ? { scale: 1.02, y: -1 } : {}}
      whileTap={!isDisabled ? { scale: 0.98 } : {}}
      disabled={isDisabled}
      className={clsx(
        baseClasses,
        variantClasses[variant],
        sizeClasses[size],
        isDisabled && "opacity-50 cursor-not-allowed grayscale",
        className
      )}
      {...props}
    >
      {isLoading ? (
        <>
          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Loading...</span>
        </>
      ) : (
        children
      )}
    </motion.button>
  );
}

