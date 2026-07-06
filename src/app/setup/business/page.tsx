import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BusinessForm } from "./business-form";
import { BusinessList } from "./business-list";
import { ThemeToggle } from "@/components/theme-toggle";

export const dynamic = "force-dynamic";

export default async function SetupBusinessPage() {
  if (process.env.ENABLE_SETUP_PAGE === "false") {
    notFound();
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
              <BusinessForm />
            </div>
          </section>

          <section className="md:col-span-2">
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-[#273342] dark:bg-[#18212B]">
              <h2 className="mb-4 text-xl font-semibold">Comercios Existentes ({businesses.length})</h2>
              <BusinessList businesses={businesses} />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
