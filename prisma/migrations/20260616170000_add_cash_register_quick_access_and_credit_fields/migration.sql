ALTER TABLE `Product`
  ADD COLUMN `quickAccess` BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE `Payment`
  ADD COLUMN `installments` INTEGER NULL,
  ADD COLUMN `surchargeRate` DECIMAL(5, 2) NULL,
  ADD COLUMN `surchargeAmount` DECIMAL(12, 2) NULL;
