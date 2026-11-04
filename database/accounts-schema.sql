-- Account foundation; apply only after backup and security review.
CREATE TABLE IF NOT EXISTS pdg_users (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
 email VARCHAR(254) NOT NULL,
 password_hash VARCHAR(255) NOT NULL,
 role ENUM('customer','admin') NOT NULL DEFAULT 'customer',
 is_active TINYINT(1) NOT NULL DEFAULT 1,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY (id),
 UNIQUE KEY uq_pdg_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pdg_login_attempts (
 identifier_hash CHAR(64) NOT NULL,
 window_start DATETIME NOT NULL,
 attempt_count INT UNSIGNED NOT NULL DEFAULT 0,
 PRIMARY KEY (identifier_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pdg_email_tokens (
 token_hash CHAR(64) NOT NULL,
 user_id BIGINT UNSIGNED NOT NULL,
 expires_at DATETIME NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY (token_hash),
 KEY idx_pdg_email_user (user_id),
 CONSTRAINT fk_pdg_token_user FOREIGN KEY (user_id) REFERENCES pdg_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
