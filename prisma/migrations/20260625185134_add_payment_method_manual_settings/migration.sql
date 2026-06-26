-- AlterTable
ALTER TABLE `paymentmethodsetting` ADD COLUMN `accountCuit` VARCHAR(191) NULL,
    ADD COLUMN `accountHolder` VARCHAR(191) NULL,
    ADD COLUMN `alias` VARCHAR(191) NULL,
    ADD COLUMN `askReference` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `bankName` VARCHAR(191) NULL,
    ADD COLUMN `cbu` VARCHAR(191) NULL,
    ADD COLUMN `cvu` VARCHAR(191) NULL,
    ADD COLUMN `defaultProviderStatus` VARCHAR(191) NULL,
    ADD COLUMN `fixedSurcharge` DECIMAL(12, 2) NULL,
    ADD COLUMN `instructions` TEXT NULL,
    ADD COLUMN `qrImageDataUrl` LONGTEXT NULL,
    ADD COLUMN `surchargeRate` DECIMAL(5, 2) NULL;
