import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

type PagePlaceholderProps = {
  title: string;
  description: string;
};

export function PagePlaceholder({ title, description }: PagePlaceholderProps) {
  return (
    <section className="space-y-4">
      <PageHeader title={title} description={description} />
      <Card className="p-5 text-sm text-gray-600 dark:text-[#A9B6C2]">
        Se implementará en próximas etapas.
      </Card>
    </section>
  );
}
