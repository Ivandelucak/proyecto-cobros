-- Recargo manual aplicado a la venta completa. Los recargos de cuotas permanecen en Payment.
ALTER TABLE `Sale`
    ADD COLUMN `generalSurchargeType` VARCHAR(16) NULL,
    ADD COLUMN `generalSurchargeValue` DECIMAL(12,4) NULL,
    ADD COLUMN `generalSurchargeAmount` DECIMAL(12,2) NOT NULL DEFAULT 0;
