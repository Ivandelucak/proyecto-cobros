-- AlterTable
ALTER TABLE `FiscalSetting` ADD COLUMN `arcaCertificatePem` TEXT NULL,
    ADD COLUMN `arcaLastConnectionStatus` VARCHAR(191) NULL,
    ADD COLUMN `arcaLastConnectionTestAt` DATETIME(3) NULL,
    ADD COLUMN `arcaLastError` TEXT NULL,
    ADD COLUMN `arcaLastWsfeStatus` VARCHAR(191) NULL,
    ADD COLUMN `arcaLastWsfeTestAt` DATETIME(3) NULL,
    ADD COLUMN `arcaPrivateKeyPem` TEXT NULL,
    ADD COLUMN `arcaTokenExpiresAt` DATETIME(3) NULL,
    ADD COLUMN `arcaWsaaSign` TEXT NULL,
    ADD COLUMN `arcaWsaaToken` TEXT NULL;
