const { engine } = require('express-handlebars');
const express = require('express');
const db = require('./db');

const app = express();
app.use(express.urlencoded({ extended: true }));
app.engine('handlebars', engine());
app.set('view engine', 'handlebars');
const host = '127.0.0.1';
const port = 3001;

app.get('/', (req, res) => {
  res.send('Software Business - Express is running.');
});

app.get('/categories', async (req, res) => {
  try {
    const [categories] = await db.execute(
      `SELECT category_id, category_code, category_name
       FROM resource_categories
       ORDER BY category_id`
    );
    res.json(categories);
  } catch (error) {
    console.error('Could not read supplier categories:', error.code || error.name);
    res.status(500).send('Could not load supplier categories.');
  }
});

app.get('/suppliers', async (req, res) => {
  try {
    const [providers] = await db.execute(
      `SELECT provider_id, provider_name,
              contact_email, contact_phone
       FROM providers
       WHERE company_id = ?
       ORDER BY provider_name`,
      [1]
    );

    res.render('suppliers', { providers });
  } catch (error) {
    console.error('Supplier list error:', error.code);
    res.status(500).send('Could not load suppliers.');
  }
});

app.get('/suppliers/new', async (req, res) => {
  try {
    const [categories] = await db.execute(
      `SELECT category_id, category_code, category_name
       FROM resource_categories
       ORDER BY category_id`
    );

    res.render('supplier-new', { categories });
  } catch (error) {
    console.error('Add Supplier form error:', error.code);
    res.status(500).send('Could not load Add Supplier form.');
  }
});


app.post('/suppliers', async (req, res) => {
  // Support one or multiple selected values.
  const toArray = value =>
    value === undefined ? [] :
    Array.isArray(value) ? value : [value];

  const clean = value => String(value || '').trim();

  const providerName = clean(req.body.provider_name);
  const city = clean(req.body.city_or_county);
  const address = clean(req.body.address);
  const companyEmail = clean(req.body.contact_email);
  const companyPhone = clean(req.body.contact_phone);

  const categoryIds = [
    ...new Set(toArray(req.body.category_ids).map(Number))
  ];

  const names = toArray(req.body.contact_name);
  const positions = toArray(req.body.position_title);
  const phones = toArray(req.body.person_phone);
  const emails = toArray(req.body.person_email);
  const lineIds = toArray(req.body.line_id);
  const primaryIndex = Number(req.body.primary_contact);

  // Validate essential data and field lengths.
  if (
    !providerName || providerName.length > 255 ||
    city.length > 100 || address.length > 500 ||
    companyEmail.length > 255 || companyPhone.length > 100 ||
    categoryIds.length === 0 ||
    categoryIds.some(id => !Number.isSafeInteger(id) || id < 1) ||
    names.length === 0 || names.length > 30 ||
    !Number.isInteger(primaryIndex) ||
    primaryIndex < 0 || primaryIndex >= names.length
  ) {
    return res.status(400).send('Invalid supplier information.');
  }

  const contacts = names.map((name, i) => ({
    name: clean(name),
    position: clean(positions[i]),
    phone: clean(phones[i]),
    email: clean(emails[i]),
    lineId: clean(lineIds[i]),
    primary: i === primaryIndex ? 1 : 0
  }));

  if (contacts.some(c =>
    !c.name || c.name.length > 150 ||
    c.position.length > 100 || c.phone.length > 100 ||
    c.email.length > 255 || c.lineId.length > 100
  )) {
    return res.status(400).send('Invalid contact information.');
  }

  let connection;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // Verify the category IDs exist.
    const placeholders = categoryIds.map(() => '?').join(',');
    const [validCategories] = await connection.execute(
      `SELECT category_id FROM resource_categories
       WHERE category_id IN (${placeholders})`,
      categoryIds
    );

    if (validCategories.length !== categoryIds.length) {
      await connection.rollback();
      return res.status(400).send('Invalid supplier category.');
    }

    // Create supplier for the local demo contractor.
    const [result] = await connection.execute(
      `INSERT INTO providers
       (company_id, provider_name, city_or_county,
        address, contact_email, contact_phone)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [1, providerName, city || null, address || null,
       companyEmail || null, companyPhone || null]
    );

    const providerId = result.insertId;

    // Save supplier categories.
    for (const categoryId of categoryIds) {
      await connection.execute(
        `INSERT INTO provider_categories
         (provider_id, category_id) VALUES (?, ?)`,
        [providerId, categoryId]
      );
    }

    // Save each contact person.
    for (const contact of contacts) {
      await connection.execute(
        `INSERT INTO provider_contacts
         (provider_id, contact_name, position_title,
          contact_phone, contact_email, line_id, is_primary)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          providerId,
          contact.name,
          contact.position || null,
          contact.phone || null,
          contact.email || null,
          contact.lineId || null,
          contact.primary
        ]
      );
    }

    await connection.commit();
    res.redirect('/suppliers');

  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Create Supplier error:', error.code || error.message);
    res.status(500).send('Could not save supplier.');
  } finally {
    if (connection) connection.release();
  }
});


app.get('/suppliers/:id', async (req, res) => {
  const providerId = Number(req.params.id);

  if (!Number.isSafeInteger(providerId) || providerId < 1) {
    return res.status(400).send('Invalid supplier ID.');
  }

  try {
    const [providers] = await db.execute(
      `SELECT provider_id, provider_name, city_or_county,
              address, contact_email, contact_phone
       FROM providers
       WHERE provider_id = ? AND company_id = ?`,
      [providerId, 1]
    );

    if (providers.length === 0) {
      return res.status(404).send('Supplier not found.');
    }

    const [categories] = await db.execute(
      `SELECT rc.category_name
       FROM provider_categories pc
       JOIN resource_categories rc
         ON pc.category_id = rc.category_id
       WHERE pc.provider_id = ?
       ORDER BY rc.category_name`,
      [providerId]
    );

    const [contacts] = await db.execute(
      `SELECT contact_name, position_title,
              contact_phone, contact_email,
              line_id, is_primary
       FROM provider_contacts
       WHERE provider_id = ?
       ORDER BY is_primary DESC, contact_id`,
      [providerId]
    );

    res.render('supplier-detail', {
      provider: { ...providers[0] },
      categories: categories.map(row => ({ ...row })),
      contacts: contacts.map(row => ({ ...row }))
    });

  } catch (error) {
    console.error('Supplier detail error:', error.code || error.message);
    res.status(500).send('Could not load supplier details.');
  }
});

app.get('/suppliers/:id/edit', async (req, res) => {
  const providerId = Number(req.params.id);

  if (!Number.isSafeInteger(providerId) || providerId < 1) {
    return res.status(400).send('Invalid supplier ID.');
  }

  try {
    const [providers] = await db.execute(
      `SELECT provider_id, provider_name, city_or_county,
              address, contact_email, contact_phone
       FROM providers
       WHERE provider_id = ? AND company_id = ?`,
      [providerId, 1]
    );

    if (providers.length === 0) {
      return res.status(404).send('Supplier not found.');
    }

    const [selectedCategories] = await db.execute(
      `SELECT category_id FROM provider_categories
       WHERE provider_id = ?`,
      [providerId]
    );

    const selectedIds = new Set(
      selectedCategories.map(row => row.category_id)
    );

    const [categories] = await db.execute(
      `SELECT category_id, category_name
       FROM resource_categories
       ORDER BY category_id`
    );

    const [contacts] = await db.execute(
      `SELECT contact_id, contact_name, position_title,
              contact_phone, contact_email, line_id, is_primary
       FROM provider_contacts
       WHERE provider_id = ?
       ORDER BY contact_id`,
      [providerId]
    );

    res.render('supplier-edit', {
      provider: { ...providers[0] },
      categories: categories.map(category => ({
        ...category,
        selected: selectedIds.has(category.category_id)
      })),
      contacts: contacts.map(contact => ({ ...contact }))
    });

  } catch (error) {
    console.error('Edit Supplier error:', error.code || error.message);
    res.status(500).send('Could not load Edit Supplier form.');
  }
});


app.post('/suppliers/:id/update', async (req, res) => {
  const providerId = Number(req.params.id);
  const companyId = 1; // Local demo contractor only

  const toArray = value =>
    value === undefined ? [] :
    Array.isArray(value) ? value : [value];

  const clean = value =>
    typeof value === 'string' ? value.trim() : '';

  if (!Number.isSafeInteger(providerId) || providerId < 1) {
    return res.status(400).send('Invalid supplier ID.');
  }

  const name = clean(req.body.provider_name);
  const city = clean(req.body.city_or_county);
  const address = clean(req.body.address);
  const email = clean(req.body.contact_email);
  const phone = clean(req.body.contact_phone);

  const categoryIds = [...new Set(
    toArray(req.body.category_ids).map(Number)
  )];

  const ids = toArray(req.body.contact_id);
  const names = toArray(req.body.contact_name);
  const positions = toArray(req.body.position_title);
  const phones = toArray(req.body.person_phone);
  const emails = toArray(req.body.person_email);
  const lines = toArray(req.body.line_id);
  const primaryIndex = Number(req.body.primary_contact);

  // Validate company and category information.
  if (
    !name || name.length > 255 ||
    city.length > 100 || address.length > 500 ||
    email.length > 255 || phone.length > 100 ||
    categoryIds.length === 0 ||
    categoryIds.some(id => !Number.isSafeInteger(id) || id < 1)
  ) {
    return res.status(400).send('Invalid supplier information.');
  }

  // All contact fields must have matching row counts.
  const count = names.length;

  if (
    count < 1 || count > 30 ||
    [ids, positions, phones, emails, lines]
      .some(values => values.length !== count) ||
    !Number.isInteger(primaryIndex) ||
    primaryIndex < 0 || primaryIndex >= count
  ) {
    return res.status(400).send('Invalid contact list.');
  }

  const contacts = names.map((value, i) => {
    const rawId = clean(ids[i]);
    const contactId = rawId === '' ? null : Number(rawId);

    return {
      id: contactId,
      name: clean(value),
      position: clean(positions[i]),
      phone: clean(phones[i]),
      email: clean(emails[i]),
      line: clean(lines[i]),
      primary: i === primaryIndex ? 1 : 0
    };
  });

  if (contacts.some(c =>
    (c.id !== null &&
      (!Number.isSafeInteger(c.id) || c.id < 1)) ||
    !c.name || c.name.length > 150 ||
    c.position.length > 100 ||
    c.phone.length > 100 ||
    c.email.length > 255 ||
    c.line.length > 100
  )) {
    return res.status(400).send('Invalid contact information.');
  }

  let connection;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // Ensure the supplier belongs to the demo company.
    const [providers] = await connection.execute(
      `SELECT provider_id FROM providers
       WHERE provider_id = ? AND company_id = ?
       FOR UPDATE`,
      [providerId, companyId]
    );

    if (providers.length === 0) {
      await connection.rollback();
      return res.status(404).send('Supplier not found.');
    }

    // Validate category IDs.
    const placeholders = categoryIds.map(() => '?').join(',');
    const [validCategories] = await connection.execute(
      `SELECT category_id FROM resource_categories
       WHERE category_id IN (${placeholders})`,
      categoryIds
    );

    if (validCategories.length !== categoryIds.length) {
      await connection.rollback();
      return res.status(400).send('Invalid supplier category.');
    }

    // Verify submitted contact IDs belong to this supplier.
    const [existingContacts] = await connection.execute(
      `SELECT contact_id FROM provider_contacts
       WHERE provider_id = ? FOR UPDATE`,
      [providerId]
    );

    const existingIds = new Set(
      existingContacts.map(row => Number(row.contact_id))
    );

    const submittedIds = contacts
      .filter(c => c.id !== null)
      .map(c => c.id);

    if (
      new Set(submittedIds).size !== submittedIds.length ||
      submittedIds.some(id => !existingIds.has(id))
    ) {
      await connection.rollback();
      return res.status(400).send('Invalid contact ID.');
    }

    // Update company details.
    await connection.execute(
      `UPDATE providers
       SET provider_name = ?, city_or_county = ?,
           address = ?, contact_email = ?, contact_phone = ?
       WHERE provider_id = ? AND company_id = ?`,
      [
        name, city || null, address || null,
        email || null, phone || null,
        providerId, companyId
      ]
    );

    // Replace category associations.
    await connection.execute(
      `DELETE FROM provider_categories WHERE provider_id = ?`,
      [providerId]
    );

    for (const categoryId of categoryIds) {
      await connection.execute(
        `INSERT INTO provider_categories
         (provider_id, category_id) VALUES (?, ?)`,
        [providerId, categoryId]
      );
    }

    // Remove contacts deleted from the form.
    const keepIds = new Set(submittedIds);
    for (const oldId of existingIds) {
      if (!keepIds.has(oldId)) {
        await connection.execute(
          `DELETE FROM provider_contacts
           WHERE contact_id = ? AND provider_id = ?`,
          [oldId, providerId]
        );
      }
    }

    // Update existing contacts or insert new contacts.
    for (const c of contacts) {
      const values = [
        c.name, c.position || null, c.phone || null,
        c.email || null, c.line || null, c.primary
      ];

      if (c.id !== null) {
        await connection.execute(
          `UPDATE provider_contacts
           SET contact_name = ?, position_title = ?,
               contact_phone = ?, contact_email = ?,
               line_id = ?, is_primary = ?
           WHERE contact_id = ? AND provider_id = ?`,
          [...values, c.id, providerId]
        );
      } else {
        await connection.execute(
          `INSERT INTO provider_contacts
           (provider_id, contact_name, position_title,
            contact_phone, contact_email, line_id, is_primary)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [providerId, ...values]
        );
      }
    }

    await connection.commit();
    res.redirect(303, `/suppliers/${providerId}`);

  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Update Supplier error:', error.code || error.message);
    res.status(500).send('Could not update supplier.');
  } finally {
    if (connection) connection.release();
  }
});


app.post('/suppliers/:id/delete', async (req, res) => {
  const providerId = Number(req.params.id);
  const companyId = 1; // Local demo contractor only

  if (!Number.isSafeInteger(providerId) || providerId < 1) {
    return res.status(400).send('Invalid supplier ID.');
  }

  let connection;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // Verify supplier ownership.
    const [providers] = await connection.execute(
      `SELECT provider_id
       FROM providers
       WHERE provider_id = ? AND company_id = ?
       FOR UPDATE`,
      [providerId, companyId]
    );

    if (providers.length === 0) {
      await connection.rollback();
      return res.status(404).send('Supplier not found.');
    }

    // Remove related contact persons.
    await connection.execute(
      `DELETE FROM provider_contacts
       WHERE provider_id = ?`,
      [providerId]
    );

    // Remove supplier category associations.
    await connection.execute(
      `DELETE FROM provider_categories
       WHERE provider_id = ?`,
      [providerId]
    );

    // Delete the supplier.
    await connection.execute(
      `DELETE FROM providers
       WHERE provider_id = ? AND company_id = ?`,
      [providerId, companyId]
    );

    await connection.commit();
    res.redirect(303, '/suppliers');

  } catch (error) {
    if (connection) await connection.rollback();

    console.error('Delete Supplier error:',
      error.code || error.message);

    if (error.code === 'ER_ROW_IS_REFERENCED_2' ||
        error.code === 'ER_ROW_IS_REFERENCED') {
      return res.status(409).send(
        'Cannot delete a supplier linked to other records.'
      );
    }

    res.status(500).send('Could not delete supplier.');
  } finally {
    if (connection) connection.release();
  }
});

app.get('/requirements', async (req, res) => {
  try {
    const [requirements] = await db.execute(
      `SELECT
         r.requirement_id,
         r.title,
         p.project_name,
         rc.category_name,
         DATE_FORMAT(r.needed_by, '%Y-%m-%d') AS needed_by,
         r.status
       FROM requirements r
       JOIN projects p
         ON r.project_id = p.project_id
       JOIN resource_categories rc
         ON r.category_id = rc.category_id
       WHERE p.company_id = ?
       ORDER BY r.requirement_id DESC`,
      [1]
    );

    res.render('requirements', {
      requirements: requirements.map(row => ({
        ...row,
        needed_by: row.needed_by || 'Not specified'
      }))
    });

  } catch (error) {
    console.error('Requirements list error:',
      error.code || error.message);

    res.status(500).send(
      'Could not load procurement requirements.'
    );
  }
});

app.get('/requirements/new', async (req, res) => {
  try {
    const [projects] = await db.execute(
      `SELECT project_id, project_name
       FROM projects
       WHERE company_id = ? AND status = 'ACTIVE'
       ORDER BY project_name`,
      [1]
    );

    const [categories] = await db.execute(
      `SELECT category_id, category_name
       FROM resource_categories
       ORDER BY category_id`
    );

    const [units] = await db.execute(
      `SELECT unit_id, unit_code, unit_name
       FROM units
       ORDER BY unit_id`
    );

    res.render('requirement-new', {
      projects: projects.map(row => ({ ...row })),
      categories: categories.map(row => ({ ...row })),
      units: units.map(row => ({ ...row }))
    });

  } catch (error) {
    console.error('Add Requirement form error:',
      error.code || error.message);

    res.status(500).send(
      'Could not load Add Requirement form.'
    );
  }
});


app.post('/requirements', async (req, res) => {
  const companyId = 1; // Demo Contractor
  const demoUserId = 1; // Demo Procurement Officer

  const toArray = value =>
    value === undefined ? [] :
    Array.isArray(value) ? value : [value];

  const clean = value =>
    typeof value === 'string' ? value.trim() : '';

  const projectId = Number(req.body.project_id);
  const categoryId = Number(req.body.category_id);
  const title = clean(req.body.title);
  const neededBy = clean(req.body.needed_by);

  const descriptions = toArray(req.body.item_description);
  const quantities = toArray(req.body.required_qty);
  const unitIds = toArray(req.body.unit_id);

  // Validate requirement information.
  if (
    !Number.isSafeInteger(projectId) || projectId < 1 ||
    !Number.isSafeInteger(categoryId) || categoryId < 1 ||
    !title || title.length > 255
  ) {
    return res.status(400).send(
      'Invalid procurement requirement information.'
    );
  }

  // Validate optional date.
  if (neededBy) {
    const date = new Date(neededBy + 'T00:00:00Z');

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(neededBy) ||
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== neededBy
    ) {
      return res.status(400).send('Invalid needed-by date.');
    }
  }

  // Validate item counts.
  if (
    descriptions.length < 1 ||
    descriptions.length > 30 ||
    quantities.length !== descriptions.length ||
    unitIds.length !== descriptions.length
  ) {
    return res.status(400).send('Invalid requirement items.');
  }

  const items = descriptions.map((description, index) => ({
    description: clean(description),
    quantity: clean(quantities[index]),
    unitId: Number(unitIds[index])
  }));

  // Validate descriptions, quantities and units.
  if (items.some(item =>
    !item.description ||
    item.description.length > 500 ||
    !/^(?:0|[1-9]\d{0,10})(?:\.\d{1,3})?$/.test(item.quantity) ||
    Number(item.quantity) <= 0 ||
    !Number.isSafeInteger(item.unitId) ||
    item.unitId < 1
  )) {
    return res.status(400).send(
      'Invalid item description, quantity or unit.'
    );
  }

  let connection;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // Verify the project belongs to Demo Contractor.
    const [projects] = await connection.execute(
      `SELECT project_id FROM projects
       WHERE project_id = ?
         AND company_id = ?
         AND status = 'ACTIVE'`,
      [projectId, companyId]
    );

    if (projects.length === 0) {
      await connection.rollback();
      return res.status(400).send('Invalid project.');
    }

    // Verify the resource category.
    const [categories] = await connection.execute(
      `SELECT category_id FROM resource_categories
       WHERE category_id = ?`,
      [categoryId]
    );

    if (categories.length === 0) {
      await connection.rollback();
      return res.status(400).send('Invalid category.');
    }

    // Verify all measurement units.
    const uniqueUnitIds = [...new Set(items.map(i => i.unitId))];
    const placeholders = uniqueUnitIds.map(() => '?').join(',');

    const [validUnits] = await connection.execute(
      `SELECT unit_id FROM units
       WHERE unit_id IN (${placeholders})`,
      uniqueUnitIds
    );

    if (validUnits.length !== uniqueUnitIds.length) {
      await connection.rollback();
      return res.status(400).send('Invalid measurement unit.');
    }

    // Find the demo user's assignment to this project.
    const [assignments] = await connection.execute(
      `SELECT pa.assignment_id
       FROM project_assignments pa
       JOIN company_memberships cm
         ON pa.membership_id = cm.membership_id
       JOIN roles r
         ON pa.role_id = r.role_id
       WHERE pa.project_id = ?
         AND cm.company_id = ?
         AND cm.user_id = ?
         AND cm.status = 'ACTIVE'
         AND r.role_code = 'PROCUREMENT_OFFICER'
         AND r.scope = 'PROJECT'
       LIMIT 1`,
      [projectId, companyId, demoUserId]
    );

    if (assignments.length === 0) {
      await connection.rollback();
      return res.status(400).send(
        'No valid project assignment found.'
      );
    }

    // Create procurement requirement.
    const [result] = await connection.execute(
      `INSERT INTO requirements
       (project_id, category_id,
        created_by_assignment_id, title,
        needed_by, status)
       VALUES (?, ?, ?, ?, ?, 'DRAFT')`,
      [
        projectId,
        categoryId,
        assignments[0].assignment_id,
        title,
        neededBy || null
      ]
    );

    const requirementId = result.insertId;

    // Save requirement items.
    for (let index = 0; index < items.length; index++) {
      const item = items[index];

      await connection.execute(
        `INSERT INTO requirement_items
         (requirement_id, line_no,
          item_description, required_qty, unit_id)
         VALUES (?, ?, ?, ?, ?)`,
        [
          requirementId,
          index + 1,
          item.description,
          item.quantity,
          item.unitId
        ]
      );
    }

    await connection.commit();

    res.redirect(303, '/requirements');

  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    console.error(
      'Create Requirement error:',
      error.code || error.message
    );

    res.status(500).send(
      'Could not save procurement requirement.'
    );

  } finally {
    if (connection) {
      connection.release();
    }
  }
});


app.get('/requirements/:id', async (req, res) => {
  const requirementId = Number(req.params.id);

  if (!Number.isSafeInteger(requirementId) || requirementId < 1) {
    return res.status(400).send('Invalid requirement ID.');
  }

  try {
    
const [requirements] = await db.execute(
  `SELECT
     r.requirement_id,
     r.title,
     p.project_name,
     rc.category_name,
     DATE_FORMAT(r.needed_by, '%Y-%m-%d') AS needed_by,
     r.status,
     DATE_FORMAT(
       DATE_ADD(r.created_at, INTERVAL 8 HOUR),
       '%Y-%m-%d %H:%i'
     ) AS created_at
   FROM requirements r
   JOIN projects p
     ON r.project_id = p.project_id
   JOIN resource_categories rc
     ON r.category_id = rc.category_id
   WHERE r.requirement_id = ?
     AND p.company_id = ?`,
  [requirementId, 1]
);

    if (requirements.length === 0) {
      return res.status(404).send('Requirement not found.');
    }

    const [items] = await db.execute(
      `SELECT ri.line_no, ri.item_description,
              FORMAT(ri.required_qty, 2) AS quantity_display,
              u.unit_code
       FROM requirement_items ri
       JOIN units u ON ri.unit_id = u.unit_id
       WHERE ri.requirement_id = ?
       ORDER BY ri.line_no`,
      [requirementId]
    );

    res.render('requirement-detail', {
      requirement: {
        ...requirements[0],
        needed_by: requirements[0].needed_by || 'Not specified'
      },
      items: items.map(item => ({ ...item }))
    });

  } catch (error) {
    console.error('Requirement detail error:', error);
    res.status(500).send('Could not load requirement details.');
  }
});

app.get('/requirements/:id/edit', async (req, res) => {
  const requirementId = Number(req.params.id);
  const companyId = 1; // Demo Contractor

  if (!Number.isSafeInteger(requirementId) || requirementId < 1) {
    return res.status(400).send('Invalid requirement ID.');
  }

  try {
    const [requirements] = await db.execute(
      `SELECT
         r.requirement_id,
         r.project_id,
         r.category_id,
         r.title,
         DATE_FORMAT(r.needed_by, '%Y-%m-%d') AS needed_by,
         r.status
       FROM requirements r
       JOIN projects p ON r.project_id = p.project_id
       WHERE r.requirement_id = ?
         AND p.company_id = ?`,
      [requirementId, companyId]
    );

    if (requirements.length === 0) {
      return res.status(404).send('Requirement not found.');
    }

    const requirement = requirements[0];

    const [projects] = await db.execute(
      `SELECT project_id, project_name
       FROM projects
       WHERE company_id = ?
       ORDER BY project_name`,
      [companyId]
    );

    const [categories] = await db.execute(
      `SELECT category_id, category_name
       FROM resource_categories
       ORDER BY category_id`
    );

    const [units] = await db.execute(
      `SELECT unit_id, unit_code
       FROM units
       ORDER BY unit_id`
    );

    const [items] = await db.execute(
      `SELECT item_id, line_no, item_description,
              CAST(required_qty AS CHAR) AS required_qty,
              unit_id
       FROM requirement_items
       WHERE requirement_id = ?
       ORDER BY line_no`,
      [requirementId]
    );

    res.render('requirement-edit', {
      requirement,
      projects: projects.map(p => ({
        ...p,
        selected: Number(p.project_id) ===
          Number(requirement.project_id)
      })),
      categories: categories.map(c => ({
        ...c,
        selected: Number(c.category_id) ===
          Number(requirement.category_id)
      })),
      units,
      items: items.map(item => ({
        ...item,
        units: units.map(u => ({
          ...u,
          selected: Number(u.unit_id) ===
            Number(item.unit_id)
        }))
      })),
      statuses: ['DRAFT', 'READY', 'CANCELLED'].map(status => ({
        value: status,
        selected: requirement.status === status
      }))
    });

  } catch (error) {
    console.error('Requirement edit error:',
      error.code || error.message);

    res.status(500).send(
      'Could not load requirement edit form.'
    );
  }
});

app.post('/requirements/:id/update', async (req, res) => {
  const companyId = 1; // Local demo contractor
  const requirementId = Number(req.params.id);

  const fail = (message, status = 400) => {
    const error = new Error(message);
    error.status = status;
    return error;
  };

  const asArray = (name) => {
    const value = req.body[name] ?? req.body[`${name}[]`];
    if (value === undefined) return [];
    return Array.isArray(value) ? value : [value];
  };

  let connection;

  try {
    if (!Number.isSafeInteger(requirementId) ||
        requirementId < 1) {
      throw fail('Invalid requirement ID.');
    }

    const projectId = Number(req.body.project_id);
    const categoryId = Number(req.body.category_id);
    const title = String(req.body.title || '').trim();
    const status = req.body.status;
    const neededBy = String(req.body.needed_by || '').trim();

    if (!Number.isSafeInteger(projectId) || projectId < 1 ||
        !Number.isSafeInteger(categoryId) || categoryId < 1) {
      throw fail('Invalid project or category.');
    }

    if (!title || title.length > 255) {
      throw fail('Requirement title must contain 1–255 characters.');
    }

    if (!['DRAFT', 'READY', 'CANCELLED'].includes(status)) {
      throw fail('Invalid requirement status.');
    }

    if (neededBy) {
      const date = new Date(`${neededBy}T00:00:00Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(neededBy) ||
          Number.isNaN(date.getTime()) ||
          date.toISOString().slice(0, 10) !== neededBy) {
        throw fail('Invalid required date.');
      }
    }

    const itemIds = asArray('item_id');
    const descriptions = asArray('item_description');
    const quantities = asArray('required_qty');
    const unitIds = asArray('unit_id');

    if (descriptions.length < 1 || descriptions.length > 30 ||
        itemIds.length !== descriptions.length ||
        quantities.length !== descriptions.length ||
        unitIds.length !== descriptions.length) {
      throw fail('A requirement must contain 1–30 complete items.');
    }

    const items = descriptions.map((description, index) => {
      const rawId = String(itemIds[index] ?? '').trim();
      const itemId = rawId ? Number(rawId) : null;
      const itemDescription = String(description || '').trim();
      const quantity = String(quantities[index] ?? '').trim();
      const unitId = Number(unitIds[index]);

      if (rawId &&
          (!Number.isSafeInteger(itemId) || itemId < 1)) {
        throw fail(`Invalid item ID at line ${index + 1}.`);
      }

      if (!itemDescription || itemDescription.length > 500) {
        throw fail(`Invalid description at line ${index + 1}.`);
      }

      if (!/^\d{1,11}(\.\d{1,2})?$/.test(quantity) ||
          Number(quantity) <= 0) {
        throw fail(`Invalid quantity at line ${index + 1}.`);
      }

      if (!Number.isSafeInteger(unitId) || unitId < 1) {
        throw fail(`Invalid unit at line ${index + 1}.`);
      }

      return {
        itemId,
        lineNo: index + 1,
        itemDescription,
        quantity,
        unitId
      };
    });

    const submittedIds = items
      .filter(item => item.itemId !== null)
      .map(item => item.itemId);

    if (new Set(submittedIds).size !== submittedIds.length) {
      throw fail('Duplicate item IDs are not allowed.');
    }

    console.log('[UPDATE] Requesting database connection');

    connection = await db.getConnection();

    console.log('[UPDATE] Database connection acquired');
    
    await connection.beginTransaction();

    // Check that this requirement belongs to the demo company.
    const [existingRequirements] = await connection.execute(
      `SELECT r.requirement_id
       FROM requirements r
       JOIN projects p ON r.project_id = p.project_id
       WHERE r.requirement_id = ?
         AND p.company_id = ?
       FOR UPDATE`,
      [requirementId, companyId]
    );

    if (existingRequirements.length === 0) {
      throw fail('Requirement not found.', 404);
    }

    // Check that the selected project belongs to the company.
    const [projects] = await connection.execute(
      `SELECT project_id
       FROM projects
       WHERE project_id = ? AND company_id = ?`,
      [projectId, companyId]
    );

    if (projects.length === 0) {
      throw fail('Project does not belong to this company.');
    }

    const [categories] = await connection.execute(
      `SELECT category_id
       FROM resource_categories
       WHERE category_id = ?`,
      [categoryId]
    );

    if (categories.length === 0) {
      throw fail('Resource category not found.');
    }

    // Validate all units.
    for (const unitId of new Set(items.map(item => item.unitId))) {
      const [units] = await connection.execute(
        'SELECT unit_id FROM units WHERE unit_id = ?',
        [unitId]
      );

      if (units.length === 0) {
        throw fail(`Unit ${unitId} not found.`);
      }
    }

    // Check that submitted item IDs belong to this requirement.
    const [existingItems] = await connection.execute(
      `SELECT item_id
       FROM requirement_items
       WHERE requirement_id = ?
       FOR UPDATE`,
      [requirementId]
    );

    const existingIds = new Set(
      existingItems.map(row => Number(row.item_id))
    );

    for (const itemId of submittedIds) {
      if (!existingIds.has(itemId)) {
        throw fail('An item does not belong to this requirement.');
      }
    }

    // Update the requirement header.
    await connection.execute(
      `UPDATE requirements
       SET project_id = ?,
           category_id = ?,
           title = ?,
           needed_by = ?,
           status = ?
       WHERE requirement_id = ?`,
      [
        projectId,
        categoryId,
        title,
        neededBy || null,
        status,
        requirementId
      ]
    );

    const submittedIdSet = new Set(submittedIds);

    // Delete items removed from the edit form.
    for (const existingId of existingIds) {
      if (!submittedIdSet.has(existingId)) {
        await connection.execute(
          `DELETE FROM requirement_items
           WHERE item_id = ? AND requirement_id = ?`,
          [existingId, requirementId]
        );
      }
    }

    // Temporarily move line numbers to avoid UNIQUE conflicts
    // when existing items are reordered.
    await connection.execute(
      `UPDATE requirement_items
       SET line_no = line_no + 1000
       WHERE requirement_id = ?`,
      [requirementId]
    );

    // Update existing items and insert new items.
    for (const item of items) {
      if (item.itemId !== null) {
        await connection.execute(
          `UPDATE requirement_items
           SET line_no = ?,
               item_description = ?,
               required_qty = ?,
               unit_id = ?
           WHERE item_id = ? AND requirement_id = ?`,
          [
            item.lineNo,
            item.itemDescription,
            item.quantity,
            item.unitId,
            item.itemId,
            requirementId
          ]
        );
      } else {
        await connection.execute(
          `INSERT INTO requirement_items
             (requirement_id, line_no, item_description,
              required_qty, unit_id)
           VALUES (?, ?, ?, ?, ?)`,
          [
            requirementId,
            item.lineNo,
            item.itemDescription,
            item.quantity,
            item.unitId
          ]
        );
      }
    }

    await connection.commit();

    return res.redirect(303, `/requirements/${requirementId}`);

  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('Rollback error:', rollbackError);
      }
    }

    console.error('Requirement update error:', error);

    return res.status(error.status || 500).send(
      error.status
        ? error.message
        : 'Could not update procurement requirement.'
    );

  } finally {
    if (connection) {
      connection.release();
    }
  }
});


app.post('/requirements/:id/delete', async (req, res) => {
  const requirementId = Number(req.params.id);
  const companyId = 1; // Demo Contractor

  if (!Number.isSafeInteger(requirementId) || requirementId < 1) {
    return res.status(400).send('Invalid requirement ID.');
  }

  let connection;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // Verify requirement ownership.
    const [requirements] = await connection.execute(
      `SELECT r.requirement_id
       FROM requirements r
       JOIN projects p ON r.project_id = p.project_id
       WHERE r.requirement_id = ?
         AND p.company_id = ?
       FOR UPDATE`,
      [requirementId, companyId]
    );

    if (requirements.length === 0) {
      await connection.rollback();
      return res.status(404).send('Requirement not found.');
    }

    // Delete requirement and its associated items.
    // Related items are removed by ON DELETE CASCADE.
    await connection.execute(
      `DELETE FROM requirements
       WHERE requirement_id = ?`,
      [requirementId]
    );

    await connection.commit();

    return res.redirect(303, '/requirements');

  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('Rollback error:', rollbackError);
      }
    }

    console.error(
      'Requirement delete error:',
      error.code || error.message
    );

    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).send(
        'This requirement is referenced by other records.'
      );
    }

    return res.status(500).send(
      'Could not delete procurement requirement.'
    );

  } finally {
    if (connection) {
      connection.release();
    }
  }
});

app.listen(port, host, () => {
  console.log(`Server running at http://${host}:${port}`);
});