USE software_business_dev;
CREATE TABLE IF NOT EXISTS rfqs (
    rfq_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT UNSIGNED NOT NULL,
    requirement_id BIGINT UNSIGNED NOT NULL,
    title VARCHAR(255) NOT NULL,
    response_deadline DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT chk_rfq_status
        CHECK (status IN ('DRAFT', 'SENT', 'CLOSED', 'AWARDED', 'CANCELLED')),

    FOREIGN KEY (company_id)
        REFERENCES companies(company_id),
    FOREIGN KEY (requirement_id)
        REFERENCES requirements(requirement_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS rfq_invitations (
    invitation_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    rfq_id BIGINT UNSIGNED NOT NULL,
    provider_id BIGINT UNSIGNED NOT NULL,
    invited_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uq_rfq_provider (rfq_id, provider_id),

    FOREIGN KEY (rfq_id)
        REFERENCES rfqs(rfq_id)
        ON DELETE CASCADE,
    FOREIGN KEY (provider_id)
        REFERENCES providers(provider_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS quotations (
    quotation_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    invitation_id BIGINT UNSIGNED NOT NULL,
    offered_quantity DECIMAL(14,3) NOT NULL,
    unit_price DECIMAL(14,2) NOT NULL,
    notes VARCHAR(500) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT chk_quotation_qty
        CHECK (offered_quantity > 0),
    CONSTRAINT chk_quotation_price
        CHECK (unit_price >= 0),
    CONSTRAINT chk_quotation_status
        CHECK (status IN ('DRAFT', 'SUBMITTED')),

    UNIQUE KEY uq_invitation_quotation (invitation_id),

    FOREIGN KEY (invitation_id)
        REFERENCES rfq_invitations(invitation_id)
        ON DELETE CASCADE
) ENGINE=InnoDB;