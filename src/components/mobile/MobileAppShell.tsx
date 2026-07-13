"use client";

/* eslint-disable @next/next/no-img-element -- User-uploaded logo URLs need a native error fallback. */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MobileIcon, type MobileIconName } from "./MobileIcon";

type MobileAppShellProps = {
  children: React.ReactNode;
  businessName: string;
  logoUrl: string | null;
};

type NavigationItem = {
  href: string;
  label: string;
  icon: MobileIconName;
  active: (pathname: string) => boolean;
};

const moreItems: Array<{ href: string; label: string; icon: MobileIconName }> = [
  { href: "/m/productos", label: "Productos", icon: "box" },
  { href: "/m/categorias", label: "Categorías", icon: "tag" },
  { href: "/m/compras", label: "Compras", icon: "cart" },
  { href: "/m/reportes", label: "Reportes", icon: "chart" },
  { href: "/m/presupuestos", label: "Presupuestos", icon: "quote" },
  { href: "/admin", label: "Ir a escritorio", icon: "desktop" }
];

export function MobileAppShell({ children, businessName, logoUrl }: MobileAppShellProps) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const [imageAvailable, setImageAvailable] = useState(Boolean(logoUrl));
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const initials = getInitials(businessName);

  useEffect(() => {
    if (!moreOpen) return;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    window.setTimeout(() => closeButtonRef.current?.focus(), 0);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [moreOpen]);

  const navigationItems: NavigationItem[] = [
    { href: "/m", label: "Inicio", icon: "home", active: (path) => path === "/m" },
    { href: "/m/ventas", label: "Ventas", icon: "sales", active: (path) => path.startsWith("/m/ventas") },
    { href: "/m/presupuestos/nuevo", label: "Presupuesto", icon: "plus", active: (path) => path.startsWith("/m/presupuestos") },
    { href: "/m/stock", label: "Stock", icon: "stock", active: (path) => path.startsWith("/m/stock") }
  ];
  const isMoreActive = ["/m/productos", "/m/categorias", "/m/compras", "/m/reportes"].some((href) =>
    pathname.startsWith(href)
  );

  return (
    <div className="mobile-app min-h-[100dvh] w-full overflow-x-hidden bg-[#0B1015] font-sans text-[#F3F7FA] antialiased">
      <header className="sticky top-0 z-40 min-h-[68px] border-b border-[#273342] bg-[#121922]/98 px-4 py-3 shadow-[0_6px_18px_rgba(0,0,0,0.22)] backdrop-blur">
        <div className="flex min-h-10 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg border border-[#344657] bg-[#1D3140] text-sm font-black text-[#8CA3B7]">
              {imageAvailable && logoUrl ? (
                <img
                  src={logoUrl}
                  alt=""
                  className="h-full w-full object-contain p-0.5"
                  onError={() => setImageAvailable(false)}
                />
              ) : (
                initials
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-extrabold leading-tight text-[#F3F7FA]">{businessName}</p>
              <p className="mt-0.5 text-xs font-semibold text-[#A9B6C2]">Vista móvil</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/admin"
              aria-label="Ir a escritorio"
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[#344657] bg-[#1D3140] px-2.5 text-xs font-bold text-[#D6E4EE] transition-colors hover:bg-[#263C4F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4C7FA3]"
            >
              <MobileIcon name="desktop" className="h-5 w-5 min-[360px]:mr-1.5" />
              <span className="hidden min-[360px]:inline">Escritorio</span>
            </Link>
            <Link
              href="/caja"
              aria-label="Ir a caja"
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[#2F8B64]/45 bg-[#1F8F63]/15 px-2.5 text-xs font-bold text-[#6ED4A4] transition-colors hover:bg-[#1F8F63]/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28A36A]"
            >
              <MobileIcon name="cash" className="h-5 w-5 min-[360px]:mr-1.5" />
              <span className="hidden min-[360px]:inline">Caja</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="mobile-content mx-auto w-full max-w-none space-y-5 px-4 pb-[calc(6.75rem+env(safe-area-inset-bottom))] pt-5">
        {children}
      </main>

      <nav aria-label="Navegación principal" className="fixed inset-x-0 bottom-0 z-40 border-t border-[#273342] bg-[#121922]/98 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgba(0,0,0,0.25)] backdrop-blur">
        <div className="mx-auto grid w-full max-w-[540px] grid-cols-5 items-end gap-1">
          {navigationItems.slice(0, 2).map((item) => (
            <MobileBottomLink key={item.href} item={item} active={item.active(pathname)} />
          ))}
          <MobileBottomLink item={navigationItems[2]} active={navigationItems[2].active(pathname)} prominent />
          <MobileBottomLink item={navigationItems[3]} active={navigationItems[3].active(pathname)} />
          <button
            type="button"
            aria-label="Abrir más opciones"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen(true)}
            className={bottomItemClassName(isMoreActive)}
          >
            <MobileIcon name="more" className="h-5 w-5" />
            <span>Más</span>
          </button>
        </div>
      </nav>

      {moreOpen ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/55 p-0 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-label="Más opciones">
          <button type="button" className="absolute inset-0 cursor-default" aria-label="Cerrar más opciones" onClick={() => setMoreOpen(false)} />
          <section className="relative w-full rounded-t-2xl border-t border-[#344657] bg-[#121922] px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-16px_36px_rgba(0,0,0,0.38)]">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#4A5968]" aria-hidden="true" />
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-extrabold text-[#F3F7FA]">Más opciones</h2>
              <button ref={closeButtonRef} type="button" onClick={() => setMoreOpen(false)} className="inline-flex h-10 items-center rounded-lg px-3 text-sm font-bold text-[#A9B6C2] hover:bg-[#1D3140] hover:text-[#F3F7FA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4C7FA3]">
                Cerrar
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {moreItems.map((item) => (
                <Link key={item.href} href={item.href} onClick={() => setMoreOpen(false)} className="flex min-h-14 items-center gap-3 rounded-xl border border-[#273342] bg-[#0F151D] px-3 text-sm font-bold text-[#F3F7FA] transition-colors hover:border-[#4C7FA3]/60 hover:bg-[#1D3140] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4C7FA3]">
                  <MobileIcon name={item.icon} className="h-5 w-5 shrink-0 text-[#8CA3B7]" />
                  <span className="truncate">{item.label}</span>
                </Link>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function MobileBottomLink({ item, active, prominent = false }: { item: NavigationItem; active: boolean; prominent?: boolean }) {
  if (prominent) {
    return (
      <Link href={item.href} aria-label="Crear presupuesto" className="-mt-6 flex min-h-[62px] flex-col items-center justify-center rounded-xl border border-[#6B94B2] bg-[#4C7FA3] px-1 text-center text-[#0B1015] shadow-[0_8px_18px_rgba(76,127,163,0.35)] transition-colors hover:bg-[#5C91B8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8CA3B7] focus-visible:ring-offset-2 focus-visible:ring-offset-[#121922]">
        <MobileIcon name="plus" className="h-5 w-5" />
        <span className="mt-0.5 text-[11px] font-black">{item.label}</span>
      </Link>
    );
  }

  return (
    <Link href={item.href} className={bottomItemClassName(active)}>
      <MobileIcon name={item.icon} className="h-5 w-5" />
      <span>{item.label}</span>
    </Link>
  );
}

function bottomItemClassName(active: boolean) {
  return `flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-lg px-1 text-[11px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4C7FA3] ${
    active
      ? "bg-[#1D3140] text-[#8CA3B7]"
      : "text-[#A9B6C2] hover:bg-[#18232E] hover:text-[#F3F7FA]"
  }`;
}

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase() || "FP";
}
