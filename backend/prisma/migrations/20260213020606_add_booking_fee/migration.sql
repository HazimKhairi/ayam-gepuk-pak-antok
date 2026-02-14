-- AlterTable
ALTER TABLE `orders` ADD COLUMN `bookingFee` DECIMAL(10, 2) NOT NULL DEFAULT 1.00;

-- AlterTable
ALTER TABLE `outlets` ADD COLUMN `googleMapsUrl` VARCHAR(500) NULL,
    MODIFY `closeTime` VARCHAR(10) NOT NULL DEFAULT '17:00';
