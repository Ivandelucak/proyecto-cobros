import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/ui";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "destructive";
  size?: "sm" | "md" | "lg" | "icon";
};

const variants = {
  primary:
    "btn-primary shadow-[0_10px_24px_rgba(46,91,122,0.22)] hover:shadow-[0_14px_30px_rgba(46,91,122,0.28)] active:scale-[0.97]",
  secondary:
    "btn-secondary hover:shadow-md hover:shadow-slate-300/20 active:scale-[0.98] dark:hover:shadow-none",
  outline:
    "border-[color:var(--panel-border)] bg-transparent text-[var(--text-primary)] hover:border-[color:var(--panel-border-strong)] hover:bg-[var(--primary-soft)] hover:text-[var(--text-primary)] active:scale-[0.98]",
  ghost:
    "btn-ghost shadow-none active:scale-[0.98]",
  danger:
    "btn-danger hover:shadow-md hover:shadow-[#C94E4E]/10 active:scale-[0.98] dark:hover:shadow-none",
  destructive:
    "btn-danger hover:shadow-md hover:shadow-[#C94E4E]/10 active:scale-[0.98] dark:hover:shadow-none"
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
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border font-semibold shadow-sm transition-[background-color,border-color,color,box-shadow,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-65 disabled:shadow-none disabled:transform-none dark:focus-visible:ring-offset-[#0B1015]",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
}
