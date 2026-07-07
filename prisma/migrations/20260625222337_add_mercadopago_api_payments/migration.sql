-- AlterTable
ALTER TABLE `Payment` ADD COLUMN `paymentAttemptId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `PaymentMethodSetting` ADD COLUMN `mercadoPagoMode` ENUM('MANUAL', 'API_QR') NOT NULL DEFAULT 'MANUAL';

-- CreateTable
CREATE TABLE `MercadoPagoAccount` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `environment` ENUM('SANDBOX', 'PRODUCTION') NOT NULL DEFAULT 'SANDBOX',
    `accessToken` TEXT NOT NULL,
    `publicKey` VARCHAR(191) NULL,
    `collectorId` VARCHAR(191) NULL,
    `externalPosId` VARCHAR(191) NULL,
    `defaultAccount` BOOLEAN NOT NULL DEFAULT false,
    `instructions` TEXT NULL,
    `enableAmountMatching` BOOLEAN NOT NULL DEFAULT false,
    `amountMatchingWindowMinutes` INTEGER NOT NULL DEFAULT 10,
    `amountMatchingTolerance` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `amountMatchingAutoApprove` BOOLEAN NOT NULL DEFAULT false,
    `showRecentMovements` BOOLEAN NOT NULL DEFAULT true,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `MercadoPagoAccount_enabled_deletedAt_idx`(`enabled`, `deletedAt`),
    INDEX `MercadoPagoAccount_defaultAccount_idx`(`defaultAccount`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PaymentAttempt` (
    `id` VARCHAR(191) NOT NULL,
    `saleId` VARCHAR(191) NULL,
    `method` ENUM('CASH', 'DEBIT', 'CREDIT', 'TRANSFER', 'MERCADOPAGO', 'CURRENT_ACCOUNT') NOT NULL DEFAULT 'MERCADOPAGO',
    `provider` ENUM('MERCADOPAGO') NOT NULL DEFAULT 'MERCADOPAGO',
    `mercadoPagoAccountId` VARCHAR(191) NOT NULL,
    `externalReference` VARCHAR(191) NOT NULL,
    `providerOrderId` VARCHAR(191) NULL,
    `providerPaymentId` VARCHAR(191) NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED', 'ERROR') NOT NULL DEFAULT 'PENDING',
    `origin` ENUM('QR_ORDER', 'AMOUNT_MATCH', 'MANUAL_REFERENCE') NOT NULL,
    `qrData` TEXT NULL,
    `checkoutUrl` VARCHAR(191) NULL,
    `rawStatus` VARCHAR(191) NULL,
    `rawStatusDetail` VARCHAR(191) NULL,
    `lastCheckedAt` DATETIME(3) NULL,
    `approvedAt` DATETIME(3) NULL,
    `associatedByUserId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PaymentAttempt_externalReference_key`(`externalReference`),
    INDEX `PaymentAttempt_saleId_idx`(`saleId`),
    INDEX `PaymentAttempt_mercadoPagoAccountId_idx`(`mercadoPagoAccountId`),
    INDEX `PaymentAttempt_providerOrderId_idx`(`providerOrderId`),
    INDEX `PaymentAttempt_providerPaymentId_idx`(`providerPaymentId`),
    INDEX `PaymentAttempt_status_idx`(`status`),
    INDEX `PaymentAttempt_origin_idx`(`origin`),
    INDEX `PaymentAttempt_createdAt_idx`(`createdAt`),
    INDEX `PaymentAttempt_associatedByUserId_idx`(`associatedByUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `Payment_paymentAttemptId_key` ON `Payment`(`paymentAttemptId`);

-- CreateIndex
CREATE INDEX `Payment_paymentAttemptId_idx` ON `Payment`(`paymentAttemptId`);

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_paymentAttemptId_fkey` FOREIGN KEY (`paymentAttemptId`) REFERENCES `PaymentAttempt`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaymentAttempt` ADD CONSTRAINT `PaymentAttempt_saleId_fkey` FOREIGN KEY (`saleId`) REFERENCES `Sale`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaymentAttempt` ADD CONSTRAINT `PaymentAttempt_mercadoPagoAccountId_fkey` FOREIGN KEY (`mercadoPagoAccountId`) REFERENCES `MercadoPagoAccount`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaymentAttempt` ADD CONSTRAINT `PaymentAttempt_associatedByUserId_fkey` FOREIGN KEY (`associatedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
