import { Badge } from "@/components/ui/badge";

type BarcodeFeedbackProps = {
  code: string | null;
  message: string | null;
  tone?: "ok" | "error" | "info";
};

export function BarcodeFeedback({ code, message, tone = "info" }: BarcodeFeedbackProps) {
  if (!code && !message) {
    return null;
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-[#273342] dark:bg-[#121922] dark:text-[#A9B6C2]">
      {code ? <Badge tone={tone === "error" ? "red" : tone === "ok" ? "green" : "blue"}>Codigo escaneado: {code}</Badge> : null}
      {message ? <span className="min-w-0 break-words">{message}</span> : null}
    </div>
  );
}
