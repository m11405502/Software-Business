-- ============================================
-- Assignment #5: Resource Master Management
-- Post-Migration Validation
-- ============================================

USE software_business_dev;

SET @validation_company_id = 1;


-- ============================================
-- 1. Verify new tables
-- Expected: 3 tables
-- ============================================

SELECT
    table_name,
    engine
FROM information_schema.tables
WHERE table_schema = 'software_business_dev'
  AND table_name IN (
      'resource_classifications',
      'resources',
      'provider_classifications'
  )
ORDER BY table_name;


-- ============================================
-- 2. Verify requirement_items modification
-- Expected: resource_id, nullable BIGINT
-- ============================================

SELECT
    column_name,
    column_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'software_business_dev'
  AND table_name = 'requirement_items'
  AND column_name = 'resource_id';


-- ============================================
-- 3. Verify measurement units
-- ============================================

SELECT
    unit_id,
    unit_code,
    unit_name
FROM units
ORDER BY unit_id;


-- ============================================
-- 4. Verify resource classifications
-- Initial expected count: 7
-- ============================================

SELECT
    c.classification_id,
    rc.category_name,
    c.classification_name,
    c.is_active
FROM resource_classifications c
JOIN resource_categories rc
    ON rc.category_id = c.category_id
WHERE c.company_id = @validation_company_id
ORDER BY rc.category_name, c.classification_name;


-- ============================================
-- 5. Verify resource master
-- Initial expected count: 12
-- ============================================

SELECT
    r.resource_id,
    r.source_material_id,
    rc.category_name,
    c.classification_name,
    r.resource_name,
    u.unit_code,
    r.is_active
FROM resources r
JOIN resource_classifications c
    ON c.classification_id = r.classification_id
JOIN resource_categories rc
    ON rc.category_id = c.category_id
JOIN units u
    ON u.unit_id = r.unit_id
WHERE r.company_id = @validation_company_id
ORDER BY
    rc.category_name,
    c.classification_name,
    r.resource_name;


-- ============================================
-- 6. Verify resource distribution
-- Expected: Materials = 7, Services = 5,
-- Equipment = 0
-- ============================================

SELECT
    rc.category_name,
    COUNT(DISTINCT c.classification_id)
        AS total_classifications,
    COUNT(r.resource_id)
        AS total_resources
FROM resource_categories rc
LEFT JOIN resource_classifications c
    ON c.category_id = rc.category_id
   AND c.company_id = @validation_company_id
LEFT JOIN resources r
    ON r.classification_id = c.classification_id
GROUP BY rc.category_id, rc.category_name
ORDER BY rc.category_name;


-- ============================================
-- 7. Verify initial seed identities
-- Expected: 12 selected source IDs
-- ============================================

SELECT
    12 AS expected_seed_records,
    COUNT(DISTINCT source_material_id)
        AS actual_seed_records
FROM resources
WHERE company_id = @validation_company_id
  AND source_material_id IN (
      '56851377',
      '37135391',
      '05917225',
      '74752529',
      '19175900',
      '37295260',
      '04265799',
      '11003626',
      '21931511',
      '88231132',
      '17232410',
      '76460539'
  );


-- ============================================
-- 8. Verify resource company consistency
-- Expected: 0 violations
-- ============================================

SELECT
    COUNT(*) AS resource_company_violations
FROM resources r
JOIN resource_classifications c
    ON c.classification_id = r.classification_id
WHERE r.company_id <> c.company_id;


-- ============================================
-- 9. Verify supplier classification ownership
-- Expected: 0 violations
-- ============================================

SELECT
    COUNT(*) AS supplier_company_violations
FROM provider_classifications pc
JOIN providers p
    ON p.provider_id = pc.provider_id
JOIN resource_classifications c
    ON c.classification_id = pc.classification_id
WHERE pc.company_id <> p.company_id
   OR pc.company_id <> c.company_id;


-- ============================================
-- 10. Verify supplier category consistency
-- Expected: 0 violations
-- ============================================

SELECT
    COUNT(*) AS supplier_category_violations
FROM provider_classifications pc
JOIN resource_classifications c
    ON c.classification_id = pc.classification_id
LEFT JOIN provider_categories pcat
    ON pcat.provider_id = pc.provider_id
   AND pcat.category_id = pc.category_id
WHERE pc.category_id <> c.category_id
   OR pcat.provider_id IS NULL;


-- ============================================
-- 11. Verify requirement resource ownership
-- Expected: 0 violations
-- ============================================

SELECT
    COUNT(*) AS requirement_company_violations
FROM requirement_items ri
JOIN requirements req
    ON req.requirement_id = ri.requirement_id
JOIN projects p
    ON p.project_id = req.project_id
JOIN resources r
    ON r.resource_id = ri.resource_id
WHERE r.company_id <> p.company_id;


-- ============================================
-- 12. Verify requirement resource category
-- Expected: 0 violations
-- ============================================

SELECT
    COUNT(*) AS requirement_category_violations
FROM requirement_items ri
JOIN requirements req
    ON req.requirement_id = ri.requirement_id
JOIN resources r
    ON r.resource_id = ri.resource_id
JOIN resource_classifications c
    ON c.classification_id = r.classification_id
WHERE req.category_id <> c.category_id;


-- ============================================
-- 13. Verify requirement resource unit
-- Expected: 0 violations
-- ============================================

SELECT
    COUNT(*) AS requirement_unit_violations
FROM requirement_items ri
JOIN resources r
    ON r.resource_id = ri.resource_id
WHERE ri.unit_id <> r.unit_id;


-- ============================================
-- 14. Verify existing requirement records
-- Legacy records must remain available
-- ============================================

SELECT
    COUNT(*) AS total_requirement_items,
    COUNT(resource_id) AS catalogue_based_items,
    COUNT(*) - COUNT(resource_id) AS legacy_items
FROM requirement_items;


-- ============================================
-- 15. Verify new foreign key constraints
-- ============================================

SELECT
    table_name,
    constraint_name,
    referenced_table_name,
    update_rule,
    delete_rule
FROM information_schema.referential_constraints
WHERE constraint_schema = 'software_business_dev'
  AND table_name IN (
      'resource_classifications',
      'resources',
      'provider_classifications',
      'requirement_items'
  )
ORDER BY table_name, constraint_name;


-- ============================================
-- 16. Final summary
-- ============================================

SELECT
    @validation_company_id AS company_id,

    (SELECT COUNT(*)
     FROM resource_classifications
     WHERE company_id = @validation_company_id)
        AS total_classifications,

    (SELECT COUNT(*)
     FROM resources
     WHERE company_id = @validation_company_id)
        AS total_resources,

    (SELECT COUNT(*)
     FROM provider_classifications
     WHERE company_id = @validation_company_id)
        AS supplier_capabilities,

    (SELECT COUNT(*)
     FROM units)
        AS total_units;


-- ============================================
-- End of Assignment #5 validation script
-- ============================================