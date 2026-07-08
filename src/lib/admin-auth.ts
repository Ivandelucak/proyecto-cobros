import { Role } from "@prisma/client";
import { headers } from "next/headers";
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

export async function isMobileDevice() {
  const headersList = await headers();
  const userAgent = headersList.get("user-agent") || "";
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Labs|Opera Mini/i.test(userAgent);
}

export async function requireMobileAuth() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== Role.OWNER && user.role !== Role.ADMIN) {
    redirect("/caja");
  }

  if (!user.businessId) {
    throw new Error("El usuario no está asociado a un comercio.");
  }

  return user;
}
