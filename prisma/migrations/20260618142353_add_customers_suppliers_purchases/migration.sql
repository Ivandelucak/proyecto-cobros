-- AlterTable
ALTER TABLE `sale` ADD COLUMN `customerId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `Customer` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `document` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `address` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Customer_name_idx`(`name`),
    INDEX `Customer_document_idx`(`document`),
    INDEX `Customer_phone_idx`(`phone`),
    INDEX `Customer_active_deletedAt_idx`(`active`, `deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CustomerAccountMovement` (
    `id` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `saleId` VARCHAR(191) NULL,
    `type` ENUM('DEBIT', 'PAYMENT', 'ADJUSTMENT', 'SALE_CANCELLED') NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `previousBalance` DECIMAL(12, 2) NOT NULL,
    `newBalance` DECIMAL(12, 2) NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `paymentMethod` ENUM('CASH', 'DEBIT', 'CREDIT', 'TRANSFER', 'MERCADOPAGO', 'CURRENT_ACCOUNT') NULL,
    `userId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CustomerAccountMovement_customerId_idx`(`customerId`),
    INDEX `CustomerAccountMovement_saleId_idx`(`saleId`),
    INDEX `CustomerAccountMovement_type_idx`(`type`),
    INDEX `CustomerAccountMovement_userId_idx`(`userId`),
    INDEX `CustomerAccountMovement_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Supplier` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `cuit` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `address` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Supplier_name_idx`(`name`),
    INDEX `Supplier_cuit_idx`(`cuit`),
    INDEX `Supplier_phone_idx`(`phone`),
    INDEX `Supplier_active_idx`(`active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Purchase` (
    `id` VARCHAR(191) NOT NULL,
    `purchaseNumber` INTEGER NOT NULL AUTO_INCREMENT,
    `supplierId` VARCHAR(191) NULL,
    `userId` VARCHAR(191) NOT NULL,
    `total` DECIMAL(12, 2) NOT NULL,
    `notes` VARCHAR(191) NULL,
    `status` ENUM('RECEIVED', 'CANCELLED') NOT NULL DEFAULT 'RECEIVED',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Purchase_purchaseNumber_key`(`purchaseNumber`),
    INDEX `Purchase_supplierId_idx`(`supplierId`),
    INDEX `Purchase_userId_idx`(`userId`),
    INDEX `Purchase_status_idx`(`status`),
    INDEX `Purchase_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PurchaseItem` (
    `id` VARCHAR(191) NOT NULL,
    `purchaseId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `productNameSnapshot` VARCHAR(191) NOT NULL,
    `quantity` DECIMAL(12, 3) NOT NULL,
    `unitCost` DECIMAL(12, 2) NOT NULL,
    `subtotal` DECIMAL(12, 2) NOT NULL,

    INDEX `PurchaseItem_purchaseId_idx`(`purchaseId`),
    INDEX `PurchaseItem_productId_idx`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Sale_customerId_idx` ON `Sale`(`customerId`);

-- AddForeignKey
ALTER TABLE `Sale` ADD CONSTRAINT `Sale_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomerAccountMovement` ADD CONSTRAINT `CustomerAccountMovement_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomerAccountMovement` ADD CONSTRAINT `CustomerAccountMovement_saleId_fkey` FOREIGN KEY (`saleId`) REFERENCES `Sale`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomerAccountMovement` ADD CONSTRAINT `CustomerAccountMovement_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Purchase` ADD CONSTRAINT `Purchase_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `Supplier`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Purchase` ADD CONSTRAINT `Purchase_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseItem` ADD CONSTRAINT `PurchaseItem_purchaseId_fkey` FOREIGN KEY (`purchaseId`) REFERENCES `Purchase`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseItem` ADD CONSTRAINT `PurchaseItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
