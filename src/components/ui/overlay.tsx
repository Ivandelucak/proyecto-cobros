"use client";

import { useEffect, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/ui";

type AppDrawerProps = {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  className?: string;
  panelClassName?: string;
};

export function AppDrawer({
  open,
  title,
  description,
  children,
  footer,
  onClose,
  className,
  panelClassName
}: AppDrawerProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex justify-end bg-black/50 p-2 backdrop-blur-sm sm:p-3",
        className
      )}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Cerrar"
        onClick={onClose}
      />
      <div
        className={cn(
          "app-panel relative flex h-full w-full max-w-[min(100vw-1rem,600px)] flex-col overflow-hidden rounded-xl shadow-2xl dark:shadow-black/40",
          panelClassName
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[color:var(--panel-border)] px-4 py-3 sm:px-5 sm:py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold text-[var(--text-primary)]">
              {title}
            </h2>
            {description ? (
              <p className="mt-1 text-sm leading-5 text-[var(--text-secondary)]">
                {description}
              </p>
            ) : null}
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cerrar
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5 sm:py-4">
          {children}
        </div>
        {footer ? (
          <div className="border-t border-[color:var(--panel-border)] px-4 py-3 sm:px-5">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

type AppModalProps = {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  className?: string;
  panelClassName?: string;
};

export function AppModal({
  open,
  title,
  description,
  children,
  footer,
  onClose,
  className,
  panelClassName
}: AppModalProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm",
        className
      )}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Cerrar"
        onClick={onClose}
      />
      <div
        className={cn(
          "app-panel relative flex max-h-[calc(100vh-1.5rem)] w-full max-w-[min(100vw-1.5rem,820px)] flex-col overflow-hidden rounded-xl shadow-2xl dark:shadow-black/40",
          panelClassName
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[color:var(--panel-border)] px-4 py-3 sm:px-5 sm:py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold text-[var(--text-primary)]">
              {title}
            </h2>
            {description ? (
              <p className="mt-1 text-sm leading-5 text-[var(--text-secondary)]">
                {description}
              </p>
            ) : null}
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cerrar
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5 sm:py-4">
          {children}
        </div>
        {footer ? (
          <div className="border-t border-[color:var(--panel-border)] px-4 py-3 sm:px-5">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

type AppAccordionProps = {
  title: string;
  children: ReactNode;
  className?: string;
  defaultOpen?: boolean;
};

export function AppAccordion({
  title,
  children,
  className,
  defaultOpen = false
}: AppAccordionProps) {
  return (
    <details
      className={cn(
        "rounded-lg border border-[color:var(--panel-border)] bg-[var(--panel-bg-secondary)] px-3 py-2 text-xs",
        className
      )}
      open={defaultOpen}
    >
      <summary className="cursor-pointer list-none font-semibold text-[var(--text-primary)]">
        {title}
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}
