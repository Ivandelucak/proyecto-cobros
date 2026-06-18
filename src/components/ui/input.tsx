import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/ui";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-950 shadow-sm outline-none transition duration-150 placeholder:text-gray-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:border-gray-300 disabled:bg-gray-100 disabled:text-gray-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-gray-50 dark:placeholder:text-gray-500 dark:focus:border-brand-500 dark:focus:ring-brand-900/60 dark:disabled:bg-neutral-900 dark:disabled:text-gray-400",
          className
        )}
        {...props}
      />
    );
  }
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={cn(
          "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-950 shadow-sm outline-none transition duration-150 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:border-gray-300 disabled:bg-gray-100 disabled:text-gray-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-gray-50 dark:focus:border-brand-500 dark:focus:ring-brand-900/60 dark:disabled:bg-neutral-900 dark:disabled:text-gray-400",
          className
        )}
        {...props}
      />
    );
  }
);
