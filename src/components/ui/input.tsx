import {
  forwardRef,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes
} from "react";
import { cn } from "@/lib/ui";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-gray-950 shadow-sm outline-none transition-[background-color,border-color,box-shadow,color] duration-150 placeholder:text-slate-400 hover:border-slate-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500 disabled:shadow-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-gray-50 dark:placeholder:text-neutral-500 dark:hover:border-neutral-600 dark:focus:border-brand-500 dark:focus:ring-brand-900/60 dark:disabled:border-neutral-800 dark:disabled:bg-neutral-900 dark:disabled:text-neutral-500",
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
          "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-gray-950 shadow-sm outline-none transition-[background-color,border-color,box-shadow,color] duration-150 hover:border-slate-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500 disabled:shadow-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-gray-50 dark:hover:border-neutral-600 dark:focus:border-brand-500 dark:focus:ring-brand-900/60 dark:disabled:border-neutral-800 dark:disabled:bg-neutral-900 dark:disabled:text-neutral-500",
          className
        )}
        {...props}
      />
    );
  }
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-gray-950 shadow-sm outline-none transition-[background-color,border-color,box-shadow,color] duration-150 placeholder:text-slate-400 hover:border-slate-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500 disabled:shadow-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-gray-50 dark:placeholder:text-neutral-500 dark:hover:border-neutral-600 dark:focus:border-brand-500 dark:focus:ring-brand-900/60 dark:disabled:border-neutral-800 dark:disabled:bg-neutral-900 dark:disabled:text-neutral-500",
        className
      )}
      {...props}
    />
  );
});
