import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BusinessForm } from "./business-form";
import { BusinessList } from "./business-list";
import { ThemeToggle } from "@/components/theme-toggle";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ key?: string }>;
}

export default async function SetupBusinessPage({ searchParams }: PageProps) {
  if (process.env.ENABLE_SETUP_PAGE === "false") {
    notFound();
  }

  const resolvedSearchParams = await searchParams;
  const key = typeof resolvedSearchParams?.key === "string" ? resolvedSearchParams.key : "";
  const SETUP_SECRET = process.env.SETUP_ADMIN_KEY || "development-only-change-me";

  if (key !== SETUP_SECRET) {
    return (
      <main className="min-h-screen bg-[var(--app-bg)] flex items-center justify-center px-4 text-[var(--text-primary)]">
        <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-md dark:border-[#273342] dark:bg-[#18212B]">
          <h1 className="text-2xl font-bold tracking-tight mb-2 text-center">Setup de Comercios</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 text-center">
            Se requiere la Clave de Setup/Admin para acceder a este panel.
          </p>
          <form method="GET" action="/setup/business" className="space-y-4">
            <div>
              <label htmlFor="key" className="block text-sm font-medium mb-1">Clave de Setup/Admin</label>
              <input
                id="key"
                name="key"
                type="password"
                required
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800"
                placeholder="Ingresá la clave de setup"
              />
            </div>
            {key && (
              <p className="text-sm text-red-500 text-center">Clave incorrecta.</p>
            )}
            <button
              type="submit"
              className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
            >
              Ingresar
            </button>
          </form>
        </div>
      </main>
    );
  }

  const user = await getCurrentUser();
  if (user) {
    redirect("/");
  }
  const businesses = await prisma.business.findMany({
    include: {
      users: {
        select: {
          email: true,
          name: true,
          role: true
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  return (
    <main className="min-h-screen bg-[var(--app-bg)] px-6 py-10 text-[var(--text-primary)]">
      <div className="mx-auto max-w-5xl">
        <header className="mb-10 flex items-center justify-between border-b border-gray-200 pb-5 dark:border-[#273342]">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Setup de Comercios</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Creación y visualización de comercios independientes en el sistema.
            </p>
          </div>
          <ThemeToggle />
        </header>

        <div className="grid gap-8 md:grid-cols-3">
          <section className="md:col-span-1">
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-[#273342] dark:bg-[#18212B]">
              <h2 className="mb-4 text-xl font-semibold">Nuevo Comercio</h2>
              <BusinessForm setupKey={key} />
            </div>
          </section>

          <section className="md:col-span-2">
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-[#273342] dark:bg-[#18212B]">
              <h2 className="mb-4 text-xl font-semibold">Comercios Existentes ({businesses.length})</h2>
              <BusinessList businesses={businesses} setupKey={key} />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
