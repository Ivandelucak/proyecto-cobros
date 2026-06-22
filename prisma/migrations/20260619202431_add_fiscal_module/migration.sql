-- AlterTable
ALTER TABLE `Customer`
    ADD COLUMN `fiscalCondition` ENUM('CONSUMIDOR_FINAL', 'RESPONSABLE_INSCRIPTO', 'MONOTRIBUTO', 'EXENTO', 'NO_RESPONSABLE', 'EXTERIOR', 'OTHER') NULL,
    ADD COLUMN `docType` ENUM('DNI', 'CUIT', 'CUIL', 'CDI', 'PASAPORTE', 'CONSUMIDOR_FINAL', 'OTHER') NULL,
    ADD COLUMN `docNumber` VARCHAR(191) NULL,
    ADD COLUMN `businessName` VARCHAR(191) NULL,
    ADD COLUMN `taxAddress` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Sale`
    ADD COLUMN `requiresFiscalInvoice` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `fiscalStatus` ENUM('NOT_REQUESTED', 'PENDING', 'READY_TO_ISSUE', 'ISSUED', 'FAILED', 'CANCELLED_BEFORE_ISSUE', 'CREDIT_NOTE_REQUIRED', 'CANCELLED_BY_CREDIT_NOTE') NOT NULL DEFAULT 'NOT_REQUESTED',
    ADD COLUMN `fiscalRequestedAt` DATETIME(3) NULL,
    ADD COLUMN `fiscalIssuedAt` DATETIME(3) NULL,
    ADD COLUMN `fiscalCancelledAt` DATETIME(3) NULL,
    ADD COLUMN `fiscalFailureReason` VARCHAR(191) NULL,
    ADD COLUMN `fiscalDocumentId` VARCHAR(191) NULL,
    ADD COLUMN `fiscalCustomerNameSnapshot` VARCHAR(191) NULL,
    ADD COLUMN `fiscalCustomerDocType` ENUM('DNI', 'CUIT', 'CUIL', 'CDI', 'PASAPORTE', 'CONSUMIDOR_FINAL', 'OTHER') NULL,
    ADD COLUMN `fiscalCustomerDocNumber` VARCHAR(191) NULL,
    ADD COLUMN `fiscalCustomerCondition` ENUM('CONSUMIDOR_FINAL', 'RESPONSABLE_INSCRIPTO', 'MONOTRIBUTO', 'EXENTO', 'NO_RESPONSABLE', 'EXTERIOR', 'OTHER') NULL,
    ADD COLUMN `fiscalNotes` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `FiscalSetting` (
    `id` VARCHAR(191) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT false,
    `environment` ENUM('HOMOLOGACION', 'PRODUCCION') NOT NULL DEFAULT 'HOMOLOGACION',
    `cuit` VARCHAR(191) NULL,
    `legalName` VARCHAR(191) NULL,
    `fiscalCondition` ENUM('CONSUMIDOR_FINAL', 'RESPONSABLE_INSCRIPTO', 'MONOTRIBUTO', 'EXENTO', 'NO_RESPONSABLE', 'EXTERIOR', 'OTHER') NULL,
    `pointOfSale` INTEGER NULL,
    `defaultInvoiceLetter` ENUM('A', 'B', 'C', 'M', 'E') NULL,
    `cashIssueMode` ENUM('ASK', 'AUTO', 'NEVER') NOT NULL DEFAULT 'ASK',
    `electronicPaymentIssueMode` ENUM('ASK', 'AUTO', 'NEVER') NOT NULL DEFAULT 'AUTO',
    `currentAccountIssueMode` ENUM('ASK', 'AUTO', 'NEVER') NOT NULL DEFAULT 'ASK',
    `pendingWarningMinutes` INTEGER NOT NULL DEFAULT 30,
    `pendingCriticalMinutes` INTEGER NOT NULL DEFAULT 120,
    `allowCancelBeforeIssue` BOOLEAN NOT NULL DEFAULT true,
    `requireCustomerForInvoiceA` BOOLEAN NOT NULL DEFAULT true,
    `defaultCustomerDocType` ENUM('DNI', 'CUIT', 'CUIL', 'CDI', 'PASAPORTE', 'CONSUMIDOR_FINAL', 'OTHER') NOT NULL DEFAULT 'CONSUMIDOR_FINAL',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FiscalDocument` (
    `id` VARCHAR(191) NOT NULL,
    `saleId` VARCHAR(191) NULL,
    `type` ENUM('INVOICE', 'CREDIT_NOTE', 'DEBIT_NOTE') NOT NULL,
    `letter` ENUM('A', 'B', 'C', 'M', 'E') NOT NULL,
    `status` ENUM('DRAFT', 'PENDING', 'ISSUED', 'FAILED', 'CANCELLED', 'CREDIT_NOTE_PENDING', 'CREDIT_NOTE_ISSUED') NOT NULL DEFAULT 'DRAFT',
    `environment` ENUM('HOMOLOGACION', 'PRODUCCION') NOT NULL DEFAULT 'HOMOLOGACION',
    `pointOfSale` INTEGER NULL,
    `number` INTEGER NULL,
    `cae` VARCHAR(191) NULL,
    `caeDueDate` DATETIME(3) NULL,
    `issueDate` DATETIME(3) NULL,
    `total` DECIMAL(12, 2) NOT NULL,
    `netAmount` DECIMAL(12, 2) NULL,
    `vatAmount` DECIMAL(12, 2) NULL,
    `exemptAmount` DECIMAL(12, 2) NULL,
    `nonTaxedAmount` DECIMAL(12, 2) NULL,
    `customerName` VARCHAR(191) NULL,
    `customerDocType` ENUM('DNI', 'CUIT', 'CUIL', 'CDI', 'PASAPORTE', 'CONSUMIDOR_FINAL', 'OTHER') NULL,
    `customerDocNumber` VARCHAR(191) NULL,
    `customerCondition` ENUM('CONSUMIDOR_FINAL', 'RESPONSABLE_INSCRIPTO', 'MONOTRIBUTO', 'EXENTO', 'NO_RESPONSABLE', 'EXTERIOR', 'OTHER') NULL,
    `relatedFiscalDocumentId` VARCHAR(191) NULL,
    `requestJson` JSON NULL,
    `responseJson` JSON NULL,
    `errorMessage` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FiscalDocumentItem` (
    `id` VARCHAR(191) NOT NULL,
    `fiscalDocumentId` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `quantity` DECIMAL(12, 3) NOT NULL,
    `unitPrice` DECIMAL(12, 2) NOT NULL,
    `subtotal` DECIMAL(12, 2) NOT NULL,
    `vatRate` DECIMAL(5, 2) NULL,
    `taxCode` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FiscalEvent` (
    `id` VARCHAR(191) NOT NULL,
    `saleId` VARCHAR(191) NULL,
    `fiscalDocumentId` VARCHAR(191) NULL,
    `type` VARCHAR(191) NOT NULL,
    `message` VARCHAR(191) NOT NULL,
    `metadata` JSON NULL,
    `userId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `Sale_fiscalDocumentId_key` ON `Sale`(`fiscalDocumentId`);
CREATE INDEX `Sale_fiscalStatus_idx` ON `Sale`(`fiscalStatus`);
CREATE INDEX `Sale_requiresFiscalInvoice_idx` ON `Sale`(`requiresFiscalInvoice`);
CREATE INDEX `FiscalDocument_saleId_idx` ON `FiscalDocument`(`saleId`);
CREATE INDEX `FiscalDocument_status_idx` ON `FiscalDocument`(`status`);
CREATE INDEX `FiscalDocument_type_idx` ON `FiscalDocument`(`type`);
CREATE INDEX `FiscalDocument_createdAt_idx` ON `FiscalDocument`(`createdAt`);
CREATE INDEX `FiscalDocument_relatedFiscalDocumentId_idx` ON `FiscalDocument`(`relatedFiscalDocumentId`);
CREATE INDEX `FiscalDocumentItem_fiscalDocumentId_idx` ON `FiscalDocumentItem`(`fiscalDocumentId`);
CREATE INDEX `FiscalEvent_saleId_idx` ON `FiscalEvent`(`saleId`);
CREATE INDEX `FiscalEvent_fiscalDocumentId_idx` ON `FiscalEvent`(`fiscalDocumentId`);
CREATE INDEX `FiscalEvent_userId_idx` ON `FiscalEvent`(`userId`);
CREATE INDEX `FiscalEvent_type_idx` ON `FiscalEvent`(`type`);
CREATE INDEX `FiscalEvent_createdAt_idx` ON `FiscalEvent`(`createdAt`);

-- AddForeignKey
ALTER TABLE `Sale` ADD CONSTRAINT `Sale_fiscalDocumentId_fkey` FOREIGN KEY (`fiscalDocumentId`) REFERENCES `FiscalDocument`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `FiscalDocument` ADD CONSTRAINT `FiscalDocument_saleId_fkey` FOREIGN KEY (`saleId`) REFERENCES `Sale`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `FiscalDocument` ADD CONSTRAINT `FiscalDocument_relatedFiscalDocumentId_fkey` FOREIGN KEY (`relatedFiscalDocumentId`) REFERENCES `FiscalDocument`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `FiscalDocumentItem` ADD CONSTRAINT `FiscalDocumentItem_fiscalDocumentId_fkey` FOREIGN KEY (`fiscalDocumentId`) REFERENCES `FiscalDocument`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `FiscalEvent` ADD CONSTRAINT `FiscalEvent_saleId_fkey` FOREIGN KEY (`saleId`) REFERENCES `Sale`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `FiscalEvent` ADD CONSTRAINT `FiscalEvent_fiscalDocumentId_fkey` FOREIGN KEY (`fiscalDocumentId`) REFERENCES `FiscalDocument`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `FiscalEvent` ADD CONSTRAINT `FiscalEvent_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
