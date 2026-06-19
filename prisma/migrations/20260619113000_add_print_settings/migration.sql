-- CreateTable
CREATE TABLE `PrintSetting` (
    `id` VARCHAR(191) NOT NULL,
    `printerName` VARCHAR(191) NULL,
    `paperSize` ENUM('TICKET_80', 'TICKET_58', 'A4') NOT NULL DEFAULT 'TICKET_80',
    `silentPrint` BOOLEAN NOT NULL DEFAULT false,
    `autoPrintTicket` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
