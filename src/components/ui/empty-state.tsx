import { Card } from "@/components/ui/card";

type EmptyStateProps = {
  title: string;
  description: string;
};

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <Card className="p-8 text-center">
      <div className="mx-auto grid h-10 w-10 place-items-center rounded-md border border-slate-200 bg-slate-50 text-slate-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-gray-400">
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
      </div>
      <p className="mt-4 text-sm font-semibold text-gray-950 dark:text-gray-50">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-600 dark:text-gray-300">
        {description}
      </p>
    </Card>
  );
}
