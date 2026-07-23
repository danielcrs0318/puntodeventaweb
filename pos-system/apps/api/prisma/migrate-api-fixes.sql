-- returned_quantity on sale_items
SET @col := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'sale_items'
    AND COLUMN_NAME = 'returned_quantity'
);
SET @sql := IF(@col = 0,
  'ALTER TABLE sale_items ADD COLUMN returned_quantity DECIMAL(12, 3) NOT NULL DEFAULT 0',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Allow multiple fiscal docs per sale: drop FK -> drop unique -> add index -> recreate FK
SET @fk := (
  SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'fiscal_invoices'
    AND COLUMN_NAME = 'sale_id'
    AND REFERENCED_TABLE_NAME = 'sales'
  LIMIT 1
);
SET @sql := IF(@fk IS NOT NULL, CONCAT('ALTER TABLE fiscal_invoices DROP FOREIGN KEY `', @fk, '`'), 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx := (
  SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'fiscal_invoices'
    AND COLUMN_NAME = 'sale_id'
    AND NON_UNIQUE = 0
    AND INDEX_NAME != 'PRIMARY'
  LIMIT 1
);
SET @sql := IF(@idx IS NOT NULL, CONCAT('ALTER TABLE fiscal_invoices DROP INDEX `', @idx, '`'), 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx2 := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'fiscal_invoices'
    AND INDEX_NAME = 'fiscal_invoices_sale_id_idx'
);
SET @sql := IF(@idx2 = 0,
  'CREATE INDEX fiscal_invoices_sale_id_idx ON fiscal_invoices (sale_id)',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk2 := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'fiscal_invoices'
    AND COLUMN_NAME = 'sale_id'
    AND REFERENCED_TABLE_NAME = 'sales'
);
SET @sql := IF(@fk2 = 0,
  'ALTER TABLE fiscal_invoices ADD CONSTRAINT fiscal_invoices_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE SET NULL ON UPDATE CASCADE',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
