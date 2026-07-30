-- Provider delegation is opt-in. Existing fiscal settings remain legacy by default.
ALTER TABLE `FiscalSetting`
    ADD COLUMN `connectionMode` ENUM('LEGACY_PER_BUSINESS', 'PROVIDER_DELEGATION') NOT NULL DEFAULT 'LEGACY_PER_BUSINESS',
    ADD COLUMN `delegationDeclaredAt` DATETIME(3) NULL,
    ADD COLUMN `providerVerificationStatus` ENUM('PENDING', 'VERIFIED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    ADD COLUMN `providerVerifiedAt` DATETIME(3) NULL,
    ADD COLUMN `providerLastVerificationAt` DATETIME(3) NULL,
    ADD COLUMN `providerLastErrorCode` VARCHAR(120) NULL;

CREATE TABLE `FiscalProviderAuthCache` (
    `id` VARCHAR(191) NOT NULL,
    `certificateFingerprint` VARCHAR(128) NOT NULL,
    `environment` ENUM('HOMOLOGACION', 'PRODUCCION') NOT NULL,
    `service` VARCHAR(80) NOT NULL,
    `encryptedToken` TEXT NOT NULL,
    `encryptedSign` TEXT NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `fp_auth_scope_uq`(`certificateFingerprint`, `environment`, `service`),
    INDEX `fp_auth_expires_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
