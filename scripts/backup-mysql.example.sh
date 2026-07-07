#!/bin/bash

# ==============================================================================
# SCRIPT DE COPIA DE SEGURIDAD PARA BASE DE DATOS MYSQL (FOX POINT)
# ==============================================================================
# Este script realiza un volcado (dump) de la base de datos de Fox Point,
# lo comprime con gzip y conserva únicamente los últimos N días de backups.
#
# Instrucciones de uso en producción:
# 1. Configurar los valores de las variables de entorno o editarlas a continuación.
# 2. Asignar permisos de ejecución: chmod +x backup-mysql.sh
# 3. Registrar el script en cron (ej: crontab -e) para correr diariamente:
#    0 3 * * * /ruta/al/script/backup-mysql.sh >> /ruta/al/script/backup.log 2>&1
# ==============================================================================

# Nombre de la base de datos
DB_NAME=${DB_NAME:-"pos_universal"}
# Usuario de base de datos
DB_USER=${DB_USER:-"app_user"}
# Contraseña de base de datos
DB_PASS=${DB_PASS:-"password_seguro_db_2026"}
# Host de base de datos (si corre en Docker Compose, suele ser 'localhost' mapeado o la IP local)
DB_HOST=${DB_HOST:-"127.0.0.1"}
# Puerto de base de datos
DB_PORT=${DB_PORT:-"3306"}

# Directorio donde se guardarán los backups
BACKUP_DIR=${BACKUP_DIR:-"/var/backups/foxpoint"}
# Cantidad de días a retener los backups locales
RETENTION_DAYS=30

# Crear el directorio si no existe
mkdir -p "$BACKUP_DIR"

# Timestamp para el nombre del archivo
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_backup_$TIMESTAMP.sql.gz"

echo "[$(date)] Iniciando backup de la base de datos: $DB_NAME..."

# Realizar el dump y comprimir en una sola línea
mysqldump -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" \
  --single-transaction \
  --quick \
  --lock-tables=false \
  "$DB_NAME" | gzip > "$BACKUP_FILE"

# Validar si el comando terminó exitosamente
if [ ${PIPESTATUS[0]} -eq 0 ]; then
  echo "[$(date)] Backup completado con éxito: $BACKUP_FILE"
  
  # ============================================================================
  # SUGERENCIA DE PRODUCCIÓN:
  # Se recomienda subir el archivo a un almacenamiento en la nube externo
  # (por ejemplo AWS S3, Google Cloud Storage, Dropbox, etc.) para mayor seguridad.
  # Ejemplo usando AWS CLI:
  # aws s3 cp "$BACKUP_FILE" "s3://tu-bucket-de-backups/foxpoint/"
  # ============================================================================
else
  echo "[$(date)] ERROR: Falló la creación del backup para $DB_NAME"
  exit 1
fi

# Eliminar backups locales más antiguos que la cantidad de días configurada
echo "[$(date)] Limpiando backups locales de más de $RETENTION_DAYS días de antigüedad..."
find "$BACKUP_DIR" -name "${DB_NAME}_backup_*.sql.gz" -mtime +$RETENTION_DAYS -exec rm {} \;

echo "[$(date)] Proceso de backup finalizado."
exit 0
