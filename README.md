# POS Universal

MVP local para comercios minoristas. Esta etapa deja lista la base tecnica:
Next.js App Router, TypeScript, Tailwind CSS, Prisma, MySQL, modelos completos y seed inicial.

No incluye todavia la UI completa de caja, importador Excel, reportes ni ticket.

## Requisitos

- Node.js 20 o superior
- MySQL 8 o superior
- npm

## Instalacion

```bash
npm install
```

## Configuracion

Copiar `.env.example` a `.env` y ajustar la conexion:

```env
DATABASE_URL="mysql://root:password@localhost:3306/pos_universal"
AUTH_SECRET="change-me"
```

Crear la base de datos en MySQL:

```sql
CREATE DATABASE pos_universal;
```

## Prisma

Crear y aplicar la migracion:

```bash
npx prisma migrate dev
```

Cargar datos iniciales:

```bash
npx prisma db seed
```

## Desarrollo

```bash
npm run dev
```

Abrir:

```text
http://localhost:3000
```

## Rutas disponibles en esta etapa

- `/login`
- `/admin`
- `/caja`
- `/productos`
- `/productos/importar`
- `/categorias`
- `/stock`
- `/ventas`
- `/reportes`
- `/configuracion`

## Credenciales seed

| Email | Password | Rol |
| --- | --- | --- |
| admin@local.com | admin123 | ADMIN |
| cajero@local.com | cajero123 | CASHIER |

## Preparado para etapas siguientes

- Autenticacion liviana con cookie httpOnly firmada.
- Permisos de servidor para ADMIN y CASHIER.
- Layout protegido para ADMIN y layout mínimo para caja.
- Tema claro/oscuro persistido en navegador.
- Motor de venta transaccional en `src/lib/sale-engine.ts`.
- Ajuste manual de stock en `src/lib/stock-engine.ts`.
- Parser/exportador base de productos Excel con `xlsx`.
- Placeholders fiscales en `src/lib/fiscal/` para integracion futura con ARCA.
- MercadoPago queda modelado como medio de pago manual, sin API real.
