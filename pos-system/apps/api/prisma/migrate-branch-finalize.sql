-- Asegurar inventory.branch_id NOT NULL + unique compuesto
UPDATE `inventory` i JOIN `branches` b ON b.code = 'MATRIZ' SET i.branch_id = b.id WHERE i.branch_id IS NULL;
ALTER TABLE `inventory` MODIFY `branch_id` INT NOT NULL;

SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'inventory' AND INDEX_NAME = 'inventory_product_id_idx');
SET @sql := IF(@i = 0, 'CREATE INDEX `inventory_product_id_idx` ON `inventory`(`product_id`)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'inventory' AND INDEX_NAME = 'inventory_product_id_key');
SET @sql := IF(@idx > 0, 'ALTER TABLE `inventory` DROP INDEX `inventory_product_id_key`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @u := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'inventory' AND INDEX_NAME = 'inventory_product_id_branch_id_key');
SET @sql := IF(@u = 0, 'ALTER TABLE `inventory` ADD UNIQUE INDEX `inventory_product_id_branch_id_key` (`product_id`, `branch_id`)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'inventory' AND CONSTRAINT_NAME = 'inventory_branch_id_fkey');
SET @sql := IF(@fk = 0, 'ALTER TABLE `inventory` ADD CONSTRAINT `inventory_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'inventory' AND INDEX_NAME = 'inventory_branch_id_idx');
SET @sql := IF(@i = 0, 'CREATE INDEX `inventory_branch_id_idx` ON `inventory`(`branch_id`)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- document_sequences + user_branches
CREATE TABLE IF NOT EXISTS `document_sequences` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `branch_id` INT NOT NULL,
  `type` VARCHAR(30) NOT NULL,
  `next_number` INT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `document_sequences_branch_id_type_key` (`branch_id`, `type`),
  CONSTRAINT `document_sequences_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `document_sequences` (`branch_id`, `type`, `next_number`)
SELECT b.id, 'RECIBO', GREATEST(1, (SELECT COALESCE(MAX(id), 0) + 1 FROM sales))
FROM `branches` b WHERE b.code = 'MATRIZ'
AND NOT EXISTS (SELECT 1 FROM `document_sequences` ds WHERE ds.branch_id = b.id AND ds.type = 'RECIBO');

CREATE TABLE IF NOT EXISTS `user_branches` (
  `user_id` INT NOT NULL,
  `branch_id` INT NOT NULL,
  `is_default` BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (`user_id`, `branch_id`),
  INDEX `user_branches_branch_id_idx` (`branch_id`),
  CONSTRAINT `user_branches_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `user_branches_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `user_branches` (`user_id`, `branch_id`, `is_default`)
SELECT u.id, b.id, true
FROM `users` u
CROSS JOIN `branches` b
WHERE b.code = 'MATRIZ'
AND NOT EXISTS (SELECT 1 FROM `user_branches` ub WHERE ub.user_id = u.id AND ub.branch_id = b.id);
