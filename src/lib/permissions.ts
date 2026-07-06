import { Role } from "@prisma/client";

export const ADMIN_ROUTES = [
  "/admin",
  "/auditoria",
  "/categorias",
  "/clientes",
  "/compras",
  "/configuracion",
  "/facturacion",
  "/productos",
  "/productos/importar",
  "/proveedores",
  "/reportes",
  "/stock",
  "/ventas",
  "/usuarios"
];

export function canAccessAdmin(role: Role) {
  return role === Role.ADMIN || role === Role.OWNER;
}

export function isAdminRoute(pathname: string) {
  return ADMIN_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

export function canAccessCashRegister(role: Role) {
  return role === Role.ADMIN || role === Role.CASHIER || role === Role.OWNER;
}

export function canManageProducts(role: Role) {
  return role === Role.ADMIN || role === Role.OWNER;
}

export function canManageStock(role: Role) {
  return role === Role.ADMIN || role === Role.OWNER;
}

export function canImportExportProducts(role: Role) {
  return role === Role.ADMIN || role === Role.OWNER;
}

export function canViewReports(role: Role) {
  return role === Role.ADMIN || role === Role.OWNER;
}

export function assertRole(role: Role, allowedRoles: Role[], action = "esta accion") {
  if (!allowedRoles.includes(role)) {
    throw new Error(`No autorizado para ${action}.`);
  }
}
