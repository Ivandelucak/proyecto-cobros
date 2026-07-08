"use server";

import { redirect } from "next/navigation";
import {
  clearSessionCookie,
  getPostLoginPath,
  setSessionCookie,
  validateCredentials
} from "@/lib/auth";

export type LoginFormState = {
  error?: string;
};

export async function loginAction(
  _prevState: LoginFormState,
  formData: FormData
): Promise<LoginFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Ingresá email y contraseña." };
  }

  const user = await validateCredentials(email, password);
  if (!user) {
    return { error: "Credenciales inválidas." };
  }

  if (!user.businessId) {
    return { error: "El usuario no está asociado a un comercio. Contactá al administrador." };
  }

  await setSessionCookie(user);
  redirect(getPostLoginPath(user.role));
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/login");
}
