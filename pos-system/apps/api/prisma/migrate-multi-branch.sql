-- Migración multi-sucursal (conserva datos existentes)
-- Asigna todo el historial a la sucursal MATRIZ.

CREATE TABLE IF NOT EXISTS `branches` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(20) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `address` VARCHAR(500) NULL,
  `phone` VARCHAR(30) NULL,
  `email` VARCHAR(255) NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `is_main` BOOLEAN NOT NULL DEFAULT false,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `branches_code_key` (`code`),
  INDEX `branches_is_active_idx` (`is_active`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `branches` (`code`, `name`, `is_active`, `is_main`, `created_at`, `updated_at`)
SELECT 'MATRIZ', 'Sucursal Matriz', true, true, NOW(3), NOW(3)
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `branches` WHERE `code` = 'MATRIZ');

CREATE TABLE IF NOT EXISTS `user_branches` (
  `user_id` INT NOT NULL,
  `branch_id` INT NOT NULL,
  `is_default` BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (`user_id`, `branch_id`),
  INDEX `user_branches_branch_id_idx` (`branch_id`),
  CONSTRAINT `user_branches_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `user_branches_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

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
SELECT b.id, 'RECIBO', 1 FROM `branches` b WHERE b.code = 'MATRIZ'
AND NOT EXISTS (
  SELECT 1 FROM `document_sequences` ds WHERE ds.branch_id = b.id AND ds.type = 'RECIBO'
);

INSERT INTO `user_branches` (`user_id`, `branch_id`, `is_default`)
SELECT u.id, b.id, true
FROM `users` u
CROSS JOIN `branches` b
WHERE b.code = 'MATRIZ'
AND NOT EXISTS (
  SELECT 1 FROM `user_branches` ub WHERE ub.user_id = u.id AND ub.branch_id = b.id
);

-- inventory: agregar branch_id
SET @col_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'inventory' AND COLUMN_NAME = 'branch_id'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE `inventory` ADD COLUMN `branch_id` INT NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE `inventory` i
JOIN `branches` b ON b.code = 'MATRIZ'
SET i.branch_id = b.id
WHERE i.branch_id IS NULL;

-- Quitar unique viejo product_id: primero índice no único para sostener el FK
SET @i := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'inventory' AND INDEX_NAME = 'inventory_product_id_idx'
);
SET @sql := IF(@i = 0, 'CREATE INDEX `inventory_product_id_idx` ON `inventory`(`product_id`)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'inventory' AND INDEX_NAME = 'inventory_product_id_key'
);
SET @sql := IF(@idx > 0, 'ALTER TABLE `inventory` DROP INDEX `inventory_product_id_key`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

ALTER TABLE `inventory` MODIFY `branch_id` INT NOT NULL;

SET @fk := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'inventory' AND CONSTRAINT_NAME = 'inventory_branch_id_fkey'
);
SET @sql := IF(@fk = 0,
  'ALTER TABLE `inventory` ADD CONSTRAINT `inventory_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @u := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'inventory' AND INDEX_NAME = 'inventory_product_id_branch_id_key'
);
SET @sql := IF(@u = 0,
  'ALTER TABLE `inventory` ADD UNIQUE INDEX `inventory_product_id_branch_id_key` (`product_id`, `branch_id`)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @i := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'inventory' AND INDEX_NAME = 'inventory_branch_id_idx'
);
SET @sql := IF(@i = 0, 'CREATE INDEX `inventory_branch_id_idx` ON `inventory`(`branch_id`)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Helper macro pattern for other tables
-- inventory_movements
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'inventory_movements' AND COLUMN_NAME = 'branch_id');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE `inventory_movements` ADD COLUMN `branch_id` INT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
UPDATE `inventory_movements` im JOIN `branches` b ON b.code = 'MATRIZ' SET im.branch_id = b.id WHERE im.branch_id IS NULL;
ALTER TABLE `inventory_movements` MODIFY `branch_id` INT NOT NULL;
SET @fk := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'inventory_movements' AND CONSTRAINT_NAME = 'inventory_movements_branch_id_fkey');
SET @sql := IF(@fk = 0, 'ALTER TABLE `inventory_movements` ADD CONSTRAINT `inventory_movements_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'inventory_movements' AND INDEX_NAME = 'inventory_movements_branch_id_idx');
SET @sql := IF(@i = 0, 'CREATE INDEX `inventory_movements_branch_id_idx` ON `inventory_movements`(`branch_id`)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- sales
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sales' AND COLUMN_NAME = 'branch_id');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE `sales` ADD COLUMN `branch_id` INT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
UPDATE `sales` s JOIN `branches` b ON b.code = 'MATRIZ' SET s.branch_id = b.id WHERE s.branch_id IS NULL;
ALTER TABLE `sales` MODIFY `branch_id` INT NOT NULL;
SET @fk := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sales' AND CONSTRAINT_NAME = 'sales_branch_id_fkey');
SET @sql := IF(@fk = 0, 'ALTER TABLE `sales` ADD CONSTRAINT `sales_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sales' AND INDEX_NAME = 'sales_branch_id_idx');
SET @sql := IF(@i = 0, 'CREATE INDEX `sales_branch_id_idx` ON `sales`(`branch_id`)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- cash_register_sessions
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cash_register_sessions' AND COLUMN_NAME = 'branch_id');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE `cash_register_sessions` ADD COLUMN `branch_id` INT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
UPDATE `cash_register_sessions` c JOIN `branches` b ON b.code = 'MATRIZ' SET c.branch_id = b.id WHERE c.branch_id IS NULL;
ALTER TABLE `cash_register_sessions` MODIFY `branch_id` INT NOT NULL;
SET @fk := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cash_register_sessions' AND CONSTRAINT_NAME = 'cash_register_sessions_branch_id_fkey');
SET @sql := IF(@fk = 0, 'ALTER TABLE `cash_register_sessions` ADD CONSTRAINT `cash_register_sessions_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cash_register_sessions' AND INDEX_NAME = 'cash_register_sessions_branch_id_idx');
SET @sql := IF(@i = 0, 'CREATE INDEX `cash_register_sessions_branch_id_idx` ON `cash_register_sessions`(`branch_id`)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- purchases
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'purchases' AND COLUMN_NAME = 'branch_id');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE `purchases` ADD COLUMN `branch_id` INT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
UPDATE `purchases` p JOIN `branches` b ON b.code = 'MATRIZ' SET p.branch_id = b.id WHERE p.branch_id IS NULL;
ALTER TABLE `purchases` MODIFY `branch_id` INT NOT NULL;
SET @fk := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'purchases' AND CONSTRAINT_NAME = 'purchases_branch_id_fkey');
SET @sql := IF(@fk = 0, 'ALTER TABLE `purchases` ADD CONSTRAINT `purchases_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'purchases' AND INDEX_NAME = 'purchases_branch_id_idx');
SET @sql := IF(@i = 0, 'CREATE INDEX `purchases_branch_id_idx` ON `purchases`(`branch_id`)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- cai_ranges.branch_id opcional
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cai_ranges' AND COLUMN_NAME = 'branch_id');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE `cai_ranges` ADD COLUMN `branch_id` INT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
UPDATE `cai_ranges` c JOIN `branches` b ON b.code = 'MATRIZ' SET c.branch_id = b.id WHERE c.branch_id IS NULL;
SET @fk := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cai_ranges' AND CONSTRAINT_NAME = 'cai_ranges_branch_id_fkey');
SET @sql := IF(@fk = 0, 'ALTER TABLE `cai_ranges` ADD CONSTRAINT `cai_ranges_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cai_ranges' AND INDEX_NAME = 'cai_ranges_branch_id_idx');
SET @sql := IF(@i = 0, 'CREATE INDEX `cai_ranges_branch_id_idx` ON `cai_ranges`(`branch_id`)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
