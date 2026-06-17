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
    <main className="flex min-h-screen items-center justify-center bg-gray-100 px-6 py-10 text-gray-950 dark:bg-neutral-950 dark:text-gray-50">
      <section className="w-full max-w-sm">
        <div className="mb-5 flex items-center justify-between">
          <AppLogo />
          <ThemeToggle />
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <h1 className="mb-5 text-xl font-semibold">Ingresar</h1>
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
