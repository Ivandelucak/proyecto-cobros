FROM node:20-alpine AS base

# Instalar dependencias necesarias para Prisma y optimizaciones Alpine
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Copiar configuración de dependencias
COPY package*.json ./
COPY prisma ./prisma/

# Instalar todas las dependencias
RUN npm install

# Copiar el resto del código de la aplicación
COPY . .

# Generar el cliente de Prisma para que esté listo en compilación
RUN npx prisma generate

# Compilar la aplicación Next.js para producción
RUN npm run build

# Exponer el puerto por defecto de Next.js
EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"
ENV NODE_ENV production

# Comando de inicio: ejecutar migraciones de Prisma pendientes y luego arrancar la aplicación
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
