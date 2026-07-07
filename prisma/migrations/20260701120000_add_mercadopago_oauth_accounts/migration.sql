-- AlterTable
ALTER TABLE `MercadoPagoAccount`
    ADD COLUMN `connectionType` ENUM('MANUAL_TOKEN', 'OAUTH') NOT NULL DEFAULT 'MANUAL_TOKEN',
    ADD COLUMN `oauthRefreshToken` TEXT NULL,
    ADD COLUMN `oauthTokenExpiresAt` DATETIME(3) NULL,
    ADD COLUMN `oauthScope` TEXT NULL,
    ADD COLUMN `oauthConnectedAt` DATETIME(3) NULL,
    ADD COLUMN `oauthLastRefreshAt` DATETIME(3) NULL,
    ADD COLUMN `oauthRequiresReconnect` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `mpUserId` VARCHAR(191) NULL,
    ADD COLUMN `accountNickname` VARCHAR(191) NULL,
    ADD COLUMN `accountEmail` VARCHAR(191) NULL,
    ADD COLUMN `lastConnectionTestAt` DATETIME(3) NULL,
    ADD COLUMN `lastConnectionStatus` VARCHAR(191) NULL,
    ADD COLUMN `lastConnectionMessage` TEXT NULL;

-- CreateIndex
CREATE INDEX `MercadoPagoAccount_connectionType_idx` ON `MercadoPagoAccount`(`connectionType`);

-- CreateIndex
CREATE INDEX `MercadoPagoAccount_oauthRequiresReconnect_idx` ON `MercadoPagoAccount`(`oauthRequiresReconnect`);
