-- AlterTable
ALTER TABLE `FiscalDocumentItem` ADD COLUMN `taxTreatment` ENUM('TAXED', 'EXEMPT', 'NON_TAXABLE') NULL;

-- AlterTable
ALTER TABLE `FiscalSetting` ADD COLUMN `defaultTaxTreatment` ENUM('TAXED', 'EXEMPT', 'NON_TAXABLE') NULL,
    ADD COLUMN `defaultVatArcaCode` INTEGER NULL,
    ADD COLUMN `defaultVatRate` DECIMAL(5, 2) NULL;

-- AlterTable
ALTER TABLE `Product` ADD COLUMN `taxTreatment` ENUM('TAXED', 'EXEMPT', 'NON_TAXABLE') NULL,
    ADD COLUMN `vatArcaCode` INTEGER NULL,
    ADD COLUMN `vatRate` DECIMAL(5, 2) NULL;
