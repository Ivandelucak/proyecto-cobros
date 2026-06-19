import {
  BusinessType,
  PaymentMethod,
  PrintPaperSize,
  Prisma,
  PrismaClient,
  StockMovementType,
  UnitType
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const categoryNames = [
  "Almacén",
  "Bebidas",
  "Gaseosas",
  "Aguas",
  "Jugos",
  "Energizantes",
  "Cervezas",
  "Vinos",
  "Aperitivos",
  "Golosinas",
  "Alfajores",
  "Chocolates",
  "Caramelos",
  "Chicles",
  "Galletitas",
  "Snacks",
  "Cigarrillos",
  "Encendedores y accesorios",
  "Lácteos",
  "Panadería",
  "Fiambres",
  "Quesos",
  "Congelados",
  "Conservas",
  "Pastas",
  "Arroz y legumbres",
  "Harinas",
  "Aceites y vinagres",
  "Aderezos",
  "Salsas",
  "Infusiones",
  "Yerbas",
  "Café",
  "Té",
  "Azúcar y endulzantes",
  "Limpieza",
  "Perfumería",
  "Higiene personal",
  "Descartables",
  "Pilas",
  "Varios",
  "Carnicería",
  "Verdulería",
  "Frutas",
  "Verduras",
  "Panchos y comidas rápidas",
  "Ferretería",
  "Herramientas",
  "Tornillería",
  "Electricidad",
  "Plomería",
  "Pinturería",
  "Mascotas",
  "Alimentos para mascotas",
  "Accesorios para mascotas",
  "Librería",
  "Papelería",
  "Útiles escolares",
  "Indumentaria",
  "Calzado",
  "Accesorios de ropa",
  "Bazar",
  "Cocina",
  "Hogar",
  "Regalería",
  "Otros"
];

const products = [
  {
    name: "Coca Cola 2.25L",
    barcode: "7790895000997",
    sku: "BEB-COCA225",
    brand: "Coca Cola",
    category: "Gaseosas",
    salePrice: "2500.00",
    cost: "1800.00",
    stock: "24.000",
    minStock: "6.000",
    unitType: UnitType.UNIT,
    allowsDecimalQuantity: false
  },
  {
    name: "Alfajor simple",
    barcode: "7791234567001",
    sku: "GOL-ALF-SIMPLE",
    brand: "Genérico",
    category: "Alfajores",
    salePrice: "650.00",
    cost: "420.00",
    stock: "48.000",
    minStock: "12.000",
    unitType: UnitType.UNIT,
    allowsDecimalQuantity: false
  },
  {
    name: "Yerba mate 1kg",
    barcode: "7791234567002",
    sku: "ALM-YERBA-1KG",
    brand: "Taragüi",
    category: "Yerbas",
    salePrice: "3200.00",
    cost: "2400.00",
    stock: "18.000",
    minStock: "5.000",
    unitType: UnitType.UNIT,
    allowsDecimalQuantity: false
  },
  {
    name: "Pan por kg",
    barcode: null,
    sku: "PAN-KG",
    brand: null,
    category: "Panadería",
    salePrice: "2200.00",
    cost: "1400.00",
    stock: "10.500",
    minStock: "2.000",
    unitType: UnitType.KG,
    allowsDecimalQuantity: true
  },
  {
    name: "Banana por kg",
    barcode: null,
    sku: "VER-BANANA-KG",
    brand: null,
    category: "Frutas",
    salePrice: "1800.00",
    cost: "1100.00",
    stock: "18.750",
    minStock: "4.000",
    unitType: UnitType.KG,
    allowsDecimalQuantity: true
  },
  {
    name: "Detergente",
    barcode: "7791234567003",
    sku: "LIM-DETERGENTE",
    brand: "Magistral",
    category: "Limpieza",
    salePrice: "1700.00",
    cost: "1100.00",
    stock: "20.000",
    minStock: "5.000",
    unitType: UnitType.UNIT,
    allowsDecimalQuantity: false
  },
  {
    name: "Agua mineral 2L",
    barcode: "7791234567004",
    sku: "BEB-AGUA-2L",
    brand: "Villavicencio",
    category: "Aguas",
    salePrice: "1200.00",
    cost: "760.00",
    stock: "30.000",
    minStock: "8.000",
    unitType: UnitType.UNIT,
    allowsDecimalQuantity: false
  },
  {
    name: "Cerveza lata",
    barcode: "7791234567005",
    sku: "BEB-CERVEZA-LATA",
    brand: "Quilmes",
    category: "Cervezas",
    salePrice: "1400.00",
    cost: "950.00",
    stock: "36.000",
    minStock: "10.000",
    unitType: UnitType.UNIT,
    allowsDecimalQuantity: false
  },
  {
    name: "Tornillos por unidad",
    barcode: null,
    sku: "FER-TORNILLO-001",
    brand: null,
    category: "Tornillería",
    salePrice: "80.00",
    cost: "35.00",
    stock: "500.000",
    minStock: "100.000",
    unitType: UnitType.UNIT,
    allowsDecimalQuantity: false
  },
  {
    name: "Alimento para perro 15kg",
    barcode: "7791234567006",
    sku: "PET-ALIMENTO-15KG",
    brand: "DogPro",
    category: "Alimentos para mascotas",
    salePrice: "28500.00",
    cost: "22000.00",
    stock: "8.000",
    minStock: "2.000",
    unitType: UnitType.UNIT,
    allowsDecimalQuantity: false
  },
  {
    name: "Cuaderno universitario",
    barcode: "7791234567007",
    sku: "LIB-CUADERNO-UNI",
    brand: "Avon",
    category: "Librería",
    salePrice: "3500.00",
    cost: "2400.00",
    stock: "16.000",
    minStock: "4.000",
    unitType: UnitType.UNIT,
    allowsDecimalQuantity: false
  }
];

const quickAccessProductNames = new Set([
  "Coca Cola 2.25L",
  "Alfajor simple",
  "Yerba mate 1kg",
  "Pan por kg",
  "Banana por kg",
  "Agua mineral 2L",
  "Cerveza lata"
]);

const paymentMethodSettings = [
  { method: PaymentMethod.CASH, label: "Efectivo", enabled: true, sortOrder: 10 },
  { method: PaymentMethod.DEBIT, label: "Debito", enabled: true, sortOrder: 20 },
  { method: PaymentMethod.CREDIT, label: "Credito", enabled: true, sortOrder: 30 },
  {
    method: PaymentMethod.TRANSFER,
    label: "Transferencia",
    enabled: true,
    sortOrder: 40
  },
  {
    method: PaymentMethod.MERCADOPAGO,
    label: "MercadoPago",
    enabled: true,
    sortOrder: 50
  },
  {
    method: PaymentMethod.CURRENT_ACCOUNT,
    label: "Cuenta corriente",
    enabled: true,
    sortOrder: 60
  }
];

const creditInstallmentPlans = [
  { installments: 1, surchargeRate: "0.00", active: true },
  { installments: 2, surchargeRate: "10.00", active: true },
  { installments: 3, surchargeRate: "15.00", active: true },
  { installments: 6, surchargeRate: "25.00", active: true },
  { installments: 12, surchargeRate: "45.00", active: true }
];

async function main() {
  const passwordHashAdmin = await bcrypt.hash("admin123", 12);
  const passwordHashCashier = await bcrypt.hash("cajero123", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@local.com" },
    update: {
      name: "Administrador",
      passwordHash: passwordHashAdmin,
      role: "ADMIN",
      active: true
    },
    create: {
      name: "Administrador",
      email: "admin@local.com",
      passwordHash: passwordHashAdmin,
      role: "ADMIN",
      active: true
    }
  });

  await prisma.user.upsert({
    where: { email: "cajero@local.com" },
    update: {
      name: "Cajero",
      passwordHash: passwordHashCashier,
      role: "CASHIER",
      active: true
    },
    create: {
      name: "Cajero",
      email: "cajero@local.com",
      passwordHash: passwordHashCashier,
      role: "CASHIER",
      active: true
    }
  });

  await prisma.businessProfile.upsert({
    where: { id: "default" },
    update: {
      name: "POS Universal Demo",
      businessType: BusinessType.KIOSK,
      cuit: null,
      address: null,
      phone: null,
      email: null,
      fiscalCondition: null,
      grossIncome: null,
      activityStartDate: null,
      currency: "ARS",
      locale: "es-AR",
      timezone: "America/Argentina/Buenos_Aires",
      logoUrl: null,
      website: null,
      generalFooterText: null,
      preferredTheme: "light"
    },
    create: {
      id: "default",
      name: "POS Universal Demo",
      businessType: BusinessType.KIOSK,
      currency: "ARS",
      locale: "es-AR",
      timezone: "America/Argentina/Buenos_Aires",
      preferredTheme: "light"
    }
  });

  await prisma.printSetting.upsert({
    where: { id: "default" },
    update: {
      paperSize: PrintPaperSize.TICKET_80,
      silentPrint: false,
      autoPrintTicket: false,
      copies: 1,
      marginMm: 2
    },
    create: {
      id: "default",
      paperSize: PrintPaperSize.TICKET_80,
      silentPrint: false,
      autoPrintTicket: false,
      copies: 1,
      marginMm: 2
    }
  });

  await prisma.ticketSetting.upsert({
    where: { id: "default" },
    update: {
      showBusinessName: true,
      showCuit: true,
      showAddress: true,
      showPhone: true,
      showEmail: false,
      showSeller: true,
      showCustomer: true,
      showPaymentDetails: true,
      showStockUnit: true,
      showBarcode: false,
      footerText: null,
      headerText: null,
      ticketTitle: "Ticket no fiscal",
      thankYouText: "Gracias por su compra",
      showNonFiscalLegend: true,
      nonFiscalLegend: "Ticket no fiscal"
    },
    create: {
      id: "default",
      showBusinessName: true,
      showCuit: true,
      showAddress: true,
      showPhone: true,
      showEmail: false,
      showSeller: true,
      showCustomer: true,
      showPaymentDetails: true,
      showStockUnit: true,
      showBarcode: false,
      footerText: null,
      headerText: null,
      ticketTitle: "Ticket no fiscal",
      thankYouText: "Gracias por su compra",
      showNonFiscalLegend: true,
      nonFiscalLegend: "Ticket no fiscal"
    }
  });

  await prisma.cashRegisterSetting.upsert({
    where: { id: "default" },
    update: {
      requireOpenSession: true,
      showExpectedCashToCashier: false,
      allowCashierCancelSale: false,
      allowNegativeStock: false,
      defaultSearchMode: null,
      quickProductsLimit: 12
    },
    create: {
      id: "default",
      requireOpenSession: true,
      showExpectedCashToCashier: false,
      allowCashierCancelSale: false,
      allowNegativeStock: false,
      defaultSearchMode: null,
      quickProductsLimit: 12
    }
  });

  await prisma.stockSetting.upsert({
    where: { id: "default" },
    update: {
      lowStockEnabled: true,
      defaultMinStock: null,
      allowManualStockAdjustment: true,
      showLowStockWarnings: true
    },
    create: {
      id: "default",
      lowStockEnabled: true,
      defaultMinStock: null,
      allowManualStockAdjustment: true,
      showLowStockWarnings: true
    }
  });

  for (const setting of paymentMethodSettings) {
    await prisma.paymentMethodSetting.upsert({
      where: { method: setting.method },
      update: {
        label: setting.label,
        enabled: setting.enabled,
        sortOrder: setting.sortOrder
      },
      create: setting
    });
  }

  for (const plan of creditInstallmentPlans) {
    await prisma.creditInstallmentPlan.upsert({
      where: { installments: plan.installments },
      update: {
        surchargeRate: new Prisma.Decimal(plan.surchargeRate),
        active: plan.active
      },
      create: {
        installments: plan.installments,
        surchargeRate: new Prisma.Decimal(plan.surchargeRate),
        active: plan.active
      }
    });
  }

  const categories = new Map<string, { id: string }>();
  for (const name of categoryNames) {
    const category = await prisma.category.upsert({
      where: { name },
      update: { active: true },
      create: { name, active: true }
    });

    categories.set(name, category);
  }

  for (const product of products) {
    const category = categories.get(product.category);
    if (!category) {
      throw new Error(`Categoria faltante: ${product.category}`);
    }

    const stock = new Prisma.Decimal(product.stock);
    const savedProduct = await prisma.product.upsert({
      where: product.barcode ? { barcode: product.barcode } : { sku: product.sku },
      update: {
        name: product.name,
        sku: product.sku,
        brand: product.brand,
        categoryId: category.id,
        salePrice: new Prisma.Decimal(product.salePrice),
        cost: product.cost ? new Prisma.Decimal(product.cost) : null,
        stock,
        minStock: new Prisma.Decimal(product.minStock),
        unitType: product.unitType,
        allowsDecimalQuantity: product.allowsDecimalQuantity,
        quickAccess: quickAccessProductNames.has(product.name),
        active: true,
        deletedAt: null
      },
      create: {
        name: product.name,
        barcode: product.barcode,
        sku: product.sku,
        brand: product.brand,
        categoryId: category.id,
        salePrice: new Prisma.Decimal(product.salePrice),
        cost: product.cost ? new Prisma.Decimal(product.cost) : null,
        stock,
        minStock: new Prisma.Decimal(product.minStock),
        unitType: product.unitType,
        allowsDecimalQuantity: product.allowsDecimalQuantity,
        quickAccess: quickAccessProductNames.has(product.name),
        active: true
      }
    });

    const hasInitialMovement = await prisma.stockMovement.count({
      where: {
        productId: savedProduct.id,
        type: StockMovementType.INITIAL_IMPORT
      }
    });

    if (!hasInitialMovement) {
      await prisma.stockMovement.create({
        data: {
          productId: savedProduct.id,
          type: StockMovementType.INITIAL_IMPORT,
          quantity: stock,
          previousStock: new Prisma.Decimal(0),
          newStock: stock,
          reason: "Seed inicial",
          userId: admin.id
        }
      });
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
