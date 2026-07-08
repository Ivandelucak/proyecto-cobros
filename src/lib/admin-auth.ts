import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export async function requireAdminPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== Role.OWNER && user.role !== Role.ADMIN) {
    redirect("/caja");
  }

  return user;
}

export async function requireOperationalUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== Role.OWNER && user.role !== Role.ADMIN && user.role !== Role.CASHIER) {
    redirect("/caja");
  }

  return user;
}
