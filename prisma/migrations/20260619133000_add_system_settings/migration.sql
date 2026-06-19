-- AlterTable
ALTER TABLE `BusinessProfile`
    ADD COLUMN `email` VARCHAR(191) NULL,
    ADD COLUMN `fiscalCondition` VARCHAR(191) NULL,
    ADD COLUMN `grossIncome` VARCHAR(191) NULL,
    ADD COLUMN `activityStartDate` DATETIME(3) NULL,
    ADD COLUMN `locale` VARCHAR(191) NOT NULL DEFAULT 'es-AR',
    ADD COLUMN `timezone` VARCHAR(191) NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
    ADD COLUMN `website` VARCHAR(191) NULL,
    ADD COLUMN `generalFooterText` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `PrintSetting`
    ADD COLUMN `copies` INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN `marginMm` INTEGER NOT NULL DEFAULT 2;

-- CreateTable
CREATE TABLE `TicketSetting` (
    `id` VARCHAR(191) NOT NULL,
    `showBusinessName` BOOLEAN NOT NULL DEFAULT true,
    `showCuit` BOOLEAN NOT NULL DEFAULT true,
    `showAddress` BOOLEAN NOT NULL DEFAULT true,
    `showPhone` BOOLEAN NOT NULL DEFAULT true,
    `showEmail` BOOLEAN NOT NULL DEFAULT false,
    `showSeller` BOOLEAN NOT NULL DEFAULT true,
    `showCustomer` BOOLEAN NOT NULL DEFAULT true,
    `showPaymentDetails` BOOLEAN NOT NULL DEFAULT true,
    `showStockUnit` BOOLEAN NOT NULL DEFAULT true,
    `showBarcode` BOOLEAN NOT NULL DEFAULT false,
    `footerText` VARCHAR(191) NULL,
    `headerText` VARCHAR(191) NULL,
    `ticketTitle` VARCHAR(191) NOT NULL DEFAULT 'Ticket no fiscal',
    `thankYouText` VARCHAR(191) NOT NULL DEFAULT 'Gracias por su compra',
    `showNonFiscalLegend` BOOLEAN NOT NULL DEFAULT true,
    `nonFiscalLegend` VARCHAR(191) NOT NULL DEFAULT 'Ticket no fiscal',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CashRegisterSetting` (
    `id` VARCHAR(191) NOT NULL,
    `requireOpenSession` BOOLEAN NOT NULL DEFAULT true,
    `showExpectedCashToCashier` BOOLEAN NOT NULL DEFAULT false,
    `allowCashierCancelSale` BOOLEAN NOT NULL DEFAULT false,
    `allowNegativeStock` BOOLEAN NOT NULL DEFAULT false,
    `defaultSearchMode` VARCHAR(191) NULL,
    `quickProductsLimit` INTEGER NOT NULL DEFAULT 12,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StockSetting` (
    `id` VARCHAR(191) NOT NULL,
    `lowStockEnabled` BOOLEAN NOT NULL DEFAULT true,
    `defaultMinStock` DECIMAL(12, 3) NULL,
    `allowManualStockAdjustment` BOOLEAN NOT NULL DEFAULT true,
    `showLowStockWarnings` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
