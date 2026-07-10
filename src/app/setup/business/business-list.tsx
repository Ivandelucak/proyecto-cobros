"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  cleanDuplicateCategoriesAction,
  deleteBusinessAction,
  toggleBusinessActiveAction
} from "./actions";

type BusinessWithUsers = {
  id: string;
  name: string;
  active: boolean;
  createdAtLabel: string;
  users: Array<{
    name: string;
    email: string;
    role: string;
  }>;
};

type BusinessListProps = {
  businesses: BusinessWithUsers[];
};

export function BusinessList({ businesses: initialBusinesses }: BusinessListProps) {
  const [businesses, setBusinesses] = useState(initialBusinesses);
  const [statusMsg, setStatusMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [businessToDelete, setBusinessToDelete] =
    useState<BusinessWithUsers | null>(null);
  const [confirmNameInput, setConfirmNameInput] = useState("");

  const handleToggleActive = async (business: BusinessWithUsers) => {
    setPendingId(`${business.id}-toggle`);
    setStatusMsg(null);
    try {
      const result = await toggleBusinessActiveAction(business.id);
      if (result.success) {
        setBusinesses((current) =>
          current.map((item) =>
            item.id === business.id ? { ...item, active: result.active } : item
          )
        );
        setStatusMsg({
          type: "success",
          text: `Comercio "${business.name}" ${
            result.active ? "activado" : "desactivado"
          } con exito.`
        });
      }
    } catch (error) {
      setStatusMsg({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Error al cambiar estado del comercio."
      });
    } finally {
      setPendingId(null);
    }
  };

  const handleCleanDuplicates = async (business: BusinessWithUsers) => {
    setPendingId(`${business.id}-clean`);
    setStatusMsg(null);
    try {
      const result = await cleanDuplicateCategoriesAction(business.id);
      if (result.success) {
        setStatusMsg({
          type: "success",
          text: `Categorias limpiadas con exito en "${business.name}". Se eliminaron ${result.cleanedCount} duplicadas.`
        });
      }
    } catch (error) {
      setStatusMsg({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Error al limpiar duplicados."
      });
    } finally {
      setPendingId(null);
    }
  };

  const openDeleteModal = (business: BusinessWithUsers) => {
    setStatusMsg(null);
    setBusinessToDelete(business);
    setConfirmNameInput("");
    setDeleteConfirmOpen(true);
  };

  const handleDeleteBusiness = async () => {
    if (!businessToDelete) {
      return;
    }

    if (confirmNameInput.trim() !== businessToDelete.name.trim()) {
      setStatusMsg({
        type: "error",
        text: "El nombre de confirmacion no coincide."
      });
      setDeleteConfirmOpen(false);
      return;
    }

    setPendingId(`${businessToDelete.id}-delete`);
    setStatusMsg(null);
    setDeleteConfirmOpen(false);
    try {
      const result = await deleteBusinessAction(
        businessToDelete.id,
        confirmNameInput
      );
      if (result.success) {
        setBusinesses((current) =>
          current.filter((item) => item.id !== businessToDelete.id)
        );
        setStatusMsg({
          type: "success",
          text: `Comercio "${businessToDelete.name}" eliminado definitivamente.`
        });
      }
    } catch (error) {
      setStatusMsg({
        type: "error",
        text:
          error instanceof Error ? error.message : "Error al eliminar el comercio."
      });
    } finally {
      setPendingId(null);
      setBusinessToDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      {statusMsg ? (
        <div
          className={`rounded-md border p-3 text-sm ${
            statusMsg.type === "success"
              ? "border-green-200 bg-green-50 text-green-700 dark:border-green-900/70 dark:bg-green-950/40 dark:text-green-200"
              : "border-red-200 bg-red-50 text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200"
          }`}
        >
          {statusMsg.text}
        </div>
      ) : null}

      <div className="max-h-[700px] space-y-4 overflow-y-auto pr-2">
        {businesses.length === 0 ? (
          <p className="text-sm text-gray-500">No hay comercios registrados aun.</p>
        ) : (
          businesses.map((business, index) => {
            const isInitialBusiness = index === businesses.length - 1;
            return (
              <div
                key={business.id}
                className="space-y-4 rounded-lg border border-gray-100 bg-gray-50 p-5 dark:border-[#273342] dark:bg-[#1f2c39]"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="flex items-center gap-2 text-lg font-semibold">
                      {business.name}
                      {isInitialBusiness ? (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-normal text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                          Inicial
                        </span>
                      ) : null}
                    </h3>
                    <div className="mt-1 space-y-1 text-xs text-gray-500 dark:text-gray-400">
                      <p>
                        ID: <span className="font-mono">{business.id}</span>
                      </p>
                      <p>Creado: {business.createdAtLabel}</p>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      business.active
                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                        : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                    }`}
                  >
                    {business.active ? "Activo" : "Inactivo"}
                  </span>
                </div>

                <div className="border-t border-gray-200 pt-3 dark:border-[#273342]">
                  <h4 className="mb-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300">
                    Usuarios ({business.users.length}):
                  </h4>
                  <ul className="space-y-1.5 text-xs text-gray-600 dark:text-gray-400">
                    {business.users.map((user) => (
                      <li
                        key={user.email}
                        className="flex items-center justify-between rounded border border-gray-100 bg-white p-1.5 dark:border-transparent dark:bg-[#18212B]"
                      >
                        <span>
                          {user.name}{" "}
                          <span className="text-gray-400">({user.email})</span>
                        </span>
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase text-gray-500 dark:bg-gray-700 dark:text-gray-300">
                          {user.role}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex flex-wrap gap-2.5 border-t border-gray-100 pt-2 dark:border-[#273342]">
                  <Button
                    size="sm"
                    variant={business.active ? "outline" : "primary"}
                    disabled={pendingId !== null}
                    onClick={() => handleToggleActive(business)}
                    className="text-xs"
                  >
                    {pendingId === `${business.id}-toggle`
                      ? "Procesando..."
                      : business.active
                        ? "Desactivar"
                        : "Activar"}
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pendingId !== null}
                    onClick={() => handleCleanDuplicates(business)}
                    className="text-xs"
                  >
                    {pendingId === `${business.id}-clean`
                      ? "Limpiando..."
                      : "Limpiar categorias duplicadas"}
                  </Button>

                  {!isInitialBusiness ? (
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={pendingId !== null}
                      onClick={() => openDeleteModal(business)}
                      className="text-xs"
                    >
                      {pendingId === `${business.id}-delete`
                        ? "Eliminando..."
                        : "Eliminar comercio"}
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>

      {deleteConfirmOpen && businessToDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-xl dark:border-[#273342] dark:bg-[#18212B]">
            <h3 className="text-lg font-semibold text-red-600 dark:text-red-400">
              Eliminar comercio definitivamente
            </h3>

            <div className="space-y-2 text-sm text-gray-600 dark:text-[#A9B6C2]">
              <p>
                Esta accion eliminara permanentemente el comercio{" "}
                <strong>{businessToDelete.name}</strong> y todos sus datos asociados.
              </p>
              <ul className="list-disc space-y-1 pl-5 text-xs text-red-500 dark:text-red-400">
                <li>Usuarios, productos y categorias.</li>
                <li>Historial completo de cajas y movimientos.</li>
                <li>Ventas, compras, proveedores e intentos de pago.</li>
                <li>Cuentas Mercado Pago vinculadas.</li>
              </ul>
              <p className="font-semibold text-red-600 dark:text-red-400">
                Esta accion no se puede deshacer.
              </p>
              <p className="pt-2">
                Para confirmar, escribi el nombre exacto del comercio:
              </p>
              <p className="select-all rounded bg-gray-100 p-2 text-center font-mono font-bold dark:bg-gray-800">
                {businessToDelete.name}
              </p>
            </div>

            <Input
              type="text"
              value={confirmNameInput}
              onChange={(event) => setConfirmNameInput(event.target.value)}
              placeholder="Nombre del comercio"
              className="w-full text-center font-bold"
            />

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  setBusinessToDelete(null);
                }}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                disabled={confirmNameInput.trim() !== businessToDelete.name.trim()}
                onClick={handleDeleteBusiness}
              >
                Eliminar definitivamente
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
