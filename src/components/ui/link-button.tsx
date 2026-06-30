import Link, { type LinkProps } from "next/link";
import type { AnchorHTMLAttributes } from "react";
import { cn } from "@/lib/ui";

type LinkButtonProps = LinkProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & {
    variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive";
    size?: "sm" | "md" | "lg" | "icon";
  };

const variants = {
  primary:
    "btn-primary hover:shadow-md hover:shadow-brand-600/15",
  secondary:
    "btn-secondary hover:shadow-md hover:shadow-slate-300/20 dark:hover:shadow-none",
  outline:
    "border-[color:var(--panel-border)] bg-transparent text-[var(--text-primary)] hover:border-[color:var(--panel-border-strong)] hover:bg-[var(--primary-soft)]",
  ghost:
    "btn-ghost shadow-none",
  destructive:
    "btn-danger hover:shadow-md hover:shadow-[#C94E4E]/10 dark:hover:shadow-none"
};

const sizes = {
  sm: "min-h-8 px-3 py-1.5 text-xs",
  md: "min-h-10 px-4 py-2 text-sm",
  lg: "min-h-12 px-5 py-2.5 text-base",
  icon: "h-10 w-10 p-0"
};

export function LinkButton({
  className,
  variant = "secondary",
  size = "md",
  ...props
}: LinkButtonProps) {
  return (
    <Link
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border font-semibold shadow-sm transition-[background-color,border-color,color,box-shadow,transform] duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#0B1015]",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
}
