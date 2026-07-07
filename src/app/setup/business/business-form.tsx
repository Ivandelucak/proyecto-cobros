"use client";

import { useActionState, useState } from "react";
import { createBusinessAction, type CreateBusinessState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";

const initialState: CreateBusinessState = {};

export function BusinessForm({ setupKey }: { setupKey: string }) {
  const [state, formAction, pending] = useActionState(createBusinessAction, initialState);
  const [rubro, setRubro] = useState("OTRO");
  const [preloadCategories, setPreloadCategories] = useState(false);

  const handleRubroChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setRubro(val);
    if (val === "OTRO") {
      setPreloadCategories(false);
    } else {
      setPreloadCategories(true);
    }
  };

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="setupKey" className="text-sm font-medium text-gray-700 dark:text-[#A9B6C2]">
          Clave de Setup / Admin
        </label>
        <Input
          id="setupKey"
          name="setupKey"
          type="password"
          required
          defaultValue={setupKey}
          placeholder="Clave de seguridad del sistema"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="businessName" className="text-sm font-medium text-gray-700 dark:text-[#A9B6C2]">
          Nombre del Comercio
        </label>
        <Input
          id="businessName"
          name="businessName"
          type="text"
          required
          placeholder="Ej: Kiosco Belgrano"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="rubro" className="text-sm font-medium text-gray-700 dark:text-[#A9B6C2]">
          Rubro del Comercio
        </label>
        <Select id="rubro" name="rubro" value={rubro} onChange={handleRubroChange}>
          <option value="KIOSKO">Kiosco</option>
          <option value="ALMACEN_SUPERMERCADO">Almacén / Supermercado</option>
          <option value="BEBIDAS">Tienda de bebidas</option>
          <option value="ROPA">Tienda de ropa</option>
          <option value="MASCOTAS">Tienda de mascotas</option>
          <option value="LIBRERIA">Librería / Papelería</option>
          <option value="CARNICERIA">Carnicería</option>
          <option value="FERRETERIA">Ferretería</option>
          <option value="VERDULERIA">Verdulería / Frutería</option>
          <option value="PANADERIA">Panadería</option>
          <option value="OTRO">Otro / Sin rubro específico</option>
        </Select>
      </div>

      <input type="hidden" name="preloadCategoriesActive" value={preloadCategories ? "true" : "false"} />

      <div className="flex items-start gap-2.5 pt-2">
        <input
          id="preloadCategories"
          type="checkbox"
          checked={preloadCategories}
          onChange={(e) => setPreloadCategories(e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-gray-300 text-[var(--accent)] focus:ring-[var(--accent)] dark:border-[#273342] dark:bg-[#18212B]"
        />
        <div className="space-y-1">
          <label htmlFor="preloadCategories" className="text-sm font-medium text-gray-700 dark:text-[#A9B6C2] cursor-pointer">
            Crear categorías sugeridas para este rubro
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {preloadCategories 
              ? "Se crearán categorías iniciales sugeridas para este rubro. Podés editarlas o eliminarlas después."
              : "No se crearán categorías sugeridas. Podrás cargarlas manualmente desde Categorías."
            }
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="ownerName" className="text-sm font-medium text-gray-700 dark:text-[#A9B6C2]">
          Nombre del Dueño
        </label>
        <Input
          id="ownerName"
          name="ownerName"
          type="text"
          required
          placeholder="Ej: Juan Pérez"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="ownerEmail" className="text-sm font-medium text-gray-700 dark:text-[#A9B6C2]">
          Email del Dueño
        </label>
        <Input
          id="ownerEmail"
          name="ownerEmail"
          type="email"
          required
          placeholder="Ej: juan@kiosco.com"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium text-gray-700 dark:text-[#A9B6C2]">
          Contraseña Temporal
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          placeholder="Contraseña inicial para el dueño"
        />
      </div>

      {state.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200">
          {state.error}
        </p>
      ) : null}

      {state.success ? (
        <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-900/70 dark:bg-green-950/40 dark:text-green-200">
          ¡Comercio y usuario dueño creados con éxito!
        </p>
      ) : null}

      <Button type="submit" variant="primary" disabled={pending} className="w-full py-2.5">
        {pending ? "Creando..." : "Crear Comercio"}
      </Button>
    </form>
  );
}
