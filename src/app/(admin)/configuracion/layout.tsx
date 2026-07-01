import type { ReactNode } from "react";
import { SettingsPageShell } from "@/components/settings/SettingsPageShell";

export default function ConfiguracionLayout({ children }: { children: ReactNode }) {
  return <SettingsPageShell>{children}</SettingsPageShell>;
}
