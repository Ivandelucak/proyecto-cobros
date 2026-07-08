import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import Link from "next/link";
import { requireMobileAuth } from "@/lib/admin-auth";
import { getBusinessProfileOrDefault } from "@/lib/business-profile";

export const dynamic = "force-dynamic";

export default async function MobileLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireMobileAuth();
  const businessProfile = await getBusinessProfileOrDefault(user.businessId ?? undefined);

  return (
    <div className="min-h-screen flex flex-col bg-[#0B1015] text-[#F3F7FA] font-sans antialiased pb-20">
      {/* Mobile Top Header */}
      <header className="sticky top-0 z-40 bg-[#121922] border-b border-[#273342] px-4 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2.5">
          {businessProfile.logoUrl ? (
            <img src={businessProfile.logoUrl} alt="Logo" className="w-8 h-8 rounded-md object-cover" />
          ) : (
            <div className="w-8 h-8 rounded-md bg-[#4C7FA3] flex items-center justify-center font-bold text-sm text-[#0B1015]">
              {businessProfile.name.substring(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="font-bold text-sm text-[#F3F7FA] leading-tight truncate max-w-[150px]">
              {businessProfile.name}
            </h1>
            <p className="text-[10px] text-[#A9B6C2] font-semibold uppercase tracking-wider">
              Vista Mobile
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="text-xs bg-[#1D3140] hover:bg-[#3D6887] text-[#4C7FA3] hover:text-[#F3F7FA] px-2.5 py-1.5 rounded font-bold transition-colors"
          >
            Escritorio
          </Link>
          <Link
            href="/caja"
            className="text-xs bg-[#28A36A]/20 hover:bg-[#28A36A]/40 text-[#28A36A] px-2.5 py-1.5 rounded font-bold transition-colors"
          >
            Caja
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-4 max-w-lg mx-auto w-full space-y-5">
        {children}
      </main>

      {/* Bottom Sticky Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#121922] border-t border-[#273342] shadow-lg flex items-center justify-around py-2 px-1">
        <NavLink href="/m" icon="home" label="Inicio" />
        <NavLink href="/m/ventas" icon="sales" label="Ventas" />
        <NavLink href="/m/presupuestos" icon="quote" label="Presups" />
        <NavLink href="/m/productos" icon="box" label="Prods" />
        <NavLink href="/m/stock" icon="stock" label="Stock" />
        <NavLink href="/m/reportes" icon="chart" label="Reportes" />
      </nav>
    </div>
  );
}

function NavLink({ href, icon, label }: { href: string; icon: string; label: string }) {
  const icons: Record<string, React.ReactNode> = {
    home: (
      <svg className="w-5.5 h-5.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
    sales: (
      <svg className="w-5.5 h-5.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 002-2H5a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2z" />
      </svg>
    ),
    quote: (
      <svg className="w-5.5 h-5.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    box: (
      <svg className="w-5.5 h-5.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
    stock: (
      <svg className="w-5.5 h-5.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
      </svg>
    ),
    chart: (
      <svg className="w-5.5 h-5.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 3.055A9.003 9.003 0 1020.945 13H11V3.055z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
      </svg>
    )
  };

  return (
    <Link
      href={href}
      className="flex flex-col items-center justify-center flex-1 text-center py-1 text-[#A9B6C2] active:text-[#4C7FA3] hover:text-[#4C7FA3] transition-colors"
    >
      <div className="mb-0.5">{icons[icon]}</div>
      <span className="text-[10px] font-bold tracking-tight">{label}</span>
    </Link>
  );
}
