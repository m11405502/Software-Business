-- ============================================
-- Assignment #5: Resource Master Management
-- Classification-Based Supplier Capabilities
-- Schema Migration
-- ============================================

USE software_business_dev;


-- ============================================
-- 1. Supporting unique key
-- ============================================

ALTER TABLE providers
    ADD UNIQUE KEY uq_provider_company
        (provider_id, company_id);


-- ============================================
-- 2. Resource classifications
-- ============================================

CREATE TABLE resource_classifications (
    classification_id BIGINT UNSIGNED
        AUTO_INCREMENT PRIMARY KEY,

    company_id BIGINT UNSIGNED NOT NULL,
    category_id BIGINT UNSIGNED NOT NULL,

    classification_name VARCHAR(150) NOT NULL,
    description VARCHAR(500) NULL,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at DATETIME NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    updated_at DATETIME NOT NULL
        DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uq_resource_classification
        (company_id, category_id, classification_name),

    UNIQUE KEY uq_classification_company
        (classification_id, company_id),

    UNIQUE KEY uq_classification_company_category
        (classification_id, company_id, category_id),

    CONSTRAINT chk_classification_active
        CHECK (is_active IN (0, 1)),

    CONSTRAINT fk_classification_company
        FOREIGN KEY (company_id)
        REFERENCES companies(company_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_classification_category
        FOREIGN KEY (category_id)
        REFERENCES resource_categories(category_id)
        ON DELETE RESTRICT

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;


-- ============================================
-- 3. Resource master
-- ============================================

CREATE TABLE resources (
    resource_id BIGINT UNSIGNED
        AUTO_INCREMENT PRIMARY KEY,

    company_id BIGINT UNSIGNED NOT NULL,
    classification_id BIGINT UNSIGNED NOT NULL,
    unit_id BIGINT UNSIGNED NOT NULL,

    source_material_id CHAR(8) NULL,

    resource_name VARCHAR(500) NOT NULL,
    description TEXT NULL,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at DATETIME NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    updated_at DATETIME NOT NULL
        DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uq_resource_source
        (company_id, source_material_id),

    UNIQUE KEY uq_resource_identity
        (company_id, classification_id,
         resource_name, unit_id),

    UNIQUE KEY uq_resource_unit
        (resource_id, unit_id),

    CONSTRAINT chk_resource_active
        CHECK (is_active IN (0, 1)),

    CONSTRAINT fk_resource_classification
        FOREIGN KEY (classification_id, company_id)
        REFERENCES resource_classifications
            (classification_id, company_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_resource_unit
        FOREIGN KEY (unit_id)
        REFERENCES units(unit_id)
        ON DELETE RESTRICT

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;


-- ============================================
-- 4. Supplier classification associations
-- ============================================

CREATE TABLE provider_classifications (
    provider_id BIGINT UNSIGNED NOT NULL,
    classification_id BIGINT UNSIGNED NOT NULL,

    company_id BIGINT UNSIGNED NOT NULL,
    category_id BIGINT UNSIGNED NOT NULL,

    created_at DATETIME NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (provider_id, classification_id),

    CONSTRAINT fk_pc_provider_company
        FOREIGN KEY (provider_id, company_id)
        REFERENCES providers(provider_id, company_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_pc_classification_scope
        FOREIGN KEY
            (classification_id, company_id, category_id)
        REFERENCES resource_classifications
            (classification_id, company_id, category_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_pc_provider_category
        FOREIGN KEY (provider_id, category_id)
        REFERENCES provider_categories
            (provider_id, category_id)
        ON DELETE RESTRICT

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;


-- ============================================
-- 5. Extend procurement requirement items
-- ============================================

ALTER TABLE requirement_items

    ADD COLUMN resource_id BIGINT UNSIGNED NULL
        AFTER line_no,

    ADD CONSTRAINT fk_requirement_item_resource
        FOREIGN KEY (resource_id, unit_id)
        REFERENCES resources(resource_id, unit_id)
        ON DELETE RESTRICT;


-- ============================================
-- End of Assignment #5 schema migration
-- ============================================