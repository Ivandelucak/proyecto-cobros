import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BusinessForm } from "./business-form";
import { BusinessList } from "./business-list";
import { SetupAccessForm } from "./setup-access-form";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  clearSetupAccessAction,
  hasValidSetupAccess
} from "./actions";

export const dynamic = "force-dynamic";

export default async function SetupBusinessPage() {
  if (process.env.ENABLE_SETUP_PAGE === "false") {
    notFound();
  }

  const hasSetupAccess = await hasValidSetupAccess();

  if (!hasSetupAccess) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--app-bg)] px-4 text-[var(--text-primary)]">
        <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-md dark:border-[#273342] dark:bg-[#18212B]">
          <h1 className="mb-2 text-center text-2xl font-bold tracking-tight">
            Setup de Comercios
          </h1>
          <p className="mb-6 text-center text-sm text-gray-500 dark:text-gray-400">
            Se requiere la Clave de Setup/Admin para acceder a este panel.
          </p>
          <SetupAccessForm />
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

  const businessViews = businesses.map((business) => ({
    id: business.id,
    name: business.name,
    active: business.active,
    createdAtLabel: formatSetupDate(business.createdAt),
    users: business.users.map((user) => ({
      email: user.email,
      name: user.name,
      role: user.role
    }))
  }));

  return (
    <main className="min-h-screen bg-[var(--app-bg)] px-6 py-10 text-[var(--text-primary)]">
      <div className="mx-auto max-w-5xl">
        <header className="mb-10 flex items-center justify-between border-b border-gray-200 pb-5 dark:border-[#273342]">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Setup de Comercios</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Creacion y visualizacion de comercios independientes en el sistema.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <form action={clearSetupAccessAction}>
              <button
                type="submit"
                className="btn-secondary h-10 rounded-md px-3 text-sm font-semibold"
              >
                Cerrar setup
              </button>
            </form>
          </div>
        </header>

        <div className="grid gap-8 md:grid-cols-3">
          <section className="md:col-span-1">
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-[#273342] dark:bg-[#18212B]">
              <h2 className="mb-4 text-xl font-semibold">Nuevo Comercio</h2>
              <BusinessForm />
            </div>
          </section>

          <section className="md:col-span-2">
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-[#273342] dark:bg-[#18212B]">
              <h2 className="mb-4 text-xl font-semibold">
                Comercios Existentes ({businessViews.length})
              </h2>
              <BusinessList businesses={businessViews} />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function formatSetupDate(date: Date) {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires"
  }).format(date);
}
