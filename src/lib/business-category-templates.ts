import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/[^a-z0-9\s-]/g, "") // remove other special chars
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export const BUSINESS_TEMPLATES: Record<string, string[]> = {
  KIOSKO: [
    "Gaseosas", "Aguas", "Aguas saborizadas", "Jugos", "Energizantes", "Isotónicas", "Soda", "Cervezas", "Fernet", "Aperitivos", "Hielo",
    "Golosinas", "Caramelos", "Chicles", "Chocolates", "Alfajores", "Turrones", "Barras de cereal", "Galletitas dulces", "Galletitas saladas",
    "Snacks", "Papas fritas", "Maní", "Frutos secos", "Panchos", "Sandwiches", "Empanadas", "Tartas", "Comidas listas", "Helados", "Panificados",
    "Cigarrillos", "Encendedores", "Pilas", "Cargadores", "Auriculares", "Artículos escolares", "Librería", "Juguetes chicos", "Regalería",
    "Artículos varios", "Pañuelos", "Papel higiénico", "Desodorantes", "Preservativos", "Higiene personal", "Limpieza básica"
  ],
  ALMACEN_SUPERMERCADO: [
    "Almacén", "Arroz", "Fideos", "Pastas secas", "Harinas", "Premezclas", "Puré instantáneo", "Polenta", "Legumbres", "Cereales", "Avena",
    "Pan rallado y rebozadores", "Conservas", "Enlatados", "Salsas", "Aderezos", "Mayonesa", "Ketchup", "Mostaza", "Aceites", "Vinagres",
    "Sal", "Condimentos", "Especias", "Caldos y sopas", "Azúcar", "Endulzantes", "Mermeladas", "Dulce de leche", "Miel", "Postres y gelatinas",
    "Yerbas", "Té", "Café", "Mate cocido", "Cacao", "Chocolatada", "Leche en polvo", "Gaseosas", "Aguas", "Aguas saborizadas", "Jugos",
    "Energizantes", "Isotónicas", "Soda", "Cervezas", "Vinos", "Aperitivos", "Fernet", "Sidras", "Espumantes", "Hielo", "Lácteos", "Leches",
    "Yogures", "Quesos", "Manteca", "Crema", "Postres refrigerados", "Fiambres", "Embutidos", "Huevos", "Verdulería", "Frutas", "Verduras",
    "Carnes", "Pollo", "Pescados", "Panificados", "Panadería", "Pastas frescas", "Congelados", "Hamburguesas", "Milanesas", "Papas congeladas",
    "Verduras congeladas", "Helados", "Galletitas dulces", "Galletitas saladas", "Budines", "Magdalenas", "Alfajores", "Chocolates", "Golosinas",
    "Cereales para desayuno", "Barras de cereal", "Snacks", "Papas fritas", "Maní", "Frutos secos", "Limpieza", "Lavandina", "Detergentes",
    "Desinfectantes", "Limpiadores", "Jabón para ropa", "Suavizantes", "Papel higiénico", "Rollos de cocina", "Servilletas", "Bolsas de residuos",
    "Insecticidas", "Escobas y trapos", "Perfumería", "Shampoo", "Acondicionador", "Jabones", "Desodorantes", "Pasta dental", "Cepillos dentales",
    "Afeitadoras", "Higiene femenina", "Pañales", "Toallitas húmedas", "Bebés", "Leches infantiles", "Papillas", "Cuidado del bebé", "Mascotas",
    "Alimentos para perros", "Alimentos para gatos", "Snacks para mascotas", "Arena sanitaria", "Accesorios para mascotas", "Bazar", "Cocina",
    "Envases descartables", "Pilas", "Encendedores", "Velas", "Carbón y leña", "Artículos varios"
  ],
  BEBIDAS: [
    "Gaseosas", "Aguas", "Aguas saborizadas", "Jugos", "Energizantes", "Isotónicas", "Soda", "Tónicas", "Limonadas", "Bebidas saborizadas",
    "Bebidas sin alcohol", "Cervezas sin alcohol", "Cervezas", "Cervezas rubias", "Cervezas negras", "Cervezas rojas", "Cervezas IPA",
    "Cervezas artesanales", "Latas", "Botellas", "Packs de cerveza", "Porrones", "Vinos", "Vinos tintos", "Vinos blancos", "Vinos rosados",
    "Vinos dulces", "Vinos espumantes", "Vinos en caja", "Vinos reserva", "Malbec", "Cabernet", "Merlot", "Blend", "Torrontés", "Chardonnay",
    "Espumantes", "Champagne", "Sidras", "Ananá fizz", "Frizantes", "Aperitivos", "Vermut", "Amargos", "Bitter", "Campari", "Gancia",
    "Cinzano", "Aperol", "Fernet", "Vodka", "Gin", "Ron", "Tequila", "Whisky", "Bourbon", "Cognac", "Brandy", "Grappa", "Caña", "Licores",
    "Cremas", "Anís", "Tragos", "Combos", "Promociones", "Hielo", "Snacks", "Alfajores", "Chocolates", "Panchos", "Artículos varios"
  ],
  ROPA: [
    "Remeras", "Chombas", "Camisas", "Musculosas", "Tops", "Buzos", "Sweaters", "Camperas", "Chalecos", "Pantalones", "Jeans", "Joggers",
    "Shorts", "Bermudas", "Polleras", "Vestidos", "Trajes", "Sacos", "Blazers", "Ropa interior", "Medias", "Pijamas", "Mallas", "Ropa térmica",
    "Hombre", "Mujer", "Unisex", "Niños", "Niñas", "Bebés", "Talles grandes", "Zapatillas", "Zapatos", "Botas", "Sandalias", "Ojotas",
    "Pantuflas", "Accesorios", "Gorras", "Cinturones", "Carteras", "Mochilas", "Billeteras", "Bufandas", "Guantes", "Lentes", "Bijouterie",
    "Nueva temporada", "Ofertas", "Liquidación", "Artículos varios"
  ],
  MASCOTAS: [
    "Alimentos para perros", "Alimentos para gatos", "Alimentos para cachorros", "Alimentos para gatitos", "Alimentos premium",
    "Alimentos húmedos", "Alimentos medicados", "Snacks y premios", "Huesos y mordillos", "Higiene", "Shampoo para mascotas", "Cepillos",
    "Peines", "Perfumes", "Paños sanitarios", "Bolsitas higiénicas", "Arena sanitaria", "Piedras sanitarias", "Correas", "Collares",
    "Pretales", "Platos y comederos", "Bebederos", "Camas", "Cuchas", "Transportadoras", "Ropa para mascotas", "Juguetes", "Rascadores",
    "Antiparasitarios", "Pipetas", "Collares antipulgas", "Vitaminas", "Cuidado dental", "Aves", "Peces", "Roedores", "Reptiles",
    "Alimentos para aves", "Alimentos para peces", "Jaulas", "Peceras", "Artículos varios"
  ],
  LIBRERIA: [
    "Cuadernos", "Carpetas", "Repuestos de hojas", "Hojas", "Separadores", "Folios", "Cartucheras", "Mochilas", "Guardapolvos",
    "Etiquetas escolares", "Lapiceras", "Lápices", "Portaminas", "Minas", "Gomas", "Sacapuntas", "Correctores", "Marcadores", "Resaltadores",
    "Fibras", "Crayones", "Tizas", "Pinturas", "Temperas", "Acuarelas", "Pinceles", "Lienzos", "Cartulinas", "Afiches", "Goma eva",
    "Papeles de colores", "Manualidades", "Artículos de oficina", "Agendas", "Blocks", "Sobres", "Biblioratos", "Abrochadoras", "Broches",
    "Clips", "Cinta adhesiva", "Pegamentos", "Tijeras", "Reglas", "Calculadoras", "Fotocopias", "Impresiones", "Anillados", "Plastificados",
    "Encuadernación", "Regalería", "Tarjetas", "Bolsas de regalo", "Moños", "Juguetería", "Libros", "Artículos varios"
  ],
  CARNICERIA: [
    "Carne vacuna", "Novillo", "Ternera", "Cortes parrilleros", "Cortes para horno", "Cortes para milanesa", "Cortes económicos",
    "Carne picada", "Pollo", "Cerdo", "Cordero", "Pescados", "Milanesas", "Hamburguesas", "Albóndigas", "Chorizos", "Morcillas",
    "Salchichas parrilleras", "Brochettes", "Achuras", "Matambre preparado", "Arrollados", "Preparados", "Fiambres", "Embutidos",
    "Jamón", "Queso", "Panceta", "Salames", "Congelados", "Pollos congelados", "Milanesas congeladas", "Hamburguesas congeladas",
    "Carbón", "Leña", "Pan rallado", "Huevos", "Condimentos", "Salsas", "Aderezos", "Bebidas", "Artículos varios"
  ],
  FERRETERIA: [
    "Herramientas manuales", "Herramientas eléctricas", "Taladros", "Amoladoras", "Sierras", "Destornilladores", "Llaves", "Pinzas",
    "Martillos", "Cintas métricas", "Niveles", "Mechas", "Discos de corte", "Tornillos", "Clavos", "Tarugos", "Bulones", "Tuercas",
    "Arandelas", "Remaches", "Abrazaderas", "Ganchos", "Pinturas", "Pinceles", "Rodillos", "Bandejas", "Lijas", "Enduidos", "Masillas",
    "Diluyentes", "Aerosoles", "Electricidad", "Cables", "Fichas", "Tomas", "Llaves de luz", "Portalámparas", "Lámparas", "Led",
    "Zapatillas eléctricas", "Prolongadores", "Disyuntores", "Térmicas", "Plomería", "Caños", "Mangueras", "Canillas", "Flexibles",
    "Codos", "Cuplas", "Selladores", "Cintas de teflón", "Cemento", "Cal", "Arena", "Adhesivos", "Siliconas", "Selladores", "Espumas",
    "Cintas", "Guantes", "Lentes de seguridad", "Cascos", "Candados", "Cerraduras", "Bisagras", "Lubricantes", "Jardinería", "Artículos varios"
  ],
  VERDULERIA: [
    "Frutas", "Manzanas", "Bananas", "Naranjas", "Mandarinas", "Limones", "Peras", "Uvas", "Frutillas", "Kiwis", "Duraznos", "Ciruelas",
    "Sandías", "Melones", "Verduras", "Papas", "Batatas", "Cebollas", "Tomates", "Lechuga", "Zanahoria", "Zapallo", "Morrones", "Berenjenas",
    "Zucchini", "Choclos", "Acelga", "Espinaca", "Brócoli", "Coliflor", "Huevos", "Frutos secos", "Legumbres", "Condimentos",
    "Hierbas frescas", "Ensaladas listas", "Bandejas preparadas", "Congelados", "Artículos varios"
  ],
  PANADERIA: [
    "Panificados", "Pan", "Flautas", "Mignones", "Pan lactal", "Pan de hamburguesa", "Pan de pancho", "Facturas", "Medialunas",
    "Bizcochos", "Criollitos", "Grisines", "Tostadas", "Tortas", "Tartas dulces", "Masas finas", "Masas secas", "Budines", "Alfajores",
    "Muffins", "Brownies", "Galletitas", "Empanadas", "Tartas saladas", "Sandwiches", "Pizzas", "Prepizzas", "Comidas listas",
    "Lácteos", "Fiambres", "Bebidas", "Café", "Artículos varios"
  ]
};

export async function createSuggestedCategoriesForBusiness(
  tx: Prisma.TransactionClient,
  businessId: string,
  rubroKey: string
) {
  const categoryNames = BUSINESS_TEMPLATES[rubroKey];
  if (!categoryNames || categoryNames.length === 0) {
    return;
  }

  // 1. Fetch existing categories of the business to ensure idempotency
  const existingCategories = await tx.category.findMany({
    where: { businessId }
  });
  
  const existingSlugs = new Set(existingCategories.map(c => slugify(c.name)));
  const existingNamesLower = new Set(existingCategories.map(c => c.name.trim().toLowerCase()));

  const seenSlugsInBatch = new Set<string>();
  const seenNamesLowerInBatch = new Set<string>();

  for (const name of categoryNames) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    const slug = slugify(trimmed);
    const nameLower = trimmed.toLowerCase();

    // Check both within the batch we are creating and against already existing database entries
    if (
      existingSlugs.has(slug) || 
      seenSlugsInBatch.has(slug) ||
      existingNamesLower.has(nameLower) ||
      seenNamesLowerInBatch.has(nameLower)
    ) {
      continue;
    }

    seenSlugsInBatch.add(slug);
    seenNamesLowerInBatch.add(nameLower);

    await tx.category.create({
      data: {
        businessId,
        name: trimmed,
        active: true
      }
    });
  }
}
