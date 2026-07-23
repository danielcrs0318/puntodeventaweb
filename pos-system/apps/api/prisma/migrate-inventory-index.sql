CREATE INDEX `inventory_product_id_idx` ON `inventory`(`product_id`);
ALTER TABLE `inventory` DROP INDEX `inventory_product_id_key`;
ALTER TABLE `inventory` ADD UNIQUE INDEX `inventory_product_id_branch_id_key` (`product_id`, `branch_id`);
CREATE INDEX `inventory_branch_id_idx` ON `inventory`(`branch_id`);
