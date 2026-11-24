
USE software_business_dev;

-- Add supplier location information
ALTER TABLE providers
    ADD COLUMN city_or_county VARCHAR(100) NULL
        AFTER provider_name,
    ADD COLUMN address VARCHAR(500) NULL
        AFTER city_or_county;

-- Allow multiple contact persons per supplier
CREATE TABLE provider_contacts (
    contact_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    provider_id BIGINT UNSIGNED NOT NULL,
    contact_name VARCHAR(150) NOT NULL,
    position_title VARCHAR(100) NULL,
    contact_phone VARCHAR(100) NULL,
    contact_email VARCHAR(255) NULL,
    line_id VARCHAR(100) NULL,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,

    PRIMARY KEY (contact_id),

    INDEX idx_provider_contacts_provider (provider_id),

    CONSTRAINT fk_provider_contacts_provider
        FOREIGN KEY (provider_id)
        REFERENCES providers(provider_id)
        ON DELETE CASCADE
) ENGINE=InnoDB;
