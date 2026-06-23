"use client";

import { FiscalStatus } from "@prisma/client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import {
  buildReturnToHref,
  buildSaleDetailHref,
  buildTicketHref
} from "@/lib/return-to";
import {
  cancelFiscalBeforeIssueAction,
  markFiscalNotRequestedAction,
  prepareFiscalDocumentAction,
  type FiscalActionState
} from "./actions";
import styles from "./facturacion-responsive.module.css";

type FiscalSaleActionsProps = {
  saleId: string;
  fiscalStatus: FiscalStatus;
  requiresFiscalInvoice: boolean;
  canPrepare: boolean;
  canMarkNotRequested: boolean;
  canCancelBeforeIssue: boolean;
  mode?: "row" | "panel";
  prepareLabel?: string;
};

const initialState: FiscalActionState = {};

export function FiscalSaleActions({
  saleId,
  fiscalStatus,
  requiresFiscalInvoice,
  canPrepare,
  canMarkNotRequested,
  canCancelBeforeIssue,
  mode = "row",
  prepareLabel = "Preparar"
}: FiscalSaleActionsProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ left: number; top: number } | null>(
    null
  );
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [prepareState, prepareAction, preparing] = useActionState(
    prepareFiscalDocumentAction.bind(null, saleId),
    initialState
  );
  const [notRequestedState, notRequestedAction, marking] = useActionState(
    markFiscalNotRequestedAction.bind(null, saleId),
    initialState
  );
  const [cancelState, cancelAction, cancelling] = useActionState(
    cancelFiscalBeforeIssueAction.bind(null, saleId),
    initialState
  );
  const state = prepareState.error || prepareState.success
    ? prepareState
    : notRequestedState.error || notRequestedState.success
      ? notRequestedState
      : cancelState;
  const returnTo = buildReturnToHref(pathname, searchParams);
  const saleHref = buildSaleDetailHref(saleId, returnTo);
  const ticketHref = buildTicketHref(saleId, returnTo);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (
        menuButtonRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }

      setMenuOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    function closeMenu() {
      setMenuOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", closeMenu);
    window.addEventListener("scroll", closeMenu, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
    };
  }, [menuOpen]);

  function toggleMenu() {
    if (menuOpen) {
      setMenuOpen(false);
      return;
    }

    const rect = menuButtonRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    const menuWidth = 224;
    const menuHeight = 260;
    const top = rect.bottom + 6;
    const openUp = top + menuHeight > window.innerHeight - 8;
    setMenuPosition({
      left: Math.min(window.innerWidth - menuWidth - 8, Math.max(8, rect.right - menuWidth)),
      top: openUp ? Math.max(8, rect.top - menuHeight - 6) : top
    });
    setMenuOpen(true);
  }

  if (mode === "panel") {
    return (
      <>
        <div className="space-y-3">
          <LinkButton href={saleHref} className="w-full">
            Ver venta
          </LinkButton>
          <LinkButton href={ticketHref} className="w-full">
            Ver ticket
          </LinkButton>
          {canPrepare ? (
            <form action={prepareAction}>
              <Button type="submit" className="w-full" disabled={preparing}>
                {preparing ? "Preparando..." : prepareLabel}
              </Button>
            </form>
          ) : null}
          {canMarkNotRequested ? (
            <form action={notRequestedAction}>
              <Button
                type="submit"
                className="w-full"
                variant="secondary"
                disabled={marking}
              >
                Ticket interno
              </Button>
            </form>
          ) : null}
          {canCancelBeforeIssue ? (
            <Button
              type="button"
              className="w-full"
              variant="danger"
              onClick={() => setCancelOpen(true)}
            >
              Anular antes de emitir
            </Button>
          ) : null}
          <Button type="button" className="w-full" disabled>
            Emitir en ARCA - Pendiente de integracion real
          </Button>
          <ActionStateMessage state={state} />
        </div>
        <CancelBeforeIssueModal
          open={cancelOpen}
          action={cancelAction}
          cancelling={cancelling}
          state={cancelState}
          onClose={() => setCancelOpen(false)}
        />
      </>
    );
  }

  return (
    <>
      <div
        className={`${styles.fiscalActionsGroup} inline-flex items-center gap-1.5 whitespace-nowrap`}
      >
        <LinkButton
          href={saleHref}
          size="sm"
          className={`${styles.fiscalActionButton} shrink-0`}
        >
          Ver venta
        </LinkButton>
        <PrimaryRowAction
          saleId={saleId}
          fiscalStatus={fiscalStatus}
          canPrepare={canPrepare}
          prepareAction={prepareAction}
          preparing={preparing}
        />
        <button
          ref={menuButtonRef}
          type="button"
          aria-label="Abrir acciones"
          aria-expanded={menuOpen}
          onClick={toggleMenu}
          className={`${styles.fiscalMenuButton} inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-gray-300 bg-white text-base font-semibold leading-none text-gray-900 shadow-sm transition hover:border-gray-400 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-gray-100 dark:hover:border-neutral-600 dark:hover:bg-neutral-800`}
        >
          ...
        </button>
      </div>
      {menuOpen && menuPosition ? (
        <div
          ref={menuRef}
          className="fixed z-50 max-h-[260px] w-56 overflow-y-auto rounded-md border border-gray-200 bg-white p-2 text-sm shadow-xl dark:border-neutral-800 dark:bg-neutral-950"
          style={{ left: menuPosition.left, top: menuPosition.top }}
        >
          <MenuLink href={`/facturacion/${saleId}`}>Detalle fiscal</MenuLink>
          <MenuLink href={ticketHref}>Ver ticket</MenuLink>
          {canPrepare && fiscalStatus === FiscalStatus.READY_TO_ISSUE ? (
            <form action={prepareAction}>
              <MenuButton disabled={preparing}>
                {preparing ? "Preparando..." : "Regenerar preparacion"}
              </MenuButton>
            </form>
          ) : null}
          {canMarkNotRequested ? (
            <form action={notRequestedAction}>
              <MenuButton disabled={marking}>Marcar ticket interno</MenuButton>
            </form>
          ) : null}
          {canCancelBeforeIssue ? (
            <MenuButton
              danger
              onClick={() => {
                setMenuOpen(false);
                setCancelOpen(true);
              }}
            >
              Anular antes de emitir
            </MenuButton>
          ) : null}
          <div className="mt-2 border-t border-gray-200 pt-2 text-xs text-gray-500 dark:border-neutral-800 dark:text-gray-400">
            {requiresFiscalInvoice
              ? "Emision real pendiente de integracion ARCA."
              : "No requiere emision."}
          </div>
        </div>
      ) : null}
      <CancelBeforeIssueModal
        open={cancelOpen}
        action={cancelAction}
        cancelling={cancelling}
        state={cancelState}
        onClose={() => setCancelOpen(false)}
      />
    </>
  );
}

function PrimaryRowAction({
  saleId,
  fiscalStatus,
  canPrepare,
  prepareAction,
  preparing
}: {
  saleId: string;
  fiscalStatus: FiscalStatus;
  canPrepare: boolean;
  prepareAction: (payload: FormData) => void;
  preparing: boolean;
}) {
  if (fiscalStatus === FiscalStatus.PENDING && canPrepare) {
    return (
      <form action={prepareAction}>
        <Button
          type="submit"
          size="sm"
          className={`${styles.fiscalActionButton} shrink-0`}
          disabled={preparing}
        >
          {preparing ? "Preparando..." : "Preparar"}
        </Button>
      </form>
    );
  }

  if (fiscalStatus === FiscalStatus.FAILED && canPrepare) {
    return (
      <form action={prepareAction}>
        <Button
          type="submit"
          size="sm"
          className={`${styles.fiscalActionButton} shrink-0`}
          disabled={preparing}
        >
          {preparing ? "Reintentando..." : "Reintentar"}
        </Button>
      </form>
    );
  }

  if (fiscalStatus === FiscalStatus.READY_TO_ISSUE) {
    return (
      <LinkButton
        href={`/facturacion/${saleId}`}
        size="sm"
        variant="primary"
        className={`${styles.fiscalActionButton} shrink-0`}
      >
        <span className={styles.fiscalActionFullLabel}>Ver preparacion</span>
        <span className={styles.fiscalActionShortLabel}>Ver prep.</span>
      </LinkButton>
    );
  }

  if (fiscalStatus === FiscalStatus.CREDIT_NOTE_REQUIRED) {
    return (
      <LinkButton
        href={`/facturacion/${saleId}`}
        size="sm"
        variant="outline"
        className={`${styles.fiscalActionButton} shrink-0`}
      >
        Ver caso
      </LinkButton>
    );
  }

  if (fiscalStatus === FiscalStatus.CANCELLED_BEFORE_ISSUE) {
    return (
      <LinkButton
        href={`/facturacion/${saleId}`}
        size="sm"
        variant="outline"
        className={`${styles.fiscalActionButton} shrink-0`}
      >
        Detalle
      </LinkButton>
    );
  }

  return null;
}

function MenuLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="block rounded-md px-3 py-2 text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-neutral-900"
    >
      {children}
    </Link>
  );
}

function MenuButton({
  children,
  danger = false,
  disabled,
  onClick
}: {
  children: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type={onClick ? "button" : "submit"}
      disabled={disabled}
      onClick={onClick}
      className={
        danger
          ? "block w-full rounded-md px-3 py-2 text-left text-red-700 hover:bg-red-50 disabled:opacity-60 dark:text-red-200 dark:hover:bg-red-950/40"
          : "block w-full rounded-md px-3 py-2 text-left text-gray-700 hover:bg-gray-100 disabled:opacity-60 dark:text-gray-200 dark:hover:bg-neutral-900"
      }
    >
      {children}
    </button>
  );
}

function CancelBeforeIssueModal({
  open,
  action,
  cancelling,
  state,
  onClose
}: {
  open: boolean;
  action: (payload: FormData) => void;
  cancelling: boolean;
  state: FiscalActionState;
  onClose: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-before-issue-title"
    >
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-5 shadow-xl dark:border-neutral-800 dark:bg-neutral-950">
        <h2
          id="cancel-before-issue-title"
          className="text-lg font-semibold text-gray-950 dark:text-gray-50"
        >
          Anular antes de emitir
        </h2>
        <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
          Esta venta todavia no fue emitida fiscalmente. Podes anularla
          internamente y quitarla de la cola de facturacion.
        </p>
        <form action={action} className="mt-4 space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
              Motivo de anulacion
            </span>
            <textarea
              name="reason"
              required
              rows={3}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-950 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-gray-50 dark:focus:ring-brand-900"
            />
          </label>
          {state.error ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200">
              {state.error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" variant="danger" disabled={cancelling}>
              {cancelling ? "Anulando..." : "Confirmar anulacion"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ActionStateMessage({ state }: { state: FiscalActionState }) {
  if (!state.error && !state.success) {
    return null;
  }

  return (
    <p
      className={
        state.error
          ? "rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200"
          : "rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-200"
      }
    >
      {state.error ?? state.success}
    </p>
  );
}
