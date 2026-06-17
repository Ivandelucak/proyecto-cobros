ALTER TABLE `Payment`
  ADD COLUMN `receivedAmount` DECIMAL(12, 2) NULL,
  ADD COLUMN `changeAmount` DECIMAL(12, 2) NULL;
