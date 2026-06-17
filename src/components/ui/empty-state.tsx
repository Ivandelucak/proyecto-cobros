import { Card } from "@/components/ui/card";

type EmptyStateProps = {
  title: string;
  description: string;
};

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <Card className="p-8 text-center">
      <p className="text-sm font-semibold text-gray-950 dark:text-gray-50">{title}</p>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{description}</p>
    </Card>
  );
}
