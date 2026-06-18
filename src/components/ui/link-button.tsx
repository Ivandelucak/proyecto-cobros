import Link, { type LinkProps } from "next/link";
import type { AnchorHTMLAttributes } from "react";
import { cn } from "@/lib/ui";

type LinkButtonProps = LinkProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & {
    variant?: "primary" | "secondary" | "outline" | "ghost";
    size?: "sm" | "md" | "lg" | "icon";
  };

const variants = {
  primary: "border-brand-600 bg-brand-600 text-white hover:bg-brand-700",
  secondary:
    "border-gray-300 bg-white text-gray-900 hover:border-gray-400 hover:bg-gray-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-gray-100 dark:hover:border-neutral-600 dark:hover:bg-neutral-800",
  outline:
    "border-gray-300 bg-transparent text-gray-800 hover:bg-gray-100 dark:border-neutral-700 dark:text-gray-100 dark:hover:bg-neutral-800",
  ghost:
    "border-transparent bg-transparent text-gray-700 shadow-none hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-neutral-800"
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
        "inline-flex items-center justify-center rounded-md border font-medium shadow-sm transition duration-150 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-950",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
}
