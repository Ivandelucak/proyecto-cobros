import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/ui";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "destructive";
  size?: "sm" | "md" | "lg" | "icon";
};

const variants = {
  primary:
    "border-brand-600 bg-brand-600 text-white shadow-brand-700/15 hover:border-brand-700 hover:bg-brand-700 hover:shadow-md hover:shadow-brand-600/15 active:scale-[0.98] dark:border-brand-500 dark:bg-brand-600 dark:hover:bg-brand-500",
  secondary:
    "border-slate-300 bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-50 hover:shadow-md hover:shadow-slate-300/20 active:scale-[0.98] dark:border-neutral-700 dark:bg-neutral-900 dark:text-gray-100 dark:hover:border-neutral-600 dark:hover:bg-neutral-800 dark:hover:shadow-none",
  outline:
    "border-slate-300 bg-transparent text-slate-800 hover:border-brand-300 hover:bg-brand-50/60 hover:text-brand-800 active:scale-[0.98] dark:border-neutral-700 dark:text-gray-100 dark:hover:border-brand-500/50 dark:hover:bg-brand-500/10 dark:hover:text-brand-100",
  ghost:
    "border-transparent bg-transparent text-slate-700 shadow-none hover:bg-slate-100 hover:text-slate-950 active:scale-[0.98] dark:text-gray-200 dark:hover:bg-neutral-800 dark:hover:text-white",
  danger:
    "border-red-200 bg-red-50 text-red-700 hover:border-red-300 hover:bg-red-100 hover:shadow-md hover:shadow-red-700/10 active:scale-[0.98] dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200 dark:hover:bg-red-950 dark:hover:shadow-none",
  destructive:
    "border-red-200 bg-red-50 text-red-700 hover:border-red-300 hover:bg-red-100 hover:shadow-md hover:shadow-red-700/10 active:scale-[0.98] dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200 dark:hover:bg-red-950 dark:hover:shadow-none"
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
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border font-semibold shadow-sm transition-[background-color,border-color,color,box-shadow,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none disabled:transform-none dark:focus-visible:ring-offset-neutral-950",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
}
