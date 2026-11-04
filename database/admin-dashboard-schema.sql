-- Additive tables for shop analytics and custom product fields.
-- No existing tables or product rows are modified.
CREATE TABLE IF NOT EXISTS pdg_product_fields (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 product_id BIGINT UNSIGNED NOT NULL,
 label VARCHAR(100) NOT NULL,
 value TEXT NOT NULL,
 sort_order INT UNSIGNED NOT NULL DEFAULT 0,
 CONSTRAINT fk_pdg_fields_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
 KEY idx_pdg_fields_product (product_id,sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pdg_product_views (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 product_id BIGINT UNSIGNED NOT NULL,
 visitor_hash CHAR(64) NOT NULL,
 user_id BIGINT UNSIGNED NULL,
 viewed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 KEY idx_pdg_views_time (viewed_at),
 KEY idx_pdg_views_user_time (user_id,viewed_at),
 CONSTRAINT fk_pdg_views_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
 CONSTRAINT fk_pdg_views_user FOREIGN KEY (user_id) REFERENCES pdg_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
