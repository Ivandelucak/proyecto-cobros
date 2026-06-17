Quiero crear desde cero un sistema POS universal para comercios minoristas, usando Next.js App Router, TypeScript, Tailwind CSS, Prisma y MySQL.

El sistema debe estar pensado para Windows a futuro, pero NO implementar Electron todavía. Primero quiero que funcione perfecto como aplicación web local en navegador.

Nombre conceptual del producto:
POS Universal

Objetivo principal:
Crear un MVP limpio, simple, profesional y extensible para cobrar ventas, manejar productos, stock, categorías, medios de pago e importación/exportación Excel.

El sistema debe estar orientado a comercios como:

- Kioscos
- Almacenes
- Minimercados
- Carnicerías
- Verdulerías
- Tiendas de bebidas
- Ferreterías
- Tiendas de mascotas
- Librerías
- Tiendas de ropa
- Bazares
- Comercios minoristas similares

Aunque debe ser universal, el seed inicial debe estar más enfocado a kioscos, almacenes, minimercados y tiendas de bebidas.

Stack obligatorio:

- Next.js App Router
- TypeScript
- Tailwind CSS
- Prisma
- MySQL
- React
- Server Actions o Route Handlers según convenga
- Tema claro/oscuro
- Diseño desktop-first, pensado para pantallas de caja de 1366x768 o similares

No generar:

- Electron
- Instalador
- Integración real con ARCA
- Integración real con MercadoPago
- IA
- Dashboard recargado
- Gráficos complejos
- Landing pública
- shadcn/ui, salvo que sea realmente necesario
- Librerías innecesarias
- Funcionalidades que no estén pedidas

Prioridad de experiencia:
La pantalla más importante es la caja.
El cajero debe poder vender rápido, sin distracciones.
La UI debe ser simple, clara y moderna, pero no básica.
Evitar interfaces cargadas con demasiados botones, accesos o información en pantalla.
Todo lo administrativo debe quedar separado del flujo de caja.

Roles:
Crear dos roles:

1. ADMIN
2. CASHIER

Permisos:
ADMIN puede:

- Acceder al panel admin
- Crear, editar y desactivar productos
- Cambiar precios
- Modificar stock
- Ver ventas
- Ver reportes básicos
- Gestionar categorías
- Importar productos desde Excel
- Exportar productos a Excel
- Ver configuración
- Ver medios de pago discriminados

CASHIER puede:

- Acceder directamente a /caja
- Buscar productos
- Escanear código de barras
- Agregar productos al carrito
- Cambiar cantidades en una venta
- Cobrar
- Seleccionar medio/s de pago
- Imprimir/ver ticket no fiscal
- No puede crear productos
- No puede cambiar precios
- No puede modificar stock manualmente
- No puede importar/exportar Excel
- No puede acceder a reportes administrativos

La validación de permisos debe estar en servidor, no solo escondiendo botones en la UI.

Autenticación:
Crear login simple en /login.
Usar email y contraseña hasheada.
No usar NextAuth si no es necesario.
Usar una autenticación liviana con cookie httpOnly segura.
Redirigir según rol:

- ADMIN → /admin
- CASHIER → /caja

Usuarios seed:

- [admin@local.com](mailto:admin@local.com) / admin123 / ADMIN
- [cajero@local.com](mailto:cajero@local.com) / cajero123 / CASHIER

Tema claro/oscuro:
Implementar botón para alternar modo claro y modo oscuro.
El modo debe persistir.
Diseño sugerido:
Modo claro:

- fondo gris claro
- cards blancas
- bordes suaves
- texto oscuro
  Modo oscuro:
- fondo casi negro
- cards gris oscuro
- bordes sutiles
- texto claro
  Color principal:
- verde o azul moderado
  Evitar colores chillones.

Layout:
ADMIN:

- Sidebar simple
- Header superior simple
- Accesos:
  - Caja
  - Productos
  - Categorías
  - Stock
  - Ventas
  - Reportes
  - Configuración

CASHIER:

- Interfaz limpia
- Sin sidebar invasivo
- Acceso directo a caja
- Header mínimo con nombre de usuario, rol, tema y cerrar sesión

Pantalla /caja:
Crear pantalla de venta rápida con una sola vista principal.

Debe tener:

- Input grande con autofocus: “Escanear código o buscar producto”
- Búsqueda por código de barras, SKU o nombre
- Si el usuario escanea y presiona Enter, agregar automáticamente el producto si hay coincidencia exacta
- Lista de ítems del carrito
- Producto
- Cantidad
- Precio unitario
- Subtotal
- Botón quitar
- Opción para cambiar cantidad
- Total grande y muy visible
- Medio/s de pago
- Monto recibido si el pago es efectivo
- Cálculo de vuelto
- Botón “Finalizar venta”
- Botón “Cancelar venta”

La caja debe soportar:

- Producto por unidad
- Producto por peso
- Producto con cantidad decimal
- Producto sin código de barras, buscado por nombre
- Venta con un solo medio de pago
- Venta con múltiples medios de pago

Ejemplo de venta mixta:
Total: $12.000
Pagos:

- Efectivo: $5.000
- Débito: $3.000
- MercadoPago: $4.000

Atajos visuales sugeridos:

- F1 Buscar
- F2 Cantidad
- F4 Cobrar
- Esc Cancelar

No hace falta implementar todos los atajos funcionales todavía, pero mostrar la idea visualmente.

Productos:
Crear sección /productos para ADMIN.

Campos del producto:

- id
- name
- barcode opcional
- sku opcional
- brand opcional
- categoryId
- salePrice
- cost opcional
- stock
- minStock
- unitType
- allowsDecimalQuantity
- active
- deletedAt opcional para baja lógica
- createdAt
- updatedAt

Unidades:
Crear enum UnitType:

- UNIT
- KG
- GR
- LITER
- METER
- PACK
- BOX
- OTHER

Reglas:

- barcode puede ser null porque muchos productos no tienen código
- sku puede ser null
- si barcode existe, debe ser único
- si sku existe, debe ser único
- permitir stock decimal para productos por peso
- usar Decimal en Prisma para precios, stock y cantidades
- los productos no se borran físicamente, se desactivan o se usa deletedAt

Categorías:
Crear sección /categorias para ADMIN.
CRUD básico:

- crear categoría
- editar categoría
- activar/desactivar categoría
- no borrar físicamente si tiene productos asociados

El modelo debe permitir subcategorías a futuro.
Usar parentId opcional en Category, aunque en la UI inicial puede manejarse como lista simple.

Seed de categorías iniciales.
Deben ser bastantes categorías, con foco fuerte en kiosco/almacén/minimercado/bebidas, pero incluyendo otros rubros.

Categorías seed:

Kiosco / almacén / minimercado:

- Almacén
- Bebidas
- Gaseosas
- Aguas
- Jugos
- Energizantes
- Cervezas
- Vinos
- Aperitivos
- Golosinas
- Alfajores
- Chocolates
- Caramelos
- Chicles
- Galletitas
- Snacks
- Cigarrillos
- Encendedores y accesorios
- Lácteos
- Panadería
- Fiambres
- Quesos
- Congelados
- Conservas
- Pastas
- Arroz y legumbres
- Harinas
- Aceites y vinagres
- Aderezos
- Salsas
- Infusiones
- Yerbas
- Café
- Té
- Azúcar y endulzantes
- Limpieza
- Perfumería
- Higiene personal
- Descartables
- Pilas
- Varios

Otros rubros:

- Carnicería
- Verdulería
- Frutas
- Verduras
- Panchos y comidas rápidas
- Ferretería
- Herramientas
- Tornillería
- Electricidad
- Plomería
- Pinturería
- Mascotas
- Alimentos para mascotas
- Accesorios para mascotas
- Librería
- Papelería
- Útiles escolares
- Indumentaria
- Calzado
- Accesorios de ropa
- Bazar
- Cocina
- Hogar
- Regalería
- Otros

Rubros del negocio:
Crear enum BusinessType:

- KIOSK
- GROCERY
- SUPERMARKET
- BUTCHER
- GREENGROCER
- BEVERAGE_STORE
- HARDWARE_STORE
- PET_SHOP
- BOOKSTORE
- CLOTHING_STORE
- BAZAAR
- OTHER

Configuración del negocio:
Crear modelo BusinessProfile o AppSetting que permita guardar:

- nombre del comercio
- rubro principal
- CUIT opcional
- dirección opcional
- teléfono opcional
- moneda, por defecto ARS
- tema preferido opcional
- logoUrl opcional futuro

Crear pantalla /configuracion simple para ADMIN.
No hacer configuración compleja todavía.

Ventas:
Crear modelos:

- Sale
- SaleItem
- Payment

Sale:

- id
- total
- subtotal
- discountTotal
- surchargeTotal
- status
- userId
- createdAt
- updatedAt

SaleStatus:

- PAID
- CANCELLED

SaleItem:

- saleId
- productId
- productNameSnapshot
- unitPrice
- quantity
- subtotal
- unitTypeSnapshot

Importante:
Guardar snapshots de nombre, precio y unidad en SaleItem para que si luego cambia el producto, la venta histórica no se rompa.

Payment:
Una venta puede tener uno o varios pagos.

PaymentMethod:

- CASH
- DEBIT
- CREDIT
- TRANSFER
- MERCADOPAGO
- CURRENT_ACCOUNT

Payment:

- id
- saleId
- method
- amount
- externalId opcional
- externalReference opcional
- providerStatus opcional
- createdAt

MercadoPago:
Por ahora MercadoPago debe ser solo un método manual.
NO integrar API real.
Pero dejar la estructura preparada con:

- externalId
- externalReference
- providerStatus

Stock:
Crear modelo StockMovement.

StockMovementType:

- SALE
- MANUAL_ADJUSTMENT
- PURCHASE
- WASTE
- INITIAL_IMPORT

Cuando se confirma una venta:

- crear Sale
- crear SaleItems
- crear Payments
- descontar stock
- crear StockMovement por cada producto vendido

Esto debe hacerse en una transacción de Prisma.
Si falla algo, no debe quedar la venta a medias.

Crear sección /stock para ADMIN:

- listado de productos con stock actual
- filtro por stock bajo
- ajuste manual simple de stock
- historial básico de movimientos

Si se modifica stock manualmente:

- registrar StockMovement
- guardar userId

Reportes básicos:
Crear sección /reportes simple para ADMIN.
No usar gráficos complejos.

Mostrar:

- ventas del día
- total vendido
- ventas por medio de pago
- cantidad de ventas
- productos con stock bajo
- productos más vendidos, listado simple

Discriminación por medio de pago:
Debe quedar claro cuánto se vendió/cobró por:

- efectivo
- débito
- crédito
- transferencia
- MercadoPago
- cuenta corriente

Ventas /ventas:
Crear listado de ventas para ADMIN:

- fecha
- número de venta
- total
- vendedor
- estado
- medios de pago usados
- botón para ver detalle

Detalle de venta:

- productos
- cantidades
- precios
- pagos
- total
- estado
- botón para ver ticket

Ticket informal:
Al confirmar una venta, crear una vista simple de ticket imprimible.
No implementar impresora real todavía.

El ticket debe mostrar:

- nombre del comercio
- fecha
- número de venta
- vendedor
- productos
- cantidades
- precios
- total
- medios de pago
- vuelto si corresponde
- texto “Ticket no fiscal”

Crear una ruta o componente reutilizable:

- /ventas/[id]/ticket
  o similar.

ARCA:
NO implementar integración real con ARCA todavía.
Pero preparar estructura futura.

Crear carpeta:

- src/lib/fiscal/

Crear archivos:

- fiscal-types.ts
- arca-service.ts

Estos archivos deben tener tipos y placeholders simples, sin lógica real.

Ejemplo:

- FiscalDocumentType
- FiscalIssueResult
- issueFiscalDocumentPlaceholder()

No conectar esto a la caja todavía.
No crear pantallas complejas de ARCA.

Importador Excel:
Implementar en el MVP una sección /productos/importar solo para ADMIN.

Usar librería xlsx.

Debe permitir:

- subir archivo .xlsx
- leer productos
- mostrar preview antes de importar
- validar errores
- confirmar importación
- crear productos nuevos
- actualizar productos existentes
- crear categorías automáticamente si no existen
- no borrar productos existentes
- mostrar resumen final

Columnas aceptadas:

- nombre
- codigo_barras
- sku
- categoria
- marca
- precio_venta
- costo
- stock
- stock_minimo
- unidad
- activo

Reglas de importación:

- Si codigo_barras existe y coincide con un producto, actualizar ese producto
- Si no hay codigo_barras pero hay sku y coincide con un producto, actualizar ese producto
- Si no existe coincidencia, crear producto nuevo
- Si la categoría no existe, crearla automáticamente
- Nunca eliminar productos existentes por importar Excel
- Si se modifica stock, registrar StockMovement tipo INITIAL_IMPORT o MANUAL_ADJUSTMENT según corresponda
- Validar precios numéricos
- Validar stock numérico
- Aceptar valores con coma decimal y punto decimal
- Limpiar símbolos como $ y separadores de miles cuando sea posible
- Permitir cantidades decimales
- Si hay filas inválidas, mostrarlas con el motivo del error
- El usuario debe poder revisar antes de confirmar

Exportador Excel:
Agregar botón “Exportar productos” en /productos.
Debe generar archivo .xlsx con productos activos.

Columnas exportadas:

- nombre
- codigo_barras
- sku
- categoria
- marca
- precio_venta
- costo
- stock
- stock_minimo
- unidad
- activo

Esto sirve como backup y para migrar datos desde/hacia otros sistemas.

Seed de productos:
Crear productos de ejemplo que cubran unidades y rubros distintos:

- Coca Cola 2.25L, unidad
- Alfajor simple, unidad
- Yerba mate 1kg, unidad
- Pan por kg, kg, permite decimal
- Banana por kg, kg, permite decimal
- Detergente, unidad
- Agua mineral 2L, unidad
- Cerveza lata, unidad
- Tornillos por unidad, unidad
- Alimento para perro 15kg, unidad
- Cuaderno universitario, unidad

Diseño:
Debe verse moderno, simple y serio.
No debe parecer un panel genérico lleno de botones.
No debe parecer una landing.
No usar colores excesivos.
No usar animaciones innecesarias.
En caja, los números importantes deben ser grandes:

- total
- monto recibido
- vuelto

Componentes sugeridos:

- Button
- Input
- Card
- Badge
- Modal simple
- Table
- ThemeToggle
- CurrencyText

No agregar librerías de UI grandes si no hacen falta.
Se puede usar CSS/Tailwind propio.

Formato moneda:
Mostrar valores como pesos argentinos ARS.
Ejemplo:
$ 12.500,00

Base de datos Prisma:
Crear schema.prisma con modelos:

- User
- BusinessProfile o AppSetting
- Category
- Product
- Sale
- SaleItem
- Payment
- StockMovement

Enums:

- Role
- BusinessType
- UnitType
- PaymentMethod
- SaleStatus
- StockMovementType

También crear:

- src/lib/prisma.ts
- src/lib/auth.ts
- src/lib/permissions.ts
- src/lib/sale-engine.ts
- src/lib/stock-engine.ts
- src/lib/money.ts
- src/lib/excel/products-import.ts
- src/lib/excel/products-export.ts
- src/lib/fiscal/fiscal-types.ts
- src/lib/fiscal/arca-service.ts

Lógica de venta:
Separar la lógica de confirmar venta en src/lib/sale-engine.ts.
No mezclar toda la lógica dentro del componente de React.
La confirmación de venta debe:

1. validar usuario
2. validar productos
3. validar stock
4. calcular totales
5. crear venta
6. crear ítems
7. crear pagos
8. descontar stock
9. registrar movimientos de stock
10. devolver venta creada

Lógica de stock:
Separar ajustes de stock en src/lib/stock-engine.ts.

Seguridad:

- No confiar en precios enviados desde el frontend para confirmar la venta
- Al confirmar la venta, recalcular precios desde base de datos
- Validar permisos en servidor
- El cajero no puede modificar precios ni stock aunque intente llamar endpoints directamente

Rutas principales:

- /login
- /caja
- /admin
- /productos
- /productos/nuevo
- /productos/[id]/editar
- /productos/importar
- /categorias
- /stock
- /ventas
- /ventas/[id]
- /ventas/[id]/ticket
- /reportes
- /configuracion

Si alguna ruta secundaria complica mucho, priorizar:

1. login
2. caja
3. productos
4. categorias
5. import/export Excel
6. ventas
7. stock
8. reportes básicos

Archivo .env.example:
Incluir:
DATABASE_URL="mysql://root:password@localhost:3306/pos_universal"
AUTH_SECRET="change-me"

Instrucciones:
Crear README.md con:

- instalación
- configuración MySQL
- creación de base de datos
- migraciones Prisma
- seed
- comando dev

Comandos esperados:
npm install
npx prisma migrate dev
npx prisma db seed
npm run dev

Base de datos sugerida:
CREATE DATABASE pos_universal;

Restricciones finales:

- No generar funciones innecesarias
- No duplicar modelos
- No crear dashboards complejos
- No implementar ARCA real
- No implementar MercadoPago real
- No implementar Electron
- No agregar IA
- No agregar gráficos avanzados
- Priorizar MVP funcional, limpio y extensible
- Priorizar claridad de código
- Priorizar experiencia rápida de caja
- Cada pantalla debe mostrar únicamente la información necesaria para completar la tarea

Al finalizar:

- Mostrar resumen de archivos creados
- Mostrar comandos para correr el proyecto
- Indicar credenciales seed
- Indicar qué quedó preparado para futuro pero no implementado
