"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  toggleBusinessActiveAction, 
  cleanDuplicateCategoriesAction, 
  deleteBusinessAction 
} from "./actions";

type BusinessWithUsers = {
  id: string;
  name: string;
  active: boolean;
  createdAt: Date;
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
  const [setupKey, setSetupKey] = useState("");
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  
  // Delete modal state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [businessToDelete, setBusinessToDelete] = useState<BusinessWithUsers | null>(null);
  const [confirmNameInput, setConfirmNameInput] = useState("");

  const handleToggleActive = async (b: BusinessWithUsers) => {
    if (!setupKey) {
      setStatusMsg({ type: "error", text: "Por favor, ingresá la Clave de Setup al inicio del panel." });
      return;
    }
    setPendingId(b.id + "-toggle");
    setStatusMsg(null);
    try {
      const res = await toggleBusinessActiveAction(b.id, setupKey);
      if (res.success) {
        setBusinesses(prev => prev.map(item => item.id === b.id ? { ...item, active: res.active! } : item));
        setStatusMsg({ type: "success", text: `Comercio "${b.name}" ${res.active ? "activado" : "desactivado"} con éxito.` });
      }
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err.message || "Error al cambiar estado del comercio." });
    } finally {
      setPendingId(null);
    }
  };

  const handleCleanDuplicates = async (b: BusinessWithUsers) => {
    if (!setupKey) {
      setStatusMsg({ type: "error", text: "Por favor, ingresá la Clave de Setup al inicio del panel." });
      return;
    }
    setPendingId(b.id + "-clean");
    setStatusMsg(null);
    try {
      const res = await cleanDuplicateCategoriesAction(b.id, setupKey);
      if (res.success) {
        setStatusMsg({ 
          type: "success", 
          text: `Categorías limpiadas con éxito en "${b.name}". Se eliminaron ${res.cleanedCount} duplicadas.` 
        });
      }
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err.message || "Error al limpiar duplicados." });
    } finally {
      setPendingId(null);
    }
  };

  const openDeleteModal = (b: BusinessWithUsers) => {
    if (!setupKey) {
      setStatusMsg({ type: "error", text: "Por favor, ingresá la Clave de Setup al inicio del panel." });
      return;
    }
    setStatusMsg(null);
    setBusinessToDelete(b);
    setConfirmNameInput("");
    setDeleteConfirmOpen(true);
  };

  const handleDeleteBusiness = async () => {
    if (!businessToDelete) return;
    if (confirmNameInput.trim() !== businessToDelete.name.trim()) {
      setStatusMsg({ type: "error", text: "El nombre de confirmación no coincide." });
      setDeleteConfirmOpen(false);
      return;
    }
    
    setPendingId(businessToDelete.id + "-delete");
    setStatusMsg(null);
    setDeleteConfirmOpen(false);
    try {
      const res = await deleteBusinessAction(businessToDelete.id, setupKey, confirmNameInput);
      if (res.success) {
        setBusinesses(prev => prev.filter(item => item.id !== businessToDelete.id));
        setStatusMsg({ type: "success", text: `Comercio "${businessToDelete.name}" eliminado definitivamente.` });
      }
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err.message || "Error al eliminar el comercio." });
    } finally {
      setPendingId(null);
      setBusinessToDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Setup Key Input panel */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-[#273342] dark:bg-[#1a242f]">
        <label htmlFor="panelSetupKey" className="block text-sm font-medium text-gray-700 dark:text-[#A9B6C2] mb-1">
          Clave de Setup/Admin (Requerida para realizar acciones sobre comercios)
        </label>
        <Input
          id="panelSetupKey"
          type="password"
          value={setupKey}
          onChange={(e) => setSetupKey(e.target.value)}
          placeholder="Ingresá la clave de setup para habilitar acciones"
          className="max-w-md"
        />
      </div>

      {statusMsg && (
        <div 
          className={`rounded-md border p-3 text-sm ${
            statusMsg.type === "success" 
              ? "border-green-200 bg-green-50 text-green-700 dark:border-green-900/70 dark:bg-green-950/40 dark:text-green-200" 
              : "border-red-200 bg-red-50 text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200"
          }`}
        >
          {statusMsg.text}
        </div>
      )}

      <div className="space-y-4 max-h-[700px] overflow-y-auto pr-2">
        {businesses.length === 0 ? (
          <p className="text-sm text-gray-500">No hay comercios registrados aún.</p>
        ) : (
          businesses.map((b, index) => {
            const isFirst = index === businesses.length - 1; // Since it's ordered by desc, the first created is the last one in the array
            return (
              <div
                key={b.id}
                className="rounded-lg border border-gray-100 bg-gray-50 p-5 dark:border-[#273342] dark:bg-[#1f2c39] space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      {b.name}
                      {isFirst && (
                        <span className="text-[10px] bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 px-2 py-0.5 rounded-full font-normal">
                          Inicial
                        </span>
                      )}
                    </h3>
                    <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1 mt-1">
                      <p>ID: <span className="font-mono">{b.id}</span></p>
                      <p>Creado: {new Date(b.createdAt).toLocaleString("es-AR")}</p>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      b.active
                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                        : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                    }`}
                  >
                    {b.active ? "Activo" : "Inactivo"}
                  </span>
                </div>

                <div className="border-t border-gray-200 pt-3 dark:border-[#273342]">
                  <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">
                    Usuarios ({b.users.length}):
                  </h4>
                  <ul className="text-xs space-y-1.5 text-gray-600 dark:text-gray-400">
                    {b.users.map((u) => (
                      <li key={u.email} className="flex justify-between items-center bg-white dark:bg-[#18212B] p-1.5 rounded border border-gray-100 dark:border-transparent">
                        <span>{u.name} <span className="text-gray-400">({u.email})</span></span>
                        <span className="font-mono text-[9px] bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded uppercase font-bold text-gray-500 dark:text-gray-300">
                          {u.role}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2.5 pt-2 border-t border-gray-100 dark:border-[#273342]">
                  <Button
                    size="sm"
                    variant={b.active ? "outline" : "primary"}
                    disabled={pendingId !== null}
                    onClick={() => handleToggleActive(b)}
                    className="text-xs"
                  >
                    {pendingId === b.id + "-toggle" ? "Procesando..." : b.active ? "Desactivar" : "Activar"}
                  </Button>
                  
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pendingId !== null}
                    onClick={() => handleCleanDuplicates(b)}
                    className="text-xs"
                  >
                    {pendingId === b.id + "-clean" ? "Limpiando..." : "Limpiar Categorías Duplicadas"}
                  </Button>
                  
                  {!isFirst && (
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={pendingId !== null}
                      onClick={() => openDeleteModal(b)}
                      className="text-xs"
                    >
                      {pendingId === b.id + "-delete" ? "Eliminando..." : "Eliminar Comercio"}
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmOpen && businessToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#18212B] rounded-lg border border-gray-200 dark:border-[#273342] p-6 max-w-md w-full shadow-xl space-y-4">
            <h3 className="text-lg font-semibold text-red-600 dark:text-red-400">
              ¿Eliminar comercio definitivamente?
            </h3>
            
            <div className="text-sm space-y-2 text-gray-600 dark:text-[#A9B6C2]">
              <p>
                Esta acción eliminará permanentemente el comercio <strong>{businessToDelete.name}</strong> y TODOS sus datos asociados:
              </p>
              <ul className="list-disc pl-5 text-xs space-y-1 text-red-500 dark:text-red-400">
                <li>Usuarios, productos y categorías.</li>
                <li>Historial completo de cajas y movimientos.</li>
                <li>Ventas, compras, proveedores e intentos de pago.</li>
                <li>Cuentas Mercado Pago vinculadas.</li>
              </ul>
              <p className="font-semibold text-red-600 dark:text-red-400">
                ¡Esta acción no se puede deshacer!
              </p>
              <p className="pt-2">
                Para confirmar la eliminación, por favor escribí el nombre exacto del comercio:
              </p>
              <p className="bg-gray-100 dark:bg-gray-800 p-2 rounded text-center font-mono font-bold select-all">
                {businessToDelete.name}
              </p>
            </div>

            <Input
              type="text"
              value={confirmNameInput}
              onChange={(e) => setConfirmNameInput(e.target.value)}
              placeholder="Nombre del comercio"
              className="w-full text-center font-bold"
            />

            <div className="flex gap-3 justify-end pt-2">
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
                Eliminar Definitivamente
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
