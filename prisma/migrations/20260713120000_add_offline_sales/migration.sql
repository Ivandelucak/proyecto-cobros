-- Offline sales are identified per business and retain both operational and sync timestamps.
ALTER TABLE `Sale`
    ADD COLUMN `clientOperationId` VARCHAR(191) NULL,
    ADD COLUMN `occurredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `offlineSyncedAt` DATETIME(3) NULL;

CREATE INDEX `Sale_occurredAt_idx` ON `Sale`(`occurredAt`);
CREATE UNIQUE INDEX `Sale_businessId_clientOperationId_key`
    ON `Sale`(`businessId`, `clientOperationId`);
