import { redirect } from "next/navigation";
import { AppLogo } from "@/components/brand/AppLogo";
import { ThemeToggle } from "@/components/theme-toggle";
import { getCurrentUser, getPostLoginPath } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect(getPostLoginPath(user.role));
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--app-bg)] px-6 py-10 text-[var(--text-primary)]">
      <section className="w-full max-w-sm">
        <div className="mb-5 flex items-center justify-between">
          <AppLogo />
          <ThemeToggle />
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-[#273342] dark:bg-[#18212B]">
          <h1 className="mb-5 text-xl font-semibold">Ingresar</h1>
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
