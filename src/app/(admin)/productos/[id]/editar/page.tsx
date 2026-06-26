import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { requireAdminPage } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { updateProductAction } from "../../actions";
import { ProductForm } from "../../product-form";

export const dynamic = "force-dynamic";

type EditarProductoPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditarProductoPage({ params }: EditarProductoPageProps) {
  await requireAdminPage();

  const { id } = await params;
  const [product, categories] = await Promise.all([
    prisma.product.findUnique({ where: { id } }),
    prisma.category.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true }
    })
  ]);

  if (!product) {
    redirect("/productos");
  }

  return (
    <section className="space-y-5">
      <PageHeader
        title="Editar producto"
        description="Actualizá datos, precio, estado y stock. Los cambios de stock quedan auditados."
      />
      <ProductForm
        action={updateProductAction.bind(null, product.id)}
        categories={categories}
        productId={product.id}
        submitLabel="Guardar cambios"
        initialValues={{
          name: product.name,
          barcode: product.barcode,
          sku: product.sku,
          brand: product.brand,
          categoryId: product.categoryId,
          salePrice: product.salePrice.toString(),
          cost: product.cost?.toString() ?? "",
          stock: product.stock.toString(),
          minStock: product.minStock.toString(),
          unitType: product.unitType,
          allowsDecimalQuantity: product.allowsDecimalQuantity,
          quickAccess: product.quickAccess,
          active: product.active,
          vatRate: product.vatRate?.toString() ?? null,
          vatArcaCode: product.vatArcaCode,
          taxTreatment: product.taxTreatment
        }}
      />
    </section>
  );
}
