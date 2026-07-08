import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { requireOperationalUser } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { updateProductAction } from "../../actions";
import { ProductForm } from "../../product-form";

export const dynamic = "force-dynamic";

type EditarProductoPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditarProductoPage({ params }: EditarProductoPageProps) {
  const user = await requireOperationalUser();
  const { id } = await params;
  const product = await prisma.product.findFirst({
    where: {
      id,
      businessId: user.businessId!
    }
  });

  if (!product) {
    redirect("/productos");
  }

  const rawCategories = await prisma.category.findMany({
    where: {
      businessId: user.businessId!,
      OR: [
        { active: true },
        { id: product.categoryId }
      ]
    },
    include: {
      parent: {
        select: {
          name: true
        }
      }
    },
    orderBy: { name: "asc" }
  });

  // Construct label showing hierarchy and deduplicate by id
  const categoryOptionsMap = new Map<string, { id: string; name: string }>();
  for (const cat of rawCategories) {
    if (!categoryOptionsMap.has(cat.id)) {
      const displayName = cat.parent ? `${cat.parent.name} > ${cat.name}` : cat.name;
      categoryOptionsMap.set(cat.id, { id: cat.id, name: displayName });
    }
  }

  const categories = Array.from(categoryOptionsMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

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
