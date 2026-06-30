-- AlterTable
ALTER TABLE `mercadopagoaccount` ADD COLUMN `externalStoreId` VARCHAR(191) NULL,
    ADD COLUMN `lastPosSetupAt` DATETIME(3) NULL,
    ADD COLUMN `lastPosSetupError` TEXT NULL,
    ADD COLUMN `lastPosSetupStatus` VARCHAR(191) NULL,
    ADD COLUMN `posCategory` VARCHAR(191) NULL,
    ADD COLUMN `posCreatedAt` DATETIME(3) NULL,
    ADD COLUMN `posId` VARCHAR(191) NULL,
    ADD COLUMN `posName` VARCHAR(191) NULL,
    ADD COLUMN `storeId` VARCHAR(191) NULL,
    ADD COLUMN `storeName` VARCHAR(191) NULL;
