import { Card } from "@/components/ui/card";

type EmptyStateProps = {
  title: string;
  description: string;
};

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <Card className="pos-accent-line p-8 pl-9 text-center">
      <div className="badge-info mx-auto grid h-11 w-11 place-items-center rounded-lg">
        <span className="h-2 w-2 rounded-full bg-current shadow-sm shadow-brand-500/40" />
      </div>
      <p className="mt-4 text-sm font-black text-[var(--text-primary)]">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--text-secondary)]">
        {description}
      </p>
    </Card>
  );
}
