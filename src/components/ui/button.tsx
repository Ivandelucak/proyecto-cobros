import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/ui";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg" | "icon";
};

const variants = {
  primary:
    "border-brand-600 bg-brand-600 text-white shadow-brand-700/10 hover:bg-brand-700 active:scale-[0.99]",
  secondary:
    "border-slate-300 bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-100/60 dark:border-neutral-700 dark:bg-neutral-900 dark:text-gray-100 dark:hover:border-neutral-600 dark:hover:bg-neutral-800",
  outline:
    "border-gray-300 bg-transparent text-gray-800 hover:bg-gray-100 dark:border-neutral-700 dark:text-gray-100 dark:hover:bg-neutral-800",
  ghost:
    "border-transparent bg-transparent text-gray-700 shadow-none hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-neutral-800",
  danger:
    "border-red-200 bg-red-50 text-red-700 hover:bg-red-100 active:scale-[0.99] dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200 dark:hover:bg-red-950"
};

const sizes = {
  sm: "min-h-8 px-3 py-1.5 text-xs",
  md: "min-h-10 px-4 py-2 text-sm",
  lg: "min-h-12 px-5 py-2.5 text-base",
  icon: "h-10 w-10 p-0"
};

export function Button({
  className,
  variant = "secondary",
  size = "md",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-md border font-medium shadow-sm transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 dark:focus-visible:ring-offset-neutral-950",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
}
