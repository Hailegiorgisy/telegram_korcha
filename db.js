// db.js: ACID-compliant Database Layer with Automatic Migrations & Shelf Persistence
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

// Pool configuration supporting DATABASE_URL or individual PG variables
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || undefined,
  host: process.env.PGHOST || 'localhost',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
  database: process.env.PGDATABASE || 'korcha_db',
  port: parseInt(process.env.PGPORT || '5432', 10),
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected idle client error:', err.message);
});

// Run automated migrations on service startup
export async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Migration tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Ensure shelf_products table exists (spec 3.1 & inventory extension)
    await client.query(`
      CREATE TABLE IF NOT EXISTS shelf_products (
        id VARCHAR(64) PRIMARY KEY,
        title_am VARCHAR(255) NOT NULL,
        title_en VARCHAR(255),
        category VARCHAR(64) NOT NULL,
        price_etb NUMERIC(12, 2) NOT NULL,
        description TEXT,
        photo_file_id VARCHAR(255),
        image_url TEXT,
        stock_quantity INTEGER DEFAULT 1,
        in_stock BOOLEAN DEFAULT TRUE,
        badge VARCHAR(100) DEFAULT 'በእጅ ላይ ያለ (In Stock)',
        delivery_time VARCHAR(255) DEFAULT 'ዛሬውኑ ወይም በ24 ሰዓት ውስጥ ይረከቡ',
        added_by VARCHAR(100),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_shelf_category ON shelf_products(category);
    `);

    const migrationsDir = path.join(__dirname, 'migrations');
    if (fs.existsSync(migrationsDir)) {
      const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
      for (const file of files) {
        const { rows } = await client.query('SELECT version FROM schema_migrations WHERE version = $1', [file]);
        if (rows.length === 0) {
          console.log(`[DB Migration] Applying ${file}...`);
          const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
          await client.query(sql);
          await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
          console.log(`[DB Migration] Successfully applied ${file}`);
        }
      }
    }
    await client.query('COMMIT');
    console.log('[DB] Database schema is up to date.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[DB Migration Error]', err);
    throw err;
  } finally {
    client.release();
  }
}

// ----------------------------------------------------
// CUSTOMER & QUOTE QUERIES (SPEC SECTION 4)
// ----------------------------------------------------
export async function upsertCustomer({ telegramId, telegramUsername, firstName, phone }) {
  const query = `
    INSERT INTO customers (telegram_id, telegram_username, first_name, phone_number, updated_at)
    VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
    ON CONFLICT (telegram_id) DO UPDATE 
    SET telegram_username = EXCLUDED.telegram_username,
        first_name = EXCLUDED.first_name,
        phone_number = EXCLUDED.phone_number,
        updated_at = CURRENT_TIMESTAMP
    RETURNING *;
  `;
  const { rows } = await pool.query(query, [telegramId || null, telegramUsername || null, firstName || null, phone]);
  return rows[0];
}

export async function createQuote({
  quoteCode,
  customerId,
  customerPhone,
  sourceType,
  productUrl,
  screenshotUrl,
  size,
  color,
  quantity = 1,
  details,
}) {
  const query = `
    INSERT INTO quotes (
      quote_code, customer_id, customer_phone, source_type,
      product_url, screenshot_url, size, color, quantity, details,
      status, assigned_worker
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending_review', $11)
    RETURNING *;
  `;
  const worker = process.env.WORKER_TELEGRAM_USERNAME || 'korcha_support';
  const values = [
    quoteCode,
    customerId || null,
    customerPhone,
    sourceType,
    productUrl || null,
    screenshotUrl || null,
    size || null,
    color || null,
    quantity,
    details || null,
    worker,
  ];
  const { rows } = await pool.query(query, values);
  return rows[0];
}

export async function getQuoteByCode(code) {
  const { rows } = await pool.query('SELECT * FROM quotes WHERE quote_code = $1', [code]);
  return rows[0] || null;
}

// ----------------------------------------------------
// ORDER MANAGEMENT QUERIES (SPEC SECTION 4)
// ----------------------------------------------------
export async function createOrder({
  orderCode,
  quoteId,
  customerId,
  customerPhone,
  productSummary,
  totalPriceEtb,
  depositAmountEtb,
  codBalanceEtb,
  paymentMethod = 'telebirr',
  deliveryAddress,
}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const insertOrderQuery = `
      INSERT INTO orders (
        order_code, quote_id, customer_id, customer_phone, product_summary,
        total_price_etb, deposit_amount_etb, cod_balance_etb,
        payment_method, delivery_address, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending_deposit')
      RETURNING *;
    `;
    const { rows } = await client.query(insertOrderQuery, [
      orderCode,
      quoteId || null,
      customerId || null,
      customerPhone,
      productSummary,
      totalPriceEtb,
      depositAmountEtb,
      codBalanceEtb,
      paymentMethod,
      deliveryAddress || null,
    ]);
    const order = rows[0];

    // Audit history entry
    await client.query(
      `
      INSERT INTO order_status_history (order_id, previous_status, new_status, changed_by, note)
      VALUES ($1, NULL, 'pending_deposit', 'system', 'Order created awaiting deposit')
    `,
      [order.id]
    );

    await client.query('COMMIT');
    return order;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getOrderByCode(code) {
  const { rows } = await pool.query('SELECT * FROM orders WHERE order_code = $1', [code]);
  return rows[0] || null;
}

export async function getOrdersByPhone(phone) {
  const { rows } = await pool.query('SELECT * FROM orders WHERE customer_phone = $1 ORDER BY created_at DESC', [
    phone,
  ]);
  return rows;
}

export async function updateOrderStatus(orderCode, newStatus, changedBy = 'korcha_support', note = '') {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: orderRows } = await client.query(
      'SELECT id, status FROM orders WHERE order_code = $1 FOR UPDATE',
      [orderCode]
    );
    if (orderRows.length === 0) {
      throw new Error(`Order ${orderCode} not found`);
    }
    const order = orderRows[0];
    const prevStatus = order.status;

    await client.query(
      `
      UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2
    `,
      [newStatus, order.id]
    );

    await client.query(
      `
      INSERT INTO order_status_history (order_id, previous_status, new_status, changed_by, note)
      VALUES ($1, $2, $3, $4, $5)
    `,
      [order.id, prevStatus, newStatus, changedBy, note]
    );

    await client.query('COMMIT');
    return { success: true, orderCode, prevStatus, newStatus };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ----------------------------------------------------
// ON-HAND SHELF PRODUCT PERSISTENCE (WORKER INVENTORY)
// ----------------------------------------------------
export async function createShelfProduct({
  id,
  titleAm,
  titleEn,
  category,
  priceEtb,
  description,
  photoFileId,
  image,
  stockQuantity = 1,
  inStock = true,
  badge = 'በእጅ ላይ ያለ (In Stock)',
  deliveryTime = 'ዛሬውኑ ወይም በ24 ሰዓት ውስጥ ይረከቡ',
  addedBy,
}) {
  const query = `
    INSERT INTO shelf_products (
      id, title_am, title_en, category, price_etb, description,
      photo_file_id, image_url, stock_quantity, in_stock, badge, delivery_time, added_by
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    ON CONFLICT (id) DO UPDATE SET
      title_am = EXCLUDED.title_am,
      price_etb = EXCLUDED.price_etb,
      description = EXCLUDED.description,
      stock_quantity = EXCLUDED.stock_quantity,
      in_stock = EXCLUDED.in_stock
    RETURNING *;
  `;
  const values = [
    id || `shelf-${Date.now()}`,
    titleAm,
    titleEn || titleAm,
    category,
    priceEtb,
    description || null,
    photoFileId || null,
    image || null,
    stockQuantity,
    inStock,
    badge,
    deliveryTime,
    addedBy || null,
  ];
  const { rows } = await pool.query(query, values);
  return rows[0];
}

export async function getShelfProducts(category = null) {
  let query = 'SELECT * FROM shelf_products WHERE in_stock = TRUE';
  const params = [];
  if (category && category !== 'all') {
    query += ' AND LOWER(category) = LOWER($1)';
    params.push(category);
  }
  query += ' ORDER BY created_at DESC';
  const { rows } = await pool.query(query, params);
  return rows.map((r) => ({
    id: r.id,
    titleAm: r.title_am,
    titleEn: r.title_en,
    category: r.category,
    priceEtb: parseFloat(r.price_etb),
    description: r.description,
    photoFileId: r.photo_file_id,
    image: r.image_url || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=80',
    stockQuantity: r.stock_quantity,
    inStock: r.in_stock,
    badge: r.badge,
    deliveryTime: r.delivery_time,
    addedBy: r.added_by,
    createdAt: r.created_at,
  }));
}

export async function deleteShelfProduct(id) {
  const { rows } = await pool.query('DELETE FROM shelf_products WHERE id = $1 RETURNING *;', [id]);
  return rows[0] || null;
}

export default pool;
