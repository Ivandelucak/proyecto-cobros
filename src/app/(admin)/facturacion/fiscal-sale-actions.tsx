"use client";

import { FiscalStatus } from "@prisma/client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { useActionState, useEffect, useRef, useState, startTransition } from "react";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import {
  buildReturnToHref,
  buildSaleDetailHref,
  buildTicketHref
} from "@/lib/return-to";
import {
  cancelFiscalBeforeIssueAction,
  emitFiscalDocumentAction,
  markFiscalNotRequestedAction,
  prepareFiscalDocumentAction,
  type FiscalActionState,
  getSaleForConfirmationModalAction,
  type SaleConfirmationDetails,
  verifyFiscalDocumentInArcaAction,
  getLastAuthorizedVoucherAction,
  type VerificationActionResult
} from "./actions";
import { formatARS } from "@/lib/money";
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
  const [emitState, emitAction, emitting] = useActionState(
    emitFiscalDocumentAction.bind(null, saleId),
    initialState
  );
  const state = prepareState.error || prepareState.success
    ? prepareState
    : notRequestedState.error || notRequestedState.success
      ? notRequestedState
      : cancelState.error || cancelState.success
        ? cancelState
        : emitState;
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerificationActionResult | null>(null);

  const [checkingLastAuth, setCheckingLastAuth] = useState(false);
  const [lastAuthResult, setLastAuthResult] = useState<number | null>(null);
  const [lastAuthError, setLastAuthError] = useState<string | null>(null);

  async function handleVerify() {
    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = await verifyFiscalDocumentInArcaAction(saleId);
      setVerifyResult(res);
    } catch (err) {
      console.error(err);
      setVerifyResult({ error: "Error de red o comunicación." });
    } finally {
      setVerifying(false);
    }
  }

  async function handleGetLastAuth() {
    setCheckingLastAuth(true);
    setLastAuthResult(null);
    setLastAuthError(null);
    try {
      const res = await getLastAuthorizedVoucherAction(saleId);
      if (res.success) {
        setLastAuthResult(res.voucherNumber ?? 0);
      } else {
        setLastAuthError(res.error ?? "Error al obtener el último autorizado.");
      }
    } catch (err) {
      console.error(err);
      setLastAuthError("Error de red o comunicación.");
    } finally {
      setCheckingLastAuth(false);
    }
  }

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

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmDetails, setConfirmDetails] = useState<SaleConfirmationDetails | null>(null);
  const [loadingConfirm, setLoadingConfirm] = useState(false);

  useEffect(() => {
    if (emitState.success) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setConfirmOpen(false);
    }
  }, [emitState.success]);


  async function handleOpenConfirm(e: React.MouseEvent) {
    e.preventDefault();
    setLoadingConfirm(true);
    try {
      const details = await getSaleForConfirmationModalAction(saleId);
      if (details) {
        setConfirmDetails(details);
        setConfirmOpen(true);
      } else {
        alert("No se pudieron cargar los detalles para emitir este comprobante.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingConfirm(false);
    }
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
          {fiscalStatus === FiscalStatus.ISSUED ? (
            <div className="space-y-3 pt-1">
              <Button
                type="button"
                className="w-full"
                variant="primary"
                disabled={verifying}
                onClick={handleVerify}
              >
                {verifying ? "Consultando ARCA..." : "Verificar en ARCA"}
              </Button>

              {/* Muestra de resultados */}
              {verifyResult && verifyResult.success && (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-950/60 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-200 text-xs space-y-1.5">
                  <div className="font-semibold text-sm flex items-center gap-1.5">
                    ✅ Verificación ARCA
                  </div>
                  <div><strong>Estado:</strong> Verificado en ARCA</div>
                  {verifyResult.details && (
                    <>
                      <div><strong>CAE:</strong> {verifyResult.details.cae}</div>
                      {verifyResult.details.caeDueDate && (
                        <div><strong>Vencimiento:</strong> {verifyResult.details.caeDueDate.split("T")[0]}</div>
                      )}
                      <div><strong>Tipo/Número:</strong> Factura C {String(verifyResult.details.pointOfSale).padStart(4, "0")}-{String(verifyResult.details.voucherNumber).padStart(8, "0")}</div>
                      <div><strong>Importe:</strong> ${Number(verifyResult.details.impTotal).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</div>
                    </>
                  )}
                  <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1">
                    Fecha consulta: {new Date().toLocaleString()}
                  </div>
                </div>
              )}

              {verifyResult && !verifyResult.success && verifyResult.diffs && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-950/60 dark:bg-amber-950/20 text-amber-800 dark:text-amber-200 text-xs space-y-2">
                  <div className="font-semibold text-sm flex items-center gap-1.5">
                    ⚠️ Diferencias detectadas
                  </div>
                  <div className="space-y-1">
                    {verifyResult.diffs.map((d, index) => (
                      <div key={index} className="flex justify-between items-center border-b border-amber-100/50 pb-1 last:border-0">
                        <span className="font-medium">{d.field}:</span>
                        <span className={d.match ? "text-emerald-600 font-medium" : "text-rose-600 font-bold"}>
                          {d.match ? (
                            <span>Coincide ({d.local})</span>
                          ) : (
                            <span>Local: {d.local} | ARCA: {d.arca}</span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {verifyResult && (verifyResult.error || (!verifyResult.success && !verifyResult.diffs)) && (
                <div className="rounded-md border border-rose-200 bg-rose-50 p-3 dark:border-rose-950/60 dark:bg-rose-950/20 text-rose-800 dark:text-rose-200 text-xs space-y-2">
                  <div className="font-semibold text-sm flex items-center gap-1.5">
                    ❌ Error al verificar
                  </div>
                  <p>{verifyResult.error ?? verifyResult.message ?? "Ocurrió un error en la consulta."}</p>
                  {verifyResult.technicalError && (
                    <details className="mt-1">
                      <summary className="cursor-pointer font-medium underline text-[11px] text-rose-700 hover:text-rose-900 dark:text-rose-300 dark:hover:text-rose-100 select-none font-sans">
                        Detalle técnico de error
                      </summary>
                      <pre className="mt-1.5 max-h-32 overflow-y-auto rounded bg-black/5 dark:bg-black/20 p-2 font-mono text-[10px] whitespace-pre-wrap break-all text-rose-950 dark:text-rose-300">
                        {verifyResult.technicalError}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              <div className="pt-2 border-t border-gray-100 dark:border-neutral-800 space-y-2">
                <Button
                  type="button"
                  className="w-full text-xs"
                  variant="outline"
                  disabled={checkingLastAuth}
                  onClick={handleGetLastAuth}
                >
                  {checkingLastAuth ? "Consultando último..." : "Consultar último autorizado"}
                </Button>
                {lastAuthResult !== null && (
                  <div className="rounded bg-slate-50 p-2 dark:bg-[#18212B] text-xs text-gray-700 dark:text-[#A9B6C2]">
                    Último número autorizado en ARCA: <strong className="text-gray-900 dark:text-white">{lastAuthResult}</strong>
                  </div>
                )}
                {lastAuthError && (
                  <div className="rounded bg-rose-50 p-2 dark:bg-rose-950/20 text-xs text-rose-700 dark:text-rose-300">
                    {lastAuthError}
                  </div>
                )}
              </div>
            </div>
          ) : null}
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
          {requiresFiscalInvoice && (fiscalStatus === FiscalStatus.READY_TO_ISSUE || fiscalStatus === FiscalStatus.FAILED || fiscalStatus === FiscalStatus.PENDING) ? (
            <Button
              type="button"
              className="w-full"
              variant="primary"
              disabled={emitting || loadingConfirm}
              onClick={handleOpenConfirm}
            >
              {loadingConfirm ? "Cargando..." : emitting ? "Solicitando CAE..." : "Emitir en ARCA (Solicitar CAE)"}
            </Button>
          ) : null}
          <ActionStateMessage state={state} />
        </div>
        <CancelBeforeIssueModal
          open={cancelOpen}
          action={cancelAction}
          cancelling={cancelling}
          state={cancelState}
          onClose={() => setCancelOpen(false)}
        />
        <ConfirmEmissionModal
          open={confirmOpen}
          details={confirmDetails}
          emitting={emitting}
          error={emitState.error}
          technicalError={emitState.technicalError}
          onConfirm={(formData) => {
            startTransition(() => {
              emitAction(formData);
            });
          }}
          onClose={() => setConfirmOpen(false)}
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
          title="Mas acciones"
          aria-expanded={menuOpen}
          onClick={toggleMenu}
          className={`${styles.fiscalMenuButton} inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 shadow-sm transition-[background-color,border-color,color,box-shadow,transform] duration-150 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 hover:shadow-md active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-[#344457] dark:bg-[#18212B] dark:text-[#F3F7FA] dark:hover:border-brand-500/50 dark:hover:bg-brand-500/10`}
        >
          <MoreIcon />
        </button>
      </div>
      {menuOpen && menuPosition ? (
        <div
          ref={menuRef}
          className="fixed z-50 max-h-[260px] w-56 overflow-y-auto rounded-md border border-gray-200 bg-white p-2 text-sm shadow-xl shadow-slate-950/10 dark:border-[#273342] dark:bg-[#121922] dark:shadow-black/30"
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
          {requiresFiscalInvoice && (fiscalStatus === FiscalStatus.READY_TO_ISSUE || fiscalStatus === FiscalStatus.FAILED || fiscalStatus === FiscalStatus.PENDING) ? (
            <MenuButton
              disabled={emitting || loadingConfirm}
              onClick={(e) => {
                setMenuOpen(false);
                handleOpenConfirm(e);
              }}
            >
              {loadingConfirm ? "Cargando..." : emitting ? "Emitiendo..." : "Enviar a facturación"}
            </MenuButton>
          ) : null}
          <div className="mt-2 border-t border-gray-200 pt-2 text-xs text-gray-500 dark:border-[#273342] dark:text-[#7F8D9A]">
            {requiresFiscalInvoice
              ? "Requiere facturación electrónica."
              : "No requiere emisión."}
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
      <ConfirmEmissionModal
        open={confirmOpen}
        details={confirmDetails}
        emitting={emitting}
        error={emitState.error}
        technicalError={emitState.technicalError}
        onConfirm={(formData) => {
          startTransition(() => {
            emitAction(formData);
          });
        }}
        onClose={() => setConfirmOpen(false)}
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
      className="block rounded-md px-3 py-2 font-medium text-gray-700 transition-colors hover:bg-slate-100 hover:text-gray-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-[#A9B6C2] dark:hover:bg-neutral-900 dark:hover:text-white"
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
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) {

  return (
    <button
      type={onClick ? "button" : "submit"}
      disabled={disabled}
      onClick={onClick}
      className={
        danger
          ? "block w-full rounded-md px-3 py-2 text-left text-red-700 hover:bg-red-50 disabled:opacity-60 dark:text-red-200 dark:hover:bg-red-950/40"
          : "block w-full rounded-md px-3 py-2 text-left font-medium text-gray-700 transition-colors hover:bg-slate-100 hover:text-gray-950 disabled:opacity-60 dark:text-[#A9B6C2] dark:hover:bg-neutral-900 dark:hover:text-white"
      }
    >
      {children}
    </button>
  );
}

function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path
        d="M6.5 12h.01M12 12h.01M17.5 12h.01"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="3"
      />
    </svg>
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
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-5 shadow-xl dark:border-[#273342] dark:bg-[#121922]">
        <h2
          id="cancel-before-issue-title"
          className="text-lg font-semibold text-gray-950 dark:text-[#F3F7FA]"
        >
          Anular antes de emitir
        </h2>
        <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-[#A9B6C2]">
          Esta venta todavia no fue emitida fiscalmente. Podes anularla
          internamente y quitarla de la cola de facturacion.
        </p>
        <form action={action} className="mt-4 space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-gray-700 dark:text-[#A9B6C2]">
              Motivo de anulacion
            </span>
            <textarea
              name="reason"
              required
              rows={3}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-950 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-[#344457] dark:bg-[#18212B] dark:text-[#F3F7FA] dark:focus:ring-brand-900"
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
    <div
      className={
        state.error
          ? "rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200"
          : "rounded-md border border-[#BFE3D2] bg-[#E8F6EF] px-2 py-1 text-xs text-[#1F8F63] dark:border-[#28A36A]/55 dark:bg-[#28A36A]/14 dark:text-[#D4F2E1]"
      }
    >
      <div>{state.error ?? state.success}</div>
      {state.error && state.technicalError && (
        <TechnicalErrorDetail error={state.technicalError} />
      )}
    </div>
  );
}

type ConfirmEmissionModalProps = {
  open: boolean;
  details: SaleConfirmationDetails | null;
  emitting: boolean;
  error?: string | null;
  technicalError?: string | null;
  onConfirm: (formData: FormData) => void;
  onClose: () => void;
};

function ConfirmEmissionModal({
  open,
  details,
  emitting,
  error,
  technicalError,
  onConfirm,
  onClose
}: ConfirmEmissionModalProps) {
  if (!open || !details) return null;

  const isHomologacion = details.environment === "HOMOLOGACION";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-emission-title"
    >
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-5 shadow-xl dark:border-[#273342] dark:bg-[#121922]">
        <h2
          id="confirm-emission-title"
          className="text-lg font-semibold text-gray-950 dark:text-[#F3F7FA]"
        >
          Confirmar emisión fiscal
        </h2>
        <div className="mt-4 space-y-2.5 text-sm text-gray-700 dark:text-[#A9B6C2]">
          <div className="flex justify-between border-b border-gray-100 pb-1.5 dark:border-neutral-800">
            <span className="font-medium">Venta:</span>
            <span className="font-semibold text-gray-950 dark:text-[#F3F7FA]">#{details.internalSaleNumber}</span>
          </div>
          <div className="flex justify-between border-b border-gray-100 pb-1.5 dark:border-neutral-800">
            <span className="font-medium">Cliente/Receptor:</span>
            <span className="font-semibold text-gray-950 dark:text-[#F3F7FA]">{details.customerName}</span>
          </div>
          <div className="flex justify-between border-b border-gray-100 pb-1.5 dark:border-neutral-800">
            <span className="font-medium">Tipo de comprobante:</span>
            <span className="font-semibold text-gray-950 dark:text-[#F3F7FA]">{details.voucherTypeLabel}</span>
          </div>
          {details.condicionIVAReceptorLabel && (
            <div className="flex justify-between border-b border-gray-100 pb-1.5 dark:border-neutral-800">
              <span className="font-medium">Condición IVA receptor:</span>
              <span className="font-semibold text-gray-950 dark:text-[#F3F7FA]">{details.condicionIVAReceptorLabel}</span>
            </div>
          )}
          <div className="flex justify-between border-b border-gray-100 pb-1.5 dark:border-neutral-800">
            <span className="font-medium">Punto de venta:</span>
            <span className="font-semibold text-gray-950 dark:text-[#F3F7FA]">{details.pointOfSale ?? "-"}</span>
          </div>
          <div className="flex justify-between border-b border-gray-100 pb-1.5 dark:border-neutral-800">
            <span className="font-medium">Ambiente:</span>
            <span className={`font-semibold ${isHomologacion ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
              {isHomologacion ? "Homologación" : "Producción"}
            </span>
          </div>
          <div className="flex justify-between pt-1 text-base border-t border-gray-200 dark:border-neutral-700">
            <span className="font-bold">Total:</span>
            <span className="font-bold text-gray-950 dark:text-[#F3F7FA]">{formatARS(details.total)}</span>
          </div>
        </div>

        <div className={`mt-5 rounded-md border p-3 text-xs leading-relaxed ${
          isHomologacion
            ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200"
            : "border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-200"
        }`}>
          {isHomologacion ? (
            <span>
              ⚠️ <strong>Esta operación se enviará a ARCA en homologación.</strong> No tiene validez fiscal real.
            </span>
          ) : (
            <span>
              🚨 <strong>Esta operación solicitará CAE real ante ARCA y puede tener validez fiscal.</strong> Revisá los datos antes de continuar.
            </span>
          )}
        </div>

        {error && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200 font-medium">
            <div>❌ {error}</div>
            {technicalError && <TechnicalErrorDetail error={technicalError} />}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            onConfirm(formData);
          }}
          className="mt-5 flex justify-end gap-2"
        >
          <Button type="button" variant="secondary" disabled={emitting} onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={emitting}>
            {emitting ? "Solicitando CAE..." : "Solicitar CAE"}
          </Button>
        </form>
      </div>
    </div>
  );
}

function TechnicalErrorDetail({ error }: { error: string }) {
  const [show, setShow] = useState(false);
  if (!error) return null;
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="text-[11px] font-medium text-slate-500 hover:text-slate-700 underline dark:text-slate-400 dark:hover:text-slate-300"
      >
        {show ? "Ocultar detalle técnico" : "Ver detalle técnico"}
      </button>
      {show && (
        <pre className="mt-1 max-h-40 overflow-y-auto rounded bg-slate-100 p-2 text-[10px] font-mono text-slate-800 dark:bg-slate-900 dark:text-slate-300 whitespace-pre-wrap break-all">
          {error}
        </pre>
      )}
    </div>
  );
}
