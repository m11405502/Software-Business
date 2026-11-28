-- ============================================
-- Assignment #5: Resource Master Management
-- Initial Resource Seed Data
-- Source: Assignment #3 ETL Database
-- ============================================

USE software_business_dev;

-- Run after successful completion of 005.
-- Requires assignment3_etl_sandbox.
-- Run in a dedicated MySQL session.
-- Review validation results before COMMIT.


-- ============================================
-- 1. Identify the target company
-- ============================================

SET @seed_company_id = (
    SELECT company_id
    FROM companies
    WHERE company_id = 1
      AND company_name = 'Demo Contractor'
      AND status = 'ACTIVE'
);


-- ============================================
-- 2. Prepare selected resource mapping
-- ============================================

DROP TEMPORARY TABLE IF EXISTS tmp_a5_resource_seed;

CREATE TEMPORARY TABLE tmp_a5_resource_seed (
    source_material_id CHAR(8) PRIMARY KEY,
    source_category VARCHAR(30) NOT NULL,
    target_category VARCHAR(30) NOT NULL,
    classification_name VARCHAR(150) NOT NULL,
    target_unit VARCHAR(30) NOT NULL,
    source_unit_hex VARCHAR(30) NOT NULL
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;


INSERT INTO tmp_a5_resource_seed VALUES

-- Materials: Pipes
('56851377', 'MATERIAL', 'MATERIALS',
 'Pipes', 'M', '6D'),

('37135391', 'MATERIAL', 'MATERIALS',
 'Pipes', 'M', '6D'),

('05917225', 'MATERIAL', 'MATERIALS',
 'Pipes', 'M', '6D'),

-- Materials: Aggregates
('74752529', 'MATERIAL', 'MATERIALS',
 'Aggregates', 'M3', 'E38EA5'),

-- Materials: Cement
('19175900', 'MATERIAL', 'MATERIALS',
 'Cement', 'KG', '6B67'),

-- Materials: Concrete
('37295260', 'MATERIAL', 'MATERIALS',
 'Concrete', 'M3', 'E38EA5'),

('04265799', 'MATERIAL', 'MATERIALS',
 'Concrete', 'M3', 'E38EA5'),

-- Services: Labor Supply
('11003626', 'LABOR', 'SERVICES',
 'Labor Supply', 'HOUR', '686F7572'),

('21931511', 'LABOR', 'SERVICES',
 'Labor Supply', 'DAY', '646179'),

-- Services: Roadworks
('88231132', 'SERVICE', 'SERVICES',
 'Roadworks', 'M2', '6DC2B2'),

-- Services: Earthworks
('17232410', 'SERVICE', 'SERVICES',
 'Earthworks', 'M3', 'E38EA5'),

('76460539', 'SERVICE', 'SERVICES',
 'Earthworks', 'M3', 'E38EA5');


-- ============================================
-- 3. Begin seed transaction
-- ============================================

START TRANSACTION;


-- ============================================
-- 4. Insert additional measurement unit
-- ============================================

INSERT INTO units (
    unit_code,
    unit_name
)
SELECT
    'HOUR',
    'Hour'
WHERE @seed_company_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM units
      WHERE unit_code = 'HOUR'
  );


-- ============================================
-- 5. Insert initial classifications
-- ============================================

INSERT INTO resource_classifications (
    company_id,
    category_id,
    classification_name,
    is_active
)
SELECT DISTINCT
    @seed_company_id,
    rc.category_id,
    m.classification_name,
    TRUE
FROM tmp_a5_resource_seed m

JOIN resource_categories rc
    ON rc.category_code = m.target_category

WHERE @seed_company_id IS NOT NULL

AND NOT EXISTS (
    SELECT 1
    FROM resource_classifications existing
    WHERE existing.company_id = @seed_company_id
      AND existing.category_id = rc.category_id
      AND existing.classification_name =
          m.classification_name
);


-- ============================================
-- 6. Migrate selected Assignment #3 resources
-- ============================================

INSERT INTO resources (
    company_id,
    classification_id,
    unit_id,
    source_material_id,
    resource_name,
    is_active
)
SELECT
    @seed_company_id,
    cl.classification_id,
    target_unit.unit_id,
    src.source_material_id,
    src.resource_name,
    TRUE

FROM tmp_a5_resource_seed m

JOIN assignment3_etl_sandbox.resources src
    ON BINARY src.source_material_id =
       BINARY m.source_material_id

JOIN assignment3_etl_sandbox.resource_categories sc
    ON sc.category_id = src.category_id
   AND BINARY sc.category_code =
       BINARY m.source_category

JOIN assignment3_etl_sandbox.units source_unit
    ON source_unit.unit_id = src.unit_id
   AND HEX(source_unit.unit_code) = m.source_unit_hex

JOIN resource_categories rc
    ON rc.category_code = m.target_category

JOIN resource_classifications cl
    ON cl.company_id = @seed_company_id
   AND cl.category_id = rc.category_id
   AND cl.classification_name = m.classification_name
   AND cl.is_active = TRUE

JOIN units target_unit
    ON target_unit.unit_code = m.target_unit

WHERE @seed_company_id IS NOT NULL

AND NOT EXISTS (
    SELECT 1
    FROM resources existing
    WHERE existing.company_id = @seed_company_id
      AND existing.source_material_id =
          src.source_material_id
);


-- ============================================
-- 7. Verify target company
-- ============================================

SELECT
    @seed_company_id AS target_company_id;


-- ============================================
-- 8. Verify selected resource records
-- ============================================

SELECT
    m.source_material_id,
    m.target_category,
    m.classification_name,
    m.target_unit,
    r.resource_id,
    r.resource_name,

    CASE
        WHEN r.resource_id IS NULL THEN 'MISSING'
        WHEN rc.category_code <> m.target_category
          OR cl.classification_name <> m.classification_name
          OR u.unit_code <> m.target_unit
          OR r.is_active <> TRUE
          OR cl.is_active <> TRUE
            THEN 'REVIEW'
        ELSE 'AVAILABLE'
    END AS migration_status

FROM tmp_a5_resource_seed m

LEFT JOIN resources r
    ON r.company_id = @seed_company_id
   AND r.source_material_id = m.source_material_id

LEFT JOIN resource_classifications cl
    ON cl.classification_id = r.classification_id

LEFT JOIN resource_categories rc
    ON rc.category_id = cl.category_id

LEFT JOIN units u
    ON u.unit_id = r.unit_id

ORDER BY
    m.target_category,
    m.classification_name,
    m.source_material_id;


-- ============================================
-- 9. Verify resource count
-- ============================================

SELECT
    COUNT(*) AS expected_resources,
    COUNT(r.resource_id) AS available_resources

FROM tmp_a5_resource_seed m

LEFT JOIN resources r
    ON r.company_id = @seed_company_id
   AND r.source_material_id = m.source_material_id;


-- ============================================
-- 10. Transaction confirmation
-- ============================================

-- Do not commit automatically.
-- Review all validation results first.
--
-- If validation is successful:
-- COMMIT;
--
-- If an error or inconsistency is detected:
-- ROLLBACK;
--
-- Do not rerun while the transaction is open.


-- ============================================
-- End of Assignment #5 resource seed script
-- ============================================