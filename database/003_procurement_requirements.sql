
USE software_business_dev;

-- ==========================================
-- Assignment #4: Procurement Requirements
-- Development database schema
-- ==========================================

-- 1. Users
CREATE TABLE IF NOT EXISTS users (
    user_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    locale VARCHAR(20) DEFAULT 'en'
) ENGINE=InnoDB;

-- 2. Company memberships
CREATE TABLE IF NOT EXISTS company_memberships (
    membership_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    UNIQUE KEY uq_company_user (company_id, user_id),

    FOREIGN KEY (company_id)
        REFERENCES companies(company_id),
    FOREIGN KEY (user_id)
        REFERENCES users(user_id)
) ENGINE=InnoDB;

-- 3. Roles
CREATE TABLE IF NOT EXISTS roles (
    role_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    role_code VARCHAR(100) NOT NULL UNIQUE,
    scope VARCHAR(20) NOT NULL,

    CONSTRAINT chk_role_scope
        CHECK (scope IN ('COMPANY', 'PROJECT'))
) ENGINE=InnoDB;

-- 4. Projects
CREATE TABLE IF NOT EXISTS projects (
    project_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT UNSIGNED NOT NULL,
    project_name VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    FOREIGN KEY (company_id)
        REFERENCES companies(company_id)
) ENGINE=InnoDB;

-- 5. Project assignments
CREATE TABLE IF NOT EXISTS project_assignments (
    assignment_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    project_id BIGINT UNSIGNED NOT NULL,
    membership_id BIGINT UNSIGNED NOT NULL,
    role_id BIGINT UNSIGNED NOT NULL,

    UNIQUE KEY uq_project_assignment
        (project_id, membership_id, role_id),

    FOREIGN KEY (project_id)
        REFERENCES projects(project_id),
    FOREIGN KEY (membership_id)
        REFERENCES company_memberships(membership_id),
    FOREIGN KEY (role_id)
        REFERENCES roles(role_id)
) ENGINE=InnoDB;

-- 6. Measurement units
CREATE TABLE IF NOT EXISTS units (
    unit_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    unit_code VARCHAR(30) NOT NULL UNIQUE,
    unit_name VARCHAR(100) NOT NULL
) ENGINE=InnoDB;

-- 7. Procurement requirements
CREATE TABLE IF NOT EXISTS requirements (
    requirement_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    project_id BIGINT UNSIGNED NOT NULL,
    category_id BIGINT UNSIGNED NOT NULL,
    created_by_assignment_id BIGINT UNSIGNED NOT NULL,

    title VARCHAR(255) NOT NULL,
    needed_by DATE NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT chk_requirement_status
        CHECK (status IN ('DRAFT', 'READY', 'CANCELLED')),

    FOREIGN KEY (project_id)
        REFERENCES projects(project_id),
    FOREIGN KEY (category_id)
        REFERENCES resource_categories(category_id),
    FOREIGN KEY (created_by_assignment_id)
        REFERENCES project_assignments(assignment_id)
) ENGINE=InnoDB;

-- 8. Requirement items
CREATE TABLE IF NOT EXISTS requirement_items (
    item_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    requirement_id BIGINT UNSIGNED NOT NULL,
    line_no INT NOT NULL,
    item_description VARCHAR(500) NOT NULL,
    required_qty DECIMAL(14,3) NOT NULL,
    unit_id BIGINT UNSIGNED NOT NULL,

    UNIQUE KEY uq_requirement_line
        (requirement_id, line_no),

    CONSTRAINT chk_requirement_qty
        CHECK (required_qty > 0),

    CONSTRAINT chk_requirement_line
        CHECK (line_no > 0),

    FOREIGN KEY (requirement_id)
        REFERENCES requirements(requirement_id)
        ON DELETE CASCADE,

    FOREIGN KEY (unit_id)
        REFERENCES units(unit_id)
) ENGINE=InnoDB;

-- 9. Material-specific information
CREATE TABLE IF NOT EXISTS material_requirement_specs (
    item_id BIGINT UNSIGNED PRIMARY KEY,
    material_specification TEXT NULL,
    delivery_destination VARCHAR(500) NULL,

    FOREIGN KEY (item_id)
        REFERENCES requirement_items(item_id)
        ON DELETE CASCADE
) ENGINE=InnoDB;
