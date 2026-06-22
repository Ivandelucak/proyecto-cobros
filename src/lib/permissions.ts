import { Role } from "@prisma/client";

export const ADMIN_ROUTES = [
  "/admin",
  "/productos",
  "/productos/importar",
  "/categorias",
  "/stock",
  "/ventas",
  "/facturacion",
  "/reportes",
  "/configuracion"
];

export function canAccessAdmin(role: Role) {
  return role === Role.ADMIN;
}

export function isAdminRoute(pathname: string) {
  return ADMIN_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

export function canAccessCashRegister(role: Role) {
  return role === Role.ADMIN || role === Role.CASHIER;
}

export function canManageProducts(role: Role) {
  return role === Role.ADMIN;
}

export function canManageStock(role: Role) {
  return role === Role.ADMIN;
}

export function canImportExportProducts(role: Role) {
  return role === Role.ADMIN;
}

export function canViewReports(role: Role) {
  return role === Role.ADMIN;
}

export function assertRole(role: Role, allowedRoles: Role[], action = "esta accion") {
  if (!allowedRoles.includes(role)) {
    throw new Error(`No autorizado para ${action}.`);
  }
}
