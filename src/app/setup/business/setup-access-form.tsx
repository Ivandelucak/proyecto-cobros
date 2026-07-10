"use client";

import { useActionState } from "react";
import {
  validateSetupAccessAction,
  type SetupAccessState
} from "./actions";

const initialState: SetupAccessState = {};

export function SetupAccessForm() {
  const [state, formAction, pending] = useActionState(
    validateSetupAccessAction,
    initialState
  );

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="setupKey" className="mb-1 block text-sm font-medium">
          Clave de Setup/Admin
        </label>
        <input
          id="setupKey"
          name="setupKey"
          type="password"
          required
          autoComplete="off"
          disabled={pending}
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-70 dark:border-gray-700 dark:bg-gray-800"
          placeholder="Ingresa la clave de setup"
        />
      </div>

      {state.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {pending ? "Validando..." : "Ingresar"}
      </button>
    </form>
  );
}
