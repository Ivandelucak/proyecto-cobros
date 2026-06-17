import { Role, type User } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const AUTH_COOKIE_NAME = "pos_universal_session";

export type AuthSession = {
  userId: string;
  email: string;
  role: Role;
  exp: number;
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export async function validateCredentials(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() }
  });

  if (!user || !user.active) {
    return null;
  }

  const isValid = await verifyPassword(password, user.passwordHash);
  return isValid ? user : null;
}

export function getPostLoginPath(role: Role) {
  return role === Role.ADMIN ? "/admin" : "/caja";
}

export function encodeSession(user: Pick<User, "id" | "email" | "role">) {
  const payload: AuthSession = {
    userId: user.id,
    email: user.email,
    role: user.role,
    exp: Date.now() + 1000 * 60 * 60 * 12
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = signValue(body);

  return `${body}.${signature}`;
}

export function decodeSession(token: string | undefined) {
  try {
    if (!token) {
      return null;
    }

    const [body, signature] = token.split(".");
    if (!body || !signature || !safeEqual(signature, signValue(body))) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as AuthSession;
    if (
      typeof payload.userId !== "string" ||
      typeof payload.email !== "string" ||
      !Object.values(Role).includes(payload.role) ||
      typeof payload.exp !== "number" ||
      payload.exp < Date.now()
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export async function setSessionCookie(user: Pick<User, "id" | "email" | "role">) {
  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, encodeSession(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE_NAME);
}

export async function getSessionFromCookie() {
  const cookieStore = await cookies();
  return decodeSession(cookieStore.get(AUTH_COOKIE_NAME)?.value);
}

export async function getCurrentUser() {
  const session = await getSessionFromCookie();
  if (!session) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true
    }
  });

  if (!user?.active) {
    return null;
  }

  return user;
}

function signValue(value: string) {
  return createHmac("sha256", getAuthSecret()).update(value).digest("base64url");
}

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret === "change-me") {
    return "development-only-change-me";
  }

  return secret;
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}
