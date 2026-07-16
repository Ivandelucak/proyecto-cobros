-- Numeracion comercial por comercio y mes argentino. Sale.saleNumber queda como identificador tecnico legado.
CREATE TABLE `SaleNumberSequence` (
    `id` VARCHAR(191) NOT NULL,
    `businessId` VARCHAR(191) NOT NULL,
    `period` VARCHAR(7) NOT NULL,
    `lastNumber` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SaleNumberSequence_businessId_period_key`(`businessId`, `period`),
    INDEX `SaleNumberSequence_businessId_idx`(`businessId`),
    PRIMARY KEY (`id`),
    CONSTRAINT `SaleNumberSequence_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `Business`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Sale`
    ADD COLUMN `internalNumber` INTEGER NULL,
    ADD COLUMN `internalPeriod` VARCHAR(7) NULL;

-- Argentina permanece en UTC-03:00. Se evita depender de tablas de zonas horarias del servidor.
SET @number := 0;
SET @previous_business := '';
SET @previous_period := '';

UPDATE `Sale` AS `sale`
INNER JOIN (
    SELECT
        `ordered`.`id`,
        `ordered`.`internalPeriod`,
        @number := IF(
            @previous_business = `ordered`.`businessId` AND @previous_period = `ordered`.`internalPeriod`,
            @number + 1,
            1
        ) AS `internalNumber`,
        @previous_business := `ordered`.`businessId` AS `business_marker`,
        @previous_period := `ordered`.`internalPeriod` AS `period_marker`
    FROM (
        SELECT
            `id`,
            `businessId`,
            DATE_FORMAT(DATE_SUB(COALESCE(`occurredAt`, `createdAt`), INTERVAL 3 HOUR), '%Y-%m') AS `internalPeriod`
        FROM `Sale`
        ORDER BY
            `businessId` ASC,
            DATE_FORMAT(DATE_SUB(COALESCE(`occurredAt`, `createdAt`), INTERVAL 3 HOUR), '%Y-%m') ASC,
            COALESCE(`occurredAt`, `createdAt`) ASC,
            `createdAt` ASC,
            `id` ASC
    ) AS `ordered`
) AS `numbered` ON `numbered`.`id` = `sale`.`id`
SET
    `sale`.`internalPeriod` = `numbered`.`internalPeriod`,
    `sale`.`internalNumber` = `numbered`.`internalNumber`;

INSERT INTO `SaleNumberSequence` (`id`, `businessId`, `period`, `lastNumber`, `createdAt`, `updatedAt`)
SELECT
    UUID(),
    `businessId`,
    `internalPeriod`,
    MAX(`internalNumber`),
    CURRENT_TIMESTAMP(3),
    CURRENT_TIMESTAMP(3)
FROM `Sale`
GROUP BY `businessId`, `internalPeriod`;

ALTER TABLE `Sale`
    MODIFY COLUMN `internalNumber` INTEGER NOT NULL,
    MODIFY COLUMN `internalPeriod` VARCHAR(7) NOT NULL,
    ADD INDEX `Sale_businessId_internalPeriod_idx`(`businessId`, `internalPeriod`),
    ADD UNIQUE INDEX `Sale_businessId_internalPeriod_internalNumber_key`(`businessId`, `internalPeriod`, `internalNumber`);
