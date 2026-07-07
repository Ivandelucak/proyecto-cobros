-- AlterTable
ALTER TABLE `User` ADD COLUMN `businessId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `BusinessProfile` ADD COLUMN `businessId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `PaymentMethodSetting` DROP PRIMARY KEY,
    ADD COLUMN `businessId` VARCHAR(191) NOT NULL,
    ADD PRIMARY KEY (`businessId`, `method`);

-- AlterTable
ALTER TABLE `MercadoPagoAccount` ADD COLUMN `businessId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `PrintSetting` ADD COLUMN `businessId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `TicketSetting` ADD COLUMN `businessId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `CashRegisterSetting` ADD COLUMN `businessId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `StockSetting` ADD COLUMN `businessId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `FiscalSetting` ADD COLUMN `businessId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `AuditLog` ADD COLUMN `businessId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `Category` ADD COLUMN `businessId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `Product` ADD COLUMN `businessId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `Customer` ADD COLUMN `businessId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `Quote` ADD COLUMN `businessId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `Sale` ADD COLUMN `businessId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `CashSession` ADD COLUMN `businessId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `PaymentAttempt` ADD COLUMN `businessId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `StockMovement` ADD COLUMN `businessId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `Supplier` ADD COLUMN `businessId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `Purchase` ADD COLUMN `businessId` VARCHAR(191) NOT NULL;

-- CreateTable
CREATE TABLE `Business` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `legalName` VARCHAR(191) NULL,
    `tradeName` VARCHAR(191) NULL,
    `taxId` VARCHAR(191) NULL,
    `fiscalCondition` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `address` VARCHAR(191) NULL,
    `logoUrl` VARCHAR(191) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `User_businessId_idx` ON `User`(`businessId`);

-- CreateIndex
CREATE UNIQUE INDEX `BusinessProfile_businessId_key` ON `BusinessProfile`(`businessId`);

-- CreateIndex
CREATE INDEX `MercadoPagoAccount_businessId_idx` ON `MercadoPagoAccount`(`businessId`);

-- CreateIndex
CREATE UNIQUE INDEX `PrintSetting_businessId_key` ON `PrintSetting`(`businessId`);

-- CreateIndex
CREATE UNIQUE INDEX `TicketSetting_businessId_key` ON `TicketSetting`(`businessId`);

-- CreateIndex
CREATE UNIQUE INDEX `CashRegisterSetting_businessId_key` ON `CashRegisterSetting`(`businessId`);

-- CreateIndex
CREATE UNIQUE INDEX `StockSetting_businessId_key` ON `StockSetting`(`businessId`);

-- CreateIndex
CREATE UNIQUE INDEX `FiscalSetting_businessId_key` ON `FiscalSetting`(`businessId`);

-- CreateIndex
CREATE INDEX `AuditLog_businessId_idx` ON `AuditLog`(`businessId`);

-- CreateIndex
CREATE INDEX `Category_businessId_idx` ON `Category`(`businessId`);

-- CreateIndex
CREATE UNIQUE INDEX `Category_businessId_name_key` ON `Category`(`businessId`, `name`);

-- CreateIndex
CREATE INDEX `Product_businessId_idx` ON `Product`(`businessId`);

-- CreateIndex
CREATE UNIQUE INDEX `Product_businessId_barcode_key` ON `Product`(`businessId`, `barcode`);

-- CreateIndex
CREATE UNIQUE INDEX `Product_businessId_sku_key` ON `Product`(`businessId`, `sku`);

-- CreateIndex
CREATE INDEX `Customer_businessId_idx` ON `Customer`(`businessId`);

-- CreateIndex
CREATE INDEX `Quote_businessId_idx` ON `Quote`(`businessId`);

-- CreateIndex
CREATE INDEX `Sale_businessId_idx` ON `Sale`(`businessId`);

-- CreateIndex
CREATE INDEX `CashSession_businessId_idx` ON `CashSession`(`businessId`);

-- CreateIndex
CREATE INDEX `PaymentAttempt_businessId_idx` ON `PaymentAttempt`(`businessId`);

-- CreateIndex
CREATE INDEX `StockMovement_businessId_idx` ON `StockMovement`(`businessId`);

-- CreateIndex
CREATE INDEX `Supplier_businessId_idx` ON `Supplier`(`businessId`);

-- CreateIndex
CREATE INDEX `Purchase_businessId_idx` ON `Purchase`(`businessId`);

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `Business`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BusinessProfile` ADD CONSTRAINT `BusinessProfile_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `Business`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaymentMethodSetting` ADD CONSTRAINT `PaymentMethodSetting_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `Business`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MercadoPagoAccount` ADD CONSTRAINT `MercadoPagoAccount_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `Business`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PrintSetting` ADD CONSTRAINT `PrintSetting_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `Business`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketSetting` ADD CONSTRAINT `TicketSetting_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `Business`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CashRegisterSetting` ADD CONSTRAINT `CashRegisterSetting_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `Business`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockSetting` ADD CONSTRAINT `StockSetting_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `Business`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FiscalSetting` ADD CONSTRAINT `FiscalSetting_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `Business`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `Business`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Category` ADD CONSTRAINT `Category_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `Business`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `Business`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Customer` ADD CONSTRAINT `Customer_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `Business`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Quote` ADD CONSTRAINT `Quote_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `Business`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Sale` ADD CONSTRAINT `Sale_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `Business`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CashSession` ADD CONSTRAINT `CashSession_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `Business`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaymentAttempt` ADD CONSTRAINT `PaymentAttempt_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `Business`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockMovement` ADD CONSTRAINT `StockMovement_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `Business`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Supplier` ADD CONSTRAINT `Supplier_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `Business`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Purchase` ADD CONSTRAINT `Purchase_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `Business`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

