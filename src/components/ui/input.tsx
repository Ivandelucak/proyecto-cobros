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
          "input-base w-full rounded-md px-3 py-2 text-sm shadow-sm outline-none transition-[background-color,border-color,box-shadow,color] duration-150 hover:border-[color:var(--panel-border-strong)] focus:border-[color:var(--primary)] focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:shadow-none dark:focus:border-[#4C7FA3] dark:focus:ring-[#4C7FA3]/25",
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
          "select-base w-full rounded-md px-3 py-2 text-sm shadow-sm outline-none transition-[background-color,border-color,box-shadow,color] duration-150 hover:border-[color:var(--panel-border-strong)] focus:border-[color:var(--primary)] focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:shadow-none dark:focus:border-[#4C7FA3] dark:focus:ring-[#4C7FA3]/25",
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
        "input-base w-full rounded-md px-3 py-2 text-sm shadow-sm outline-none transition-[background-color,border-color,box-shadow,color] duration-150 hover:border-[color:var(--panel-border-strong)] focus:border-[color:var(--primary)] focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:shadow-none dark:focus:border-[#4C7FA3] dark:focus:ring-[#4C7FA3]/25",
        className
      )}
      {...props}
    />
  );
});
