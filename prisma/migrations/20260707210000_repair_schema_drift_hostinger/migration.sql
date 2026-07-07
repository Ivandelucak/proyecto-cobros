-- DropIndex
DROP INDEX `Category_name_key` ON `Category`;

-- DropIndex
DROP INDEX `Product_barcode_key` ON `Product`;

-- DropIndex
DROP INDEX `Product_sku_key` ON `Product`;

-- AlterTable
ALTER TABLE `FiscalDocument` MODIFY `errorMessage` TEXT NULL;

-- AlterTable
ALTER TABLE `FiscalEvent` MODIFY `message` TEXT NOT NULL;

-- AlterTable
ALTER TABLE `Sale` MODIFY `fiscalFailureReason` TEXT NULL;

-- AlterTable
ALTER TABLE `SaleItem` ADD COLUMN `isManual` BOOLEAN NOT NULL DEFAULT false,
    MODIFY `productId` VARCHAR(191) NULL;
