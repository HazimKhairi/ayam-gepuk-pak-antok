-- AlterTable
ALTER TABLE `menu_items` ADD COLUMN `customizationOptions` JSON NULL,
    ADD COLUMN `hasCustomization` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `orders` ADD COLUMN `orderItems` JSON NULL;
