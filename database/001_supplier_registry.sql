CREATE DATABASE IF NOT EXISTS software_business_dev
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_0900_ai_ci;

USE software_business_dev;

CREATE TABLE IF NOT EXISTS companies (
    company_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    company_name VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS resource_categories (
    category_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    category_code VARCHAR(30) NOT NULL UNIQUE,
    category_name VARCHAR(100) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS providers (
    provider_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT UNSIGNED NOT NULL,
    provider_name VARCHAR(255) NOT NULL,
    contact_email VARCHAR(255),
    contact_phone VARCHAR(100),
    CONSTRAINT fk_providers_company
        FOREIGN KEY (company_id) REFERENCES companies (company_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS provider_categories (
    provider_id BIGINT UNSIGNED NOT NULL,
    category_id BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (provider_id, category_id),
    CONSTRAINT fk_provider_categories_provider
        FOREIGN KEY (provider_id) REFERENCES providers (provider_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_provider_categories_category
        FOREIGN KEY (category_id) REFERENCES resource_categories (category_id)
) ENGINE=InnoDB;