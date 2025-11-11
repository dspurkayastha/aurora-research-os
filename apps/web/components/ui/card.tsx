"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";
import { clsx } from "clsx";

interface CardProps {
  children: ReactNode;
  className?: string;
  variant?: "default" | "highlighted" | "completed";
  onClick?: () => void;
}

export function Card({ children, className = "", variant = "default", onClick }: CardProps) {
  const baseClasses = clsx(
    "rounded-xl border-2 p-6 transition-all duration-300",
    onClick && "cursor-pointer"
  );
  
  const variantClasses = {
    default: clsx(
      "border-neutral-200/50 bg-white/60 backdrop-blur-md",
      "shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-1px_rgba(0,0,0,0.06)]",
      "hover:border-indigo-300/70 hover:bg-white/70",
      "hover:shadow-[0_10px_15px_-3px_rgba(99,102,241,0.1),0_4px_6px_-2px_rgba(99,102,241,0.05),0_0_20px_rgba(99,102,241,0.1)]"
    ),
    highlighted: clsx(
      "border-indigo-400/60 bg-gradient-to-br from-indigo-50/70 via-purple-50/70 to-pink-50/70 backdrop-blur-md",
      "shadow-[0_4px_6px_-1px_rgba(99,102,241,0.2),0_2px_4px_-1px_rgba(99,102,241,0.1),0_0_30px_rgba(99,102,241,0.15)]",
      "hover:border-indigo-500/80 hover:from-indigo-50/80 hover:via-purple-50/80 hover:to-pink-50/80",
      "hover:shadow-[0_10px_15px_-3px_rgba(99,102,241,0.3),0_4px_6px_-2px_rgba(99,102,241,0.2),0_0_40px_rgba(99,102,241,0.25)]"
    ),
    completed: clsx(
      "border-emerald-400/60 bg-gradient-to-br from-emerald-50/70 via-teal-50/70 to-cyan-50/70 backdrop-blur-md",
      "shadow-[0_4px_6px_-1px_rgba(16,185,129,0.2),0_2px_4px_-1px_rgba(16,185,129,0.1),0_0_30px_rgba(16,185,129,0.15)]",
      "hover:border-emerald-500/80 hover:from-emerald-50/80 hover:via-teal-50/80 hover:to-cyan-50/80",
      "hover:shadow-[0_10px_15px_-3px_rgba(16,185,129,0.3),0_4px_6px_-2px_rgba(16,185,129,0.2),0_0_40px_rgba(16,185,129,0.25)]"
    ),
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={onClick ? { scale: 1.01, y: -2 } : {}}
      className={clsx(baseClasses, variantClasses[variant], className)}
      onClick={onClick}
    >
      {children}
    </motion.div>
  );
}

