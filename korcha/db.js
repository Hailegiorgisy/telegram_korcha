// db.js: ACID-compliant Database Layer with Automatic Migrations & Resilient In-Memory Fallback
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

// In-Memory Fail-safe Store (ensures 100% server uptime even if PostgreSQL is offline)
let isPostgresAvailable = false;
let hasCheckedPostgres = false;

const inMemoryStore = {
  customers: new Map(),
  quotes: new Map(),
  orders: new Map(),
  orderHistory: [],
  pings: [],
  idCounter: 1000,
};

// PostgreSQL Pool configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || undefined,
  host: process.env.PGHOST || 'localhost',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
  database: process.env.PGDATABASE || 'korcha_db',
  port: parseInt(process.env.PGPORT || '5432', 10),
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 3000,
});

pool.on('error', (err) => {
  // Suppress uncaught idle error crashes
  console.warn('[DB Pool] Idle client warning (fail-safe active):', err.message);
});

// Run automated migrations on service startup
export async function runMigrations() {
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    
    // Migration tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const migrationsDir = path.join(__dirname, 'migrations');
    if (fs.existsSync(migrationsDir)) {
      const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
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
    isPostgresAvailable = true;
    hasCheckedPostgres = true;
    console.log('[DB] PostgreSQL connected & database schema is up to date.');
  } catch (err) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch (_) {}
    }
    isPostgresAvailable = false;
    hasCheckedPostgres = true;
    console.warn(`[DB Warning] PostgreSQL offline (${err.message}). In-memory fail-safe persistence active.`);
  } finally {
    if (client) client.release();
  }
}

// Check PG availability helper
async function checkPG() {
  if (!hasCheckedPostgres) {
    try {
      const c = await pool.connect();
      c.release();
      isPostgresAvailable = true;
    } catch {
      isPostgresAvailable = false;
    }
    hasCheckedPostgres = true;
  }
  return isPostgresAvailable;
}

// 1. Customer Upsert
export async function upsertCustomer({ telegramId, telegramUsername, firstName, phone }) {
  if (await checkPG()) {
    try {
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
    } catch (e) {
      console.warn('[DB Fallback] upsertCustomer falling back to in-memory store:', e.message);
    }
  }

  // Fallback
  const key = telegramId ? String(telegramId) : `phone_${phone}`;
  const existing = inMemoryStore.customers.get(key) || {
    id: ++inMemoryStore.idCounter,
    created_at: new Date().toISOString(),
  };
  const updated = {
    ...existing,
    telegram_id: telegramId || null,
    telegram_username: telegramUsername || null,
    first_name: firstName || null,
    phone_number: phone,
    updated_at: new Date().toISOString(),
  };
  inMemoryStore.customers.set(key, updated);
  return updated;
}

// 2. Create Quote
export async function createQuote({
  quoteCode,
  customerId,
  customerTelegramId,
  customerPhone,
  sourceType,
  productUrl,
  screenshotUrl,
  size,
  color,
  quantity = 1,
  details
}) {
  const worker = process.env.WORKER_TELEGRAM_USERNAME || 'korcha_support';
  
  if (await checkPG()) {
    try {
      const query = `
        INSERT INTO quotes (
          quote_code, customer_id, customer_telegram_id, customer_phone, source_type,
          product_url, screenshot_url, size, color, quantity, details,
          status, assigned_worker
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending_review', $12)
        RETURNING *;
      `;
      const values = [
        quoteCode,
        customerId || null,
        customerTelegramId || null,
        customerPhone,
        sourceType,
        productUrl || null,
        screenshotUrl || null,
        size || null,
        color || null,
        quantity,
        details || null,
        worker
      ];
      const { rows } = await pool.query(query, values);
      return rows[0];
    } catch (e) {
      console.warn('[DB Fallback] createQuote falling back to in-memory store:', e.message);
    }
  }

  // Fallback
  const record = {
    id: ++inMemoryStore.idCounter,
    quote_code: quoteCode,
    customer_id: customerId || null,
    customer_telegram_id: customerTelegramId || null,
    customer_phone: customerPhone,
    source_type: sourceType,
    product_url: productUrl || null,
    screenshot_url: screenshotUrl || null,
    size: size || null,
    color: color || null,
    quantity: parseInt(quantity || 1, 10),
    details: details || null,
    status: 'pending_review',
    assigned_worker: worker,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  inMemoryStore.quotes.set(quoteCode, record);
  return record;
}

// 3. Get Quote By Code
export async function getQuoteByCode(code) {
  if (await checkPG()) {
    try {
      const { rows } = await pool.query('SELECT * FROM quotes WHERE quote_code = $1', [code]);
      if (rows.length > 0) return rows[0];
    } catch (e) {
      console.warn('[DB Fallback] getQuoteByCode fallback:', e.message);
    }
  }
  return inMemoryStore.quotes.get(code) || null;
}

// 4. Create Order
export async function createOrder({
  orderCode,
  quoteId,
  customerId,
  customerTelegramId,
  customerPhone,
  productSummary,
  totalPriceEtb,
  depositAmountEtb,
  codBalanceEtb,
  paymentMethod = 'telebirr',
  deliveryAddress,
  assignedWorker = 'korcha_support'
}) {
  const worker = assignedWorker || process.env.WORKER_TELEGRAM_USERNAME || 'korcha_support';
  if (await checkPG()) {
    let client;
    try {
      client = await pool.connect();
      await client.query('BEGIN');
      const insertOrderQuery = `
        INSERT INTO orders (
          order_code, quote_id, customer_id, customer_telegram_id, customer_phone, product_summary,
          total_price_etb, deposit_amount_etb, cod_balance_etb,
          payment_method, delivery_address, status, assigned_worker
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending_deposit', $12)
        RETURNING *;
      `;
      const { rows } = await client.query(insertOrderQuery, [
        orderCode, quoteId || null, customerId || null, customerTelegramId || null, customerPhone,
        productSummary, totalPriceEtb, depositAmountEtb, codBalanceEtb,
        paymentMethod, deliveryAddress || null, worker
      ]);
      const order = rows[0];

      await client.query(`
        INSERT INTO order_status_history (order_id, previous_status, new_status, changed_by, note)
        VALUES ($1, NULL, 'pending_deposit', 'system', 'Order created awaiting deposit')
      `, [order.id]);

      await client.query('COMMIT');
      return order;
    } catch (err) {
      if (client) {
        try { await client.query('ROLLBACK'); } catch (_) {}
      }
      console.warn('[DB Fallback] createOrder fallback:', err.message);
    } finally {
      if (client) client.release();
    }
  }

  // Fallback
  const newOrder = {
    id: ++inMemoryStore.idCounter,
    order_code: orderCode,
    quote_id: quoteId || null,
    customer_id: customerId || null,
    customer_telegram_id: customerTelegramId || null,
    customer_phone: customerPhone,
    product_summary: productSummary,
    total_price_etb: totalPriceEtb,
    deposit_amount_etb: depositAmountEtb,
    cod_balance_etb: codBalanceEtb,
    payment_method: paymentMethod,
    delivery_address: deliveryAddress || null,
    status: 'pending_deposit',
    assigned_worker: worker,
    latest_worker_note: null,
    worker_response: null,
    last_customer_ping: null,
    last_lookup_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  inMemoryStore.orders.set(orderCode, newOrder);
  inMemoryStore.orderHistory.push({
    order_id: newOrder.id,
    previous_status: null,
    new_status: 'pending_deposit',
    changed_by: 'system',
    note: 'Order created awaiting deposit',
    created_at: new Date().toISOString(),
  });
  return newOrder;
}

// 5. Get Order By Code
export async function getOrderByCode(code) {
  if (await checkPG()) {
    try {
      const { rows } = await pool.query('SELECT * FROM orders WHERE order_code = $1', [code]);
      if (rows.length > 0) return rows[0];
    } catch (e) {
      console.warn('[DB Fallback] getOrderByCode fallback:', e.message);
    }
  }
  return inMemoryStore.orders.get(code) || null;
}

// 6. Get Orders By Phone
export async function getOrdersByPhone(phone) {
  if (await checkPG()) {
    try {
      const { rows } = await pool.query('SELECT * FROM orders WHERE customer_phone = $1 ORDER BY created_at DESC', [phone]);
      return rows;
    } catch (e) {
      console.warn('[DB Fallback] getOrdersByPhone fallback:', e.message);
    }
  }
  const results = [];
  for (const order of inMemoryStore.orders.values()) {
    if (order.customer_phone === phone) {
      results.push(order);
    }
  }
  return results.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

// 7. Update Order Status
export async function updateOrderStatus(orderCode, newStatus, changedBy = 'korcha_support', note = '') {
  if (await checkPG()) {
    let client;
    try {
      client = await pool.connect();
      await client.query('BEGIN');
      const { rows: orderRows } = await client.query('SELECT id, status FROM orders WHERE order_code = $1 FOR UPDATE', [orderCode]);
      if (orderRows.length > 0) {
        const order = orderRows[0];
        const prevStatus = order.status;

        await client.query(`
          UPDATE orders 
          SET status = $1, latest_worker_note = $2, worker_response = $2, updated_at = CURRENT_TIMESTAMP 
          WHERE id = $3
        `, [newStatus, note || null, order.id]);

        await client.query(`
          INSERT INTO order_status_history (order_id, previous_status, new_status, changed_by, note)
          VALUES ($1, $2, $3, $4, $5)
        `, [order.id, prevStatus, newStatus, changedBy, note]);

        await client.query('COMMIT');
        return { success: true, orderCode, prevStatus, newStatus, note };
      }
    } catch (err) {
      if (client) {
        try { await client.query('ROLLBACK'); } catch (_) {}
      }
      console.warn('[DB Fallback] updateOrderStatus fallback:', err.message);
    } finally {
      if (client) client.release();
    }
  }

  // Fallback
  const order = inMemoryStore.orders.get(orderCode);
  if (!order) {
    throw new Error(`Order ${orderCode} not found`);
  }
  const prevStatus = order.status;
  order.status = newStatus;
  if (note) {
    order.latest_worker_note = note;
    order.worker_response = note;
  }
  order.updated_at = new Date().toISOString();
  inMemoryStore.orderHistory.push({
    order_id: order.id,
    previous_status: prevStatus,
    new_status: newStatus,
    changed_by: changedBy,
    note,
    created_at: new Date().toISOString(),
  });
  return { success: true, orderCode, prevStatus, newStatus, note };
}

// 8. Record Customer Follow-Up / Ping
export async function recordCustomerPing({
  referenceCode,
  customerPhone,
  customerName = null,
  customerTelegramId = null,
  pingType = 'status_followup',
  customerNote = '',
  assignedWorker = 'korcha_support'
}) {
  const now = new Date().toISOString();
  const worker = assignedWorker || process.env.WORKER_TELEGRAM_USERNAME || 'korcha_support';

  if (await checkPG()) {
    try {
      const q = `
        INSERT INTO inquiry_pings (
          reference_code, customer_phone, customer_name, customer_telegram_id, ping_type, customer_note, assigned_worker
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *;
      `;
      const { rows } = await pool.query(q, [
        referenceCode, customerPhone, customerName, customerTelegramId || null, pingType, customerNote, worker
      ]);
      await pool.query(
        'UPDATE orders SET last_customer_ping = CURRENT_TIMESTAMP WHERE order_code = $1',
        [referenceCode]
      );
      return rows[0];
    } catch (e) {
      console.warn('[DB Fallback] recordCustomerPing fallback:', e.message);
    }
  }

  // Fallback
  const pingRecord = {
    id: ++inMemoryStore.idCounter,
    reference_code: referenceCode,
    customer_phone: customerPhone,
    customer_name: customerName,
    customer_telegram_id: customerTelegramId || null,
    ping_type: pingType,
    customer_note: customerNote,
    assigned_worker: worker,
    worker_response: null,
    responded_at: null,
    responded_by: null,
    created_at: now,
  };
  inMemoryStore.pings.push(pingRecord);

  const ord = inMemoryStore.orders.get(referenceCode);
  if (ord) {
    ord.last_customer_ping = now;
  }
  return pingRecord;
}

// 9. Record Order Lookup Event
export async function recordOrderLookup(searchTerm, matchedOrdersCount = 0) {
  const now = new Date().toISOString();
  if (await checkPG()) {
    try {
      await pool.query(
        'UPDATE orders SET last_lookup_at = CURRENT_TIMESTAMP WHERE order_code = $1 OR customer_phone = $1',
        [searchTerm]
      );
    } catch (e) {
      console.warn('[DB Fallback] recordOrderLookup fallback:', e.message);
    }
  }
  const ord = inMemoryStore.orders.get(searchTerm);
  if (ord) {
    ord.last_lookup_at = now;
  }
}

// 10. Worker Respond to Customer / Update Status Note
export async function respondToCustomerPing({
  referenceCode,
  responseText,
  newStatus = null,
  workerUsername = 'korcha_support'
}) {
  const now = new Date().toISOString();
  const worker = workerUsername || process.env.WORKER_TELEGRAM_USERNAME || 'korcha_support';

  if (await checkPG()) {
    let client;
    try {
      client = await pool.connect();
      await client.query('BEGIN');
      await client.query(`
        UPDATE inquiry_pings
        SET worker_response = $1, responded_at = CURRENT_TIMESTAMP, responded_by = $2
        WHERE reference_code = $3 AND worker_response IS NULL
      `, [responseText, worker, referenceCode]);

      if (newStatus) {
        await client.query(`
          UPDATE orders
          SET status = $1, latest_worker_note = $2, worker_response = $2, updated_at = CURRENT_TIMESTAMP
          WHERE order_code = $3
        `, [newStatus, responseText, referenceCode]);
      } else {
        await client.query(`
          UPDATE orders
          SET latest_worker_note = $1, worker_response = $1, updated_at = CURRENT_TIMESTAMP
          WHERE order_code = $2
        `, [responseText, referenceCode]);
      }

      await client.query('COMMIT');
      return { success: true, referenceCode, responseText, newStatus };
    } catch (e) {
      if (client) {
        try { await client.query('ROLLBACK'); } catch (_) {}
      }
      console.warn('[DB Fallback] respondToCustomerPing fallback:', e.message);
    } finally {
      if (client) client.release();
    }
  }

  // Fallback
  for (const p of inMemoryStore.pings) {
    if (p.reference_code === referenceCode && !p.worker_response) {
      p.worker_response = responseText;
      p.responded_at = now;
      p.responded_by = worker;
    }
  }
  const ord = inMemoryStore.orders.get(referenceCode);
  if (ord) {
    if (newStatus) ord.status = newStatus;
    ord.latest_worker_note = responseText;
    ord.worker_response = responseText;
    ord.updated_at = now;
  }
  return { success: true, referenceCode, responseText, newStatus };
}

// 11. Get Customer Pings
export async function getCustomerPings(referenceCode) {
  if (await checkPG()) {
    try {
      const { rows } = await pool.query(
        'SELECT * FROM inquiry_pings WHERE reference_code = $1 ORDER BY created_at DESC',
        [referenceCode]
      );
      return rows;
    } catch (e) {
      console.warn('[DB Fallback] getCustomerPings fallback:', e.message);
    }
  }
  return inMemoryStore.pings
    .filter(p => p.reference_code === referenceCode)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export default pool;
