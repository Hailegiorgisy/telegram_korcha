// db.js: ACID-compliant Database Layer with Automatic Migrations, Resilient In-Memory Fallback & Background Reconciliation Sync
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
let isReconciling = false;

const inMemoryStore = {
  customers: new Map(),
  quotes: new Map(),
  orders: new Map(),
  orderHistory: [],
  pings: [],
  ticketMessages: [],
  shelfCategories: [
    { id: 'womens', nameAm: 'የሴቶች አልባሳት', nameEn: "Women's Clothing", icon: '👗', color: 'from-pink-500 to-rose-600' },
    { id: 'kids', nameAm: 'የህጻናት', nameEn: 'Kids & Babies', icon: '🧸', color: 'from-amber-400 to-orange-500' },
    { id: 'beauty', nameAm: 'የመዋቢያ ዕቃዎች', nameEn: 'Beauty & Skin Care', icon: '💄', color: 'from-fuchsia-500 to-purple-600' },
    { id: 'electronics', nameAm: 'ኤሌክትሮኒክስ', nameEn: 'Electronics', icon: '📱', color: 'from-blue-500 to-indigo-600' },
    { id: 'home', nameAm: 'የቤት ውስጥ መገልገያዎች', nameEn: 'Home & Kitchen', icon: '🍳', color: 'from-stone-600 to-stone-800' },
    { id: 'miscellaneous', nameAm: 'Miscellaneous (ሌሎች)', nameEn: 'Miscellaneous (Other)', icon: '✨', color: 'from-emerald-500 to-teal-700' }
  ],
  shelfProducts: [
    {
      id: 1,
      category_id: 'womens',
      name: 'Shein Floral Summer Maxi Dress',
      size: 'S, M, L, XL',
      price_etb: 2850,
      photo_url: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=500&auto=format&fit=crop&q=80',
      is_bestseller: true,
      created_by: 'korcha_support',
      syncedToPg: false,
      created_at: new Date().toISOString()
    },
    {
      id: 2,
      category_id: 'electronics',
      name: 'Wireless Bluetooth Earbuds Pro (Active Noise Cancelling)',
      size: 'One Size',
      price_etb: 3400,
      photo_url: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=500&auto=format&fit=crop&q=80',
      is_bestseller: true,
      created_by: 'korcha_support',
      syncedToPg: false,
      created_at: new Date().toISOString()
    },
    {
      id: 3,
      category_id: 'beauty',
      name: 'Hydrating Face Serum & Vitamin C Glow Complex',
      size: '50ml',
      price_etb: 1950,
      photo_url: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=500&auto=format&fit=crop&q=80',
      is_bestseller: true,
      created_by: 'korcha_support',
      syncedToPg: false,
      created_at: new Date().toISOString()
    },
    {
      id: 4,
      category_id: 'home',
      name: 'Electric Portable Coffee & Spice Grinder',
      size: '300ml',
      price_etb: 2200,
      photo_url: 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=500&auto=format&fit=crop&q=80',
      is_bestseller: true,
      created_by: 'korcha_support',
      syncedToPg: false,
      created_at: new Date().toISOString()
    }
  ],
  idCounter: 1000,
};

// PostgreSQL Pool configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || undefined,
  host: process.env.PGHOST || 'localhost',
  user: process.env.PGUSER || 'postgres',
  // Never hard-code production passwords. Empty password only allowed for local dev.
  password: process.env.PGPASSWORD || (process.env.NODE_ENV === 'production' ? undefined : 'postgres'),
  database: process.env.PGDATABASE || 'korcha_db',
  port: parseInt(process.env.PGPORT || '5432', 10),
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 3000,
});

pool.on('error', (err) => {
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
    // 5. Sync in-memory ticket messages
    if (inMemoryStore.ticketMessages) {
      for (const msg of inMemoryStore.ticketMessages) {
        if (msg.syncedToPg) continue;
        const q = `
          INSERT INTO ticket_messages (
            ticket_code, sender_role, sender_name, sender_telegram_id, customer_phone, message_text, created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT DO NOTHING;
        `;
        await client.query(q, [
          msg.ticket_code,
          msg.sender_role,
          msg.sender_name || null,
          msg.sender_telegram_id || null,
          msg.customer_phone || null,
          msg.message_text,
          msg.created_at || new Date()
        ]);
        msg.syncedToPg = true;
      }
    }

    // 6. Sync in-memory shelf products
    if (inMemoryStore.shelfProducts) {
      for (const prod of inMemoryStore.shelfProducts) {
        if (prod.syncedToPg) continue;
        const q = `
          INSERT INTO shelf_products (
            category_id, name, size, price_etb, photo_url, is_bestseller, created_by, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT DO NOTHING;
        `;
        await client.query(q, [
          prod.category_id,
          prod.name,
          prod.size || null,
          prod.price_etb,
          prod.photo_url,
          prod.is_bestseller || false,
          prod.created_by || 'korcha_support',
          prod.created_at || new Date(),
          prod.updated_at || new Date()
        ]);
        prod.syncedToPg = true;
      }
    }

    await client.query('COMMIT');
    isPostgresAvailable = true;
    hasCheckedPostgres = true;
    console.log('[DB] PostgreSQL connected & database schema is up to date.');

    // Attempt reconciliation if any records exist in-memory
    await syncFallbackToPostgres();
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
export async function checkPG() {
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
    syncedToPg: false,
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
  customerTelegramUsername,
  customerPhone,
  sourceType,
  productUrl,
  screenshotUrl,
  screenshotUrls,
  size,
  color,
  quantity = 1,
  details
}) {
  const worker = process.env.WORKER_TELEGRAM_USERNAME || 'korcha_support';
  const urls = Array.isArray(screenshotUrls)
    ? screenshotUrls.filter(Boolean)
    : (screenshotUrl ? [screenshotUrl] : []);
  const primaryScreenshot = urls[0] || screenshotUrl || null;
  const cleanUsername = customerTelegramUsername
    ? String(customerTelegramUsername).replace(/^@/, '').trim()
    : null;

  if (await checkPG()) {
    try {
      const query = `
        INSERT INTO quotes (
          quote_code, customer_id, customer_telegram_id, customer_telegram_username,
          customer_phone, source_type, product_url, screenshot_url, screenshot_urls,
          size, color, quantity, details, status, assigned_worker
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, $13, 'pending_review', $14)
        RETURNING *;
      `;
      const values = [
        quoteCode,
        customerId || null,
        customerTelegramId || null,
        cleanUsername,
        customerPhone,
        sourceType,
        productUrl || null,
        primaryScreenshot,
        JSON.stringify(urls),
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
    customer_telegram_username: cleanUsername,
    customer_phone: customerPhone,
    source_type: sourceType,
    product_url: productUrl || null,
    screenshot_url: primaryScreenshot,
    screenshot_urls: urls,
    size: size || null,
    color: color || null,
    quantity: parseInt(quantity || 1, 10),
    details: details || null,
    status: 'pending_review',
    assigned_worker: worker,
    syncedToPg: false,
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

// 3b. Get Quotes By Phone
export async function getQuotesByPhone(phone) {
  if (await checkPG()) {
    try {
      const { rows } = await pool.query('SELECT * FROM quotes WHERE customer_phone = $1 ORDER BY created_at DESC', [phone]);
      if (rows.length > 0) return rows;
    } catch (e) {
      console.warn('[DB Fallback] getQuotesByPhone fallback:', e.message);
    }
  }
  const results = [];
  for (const quote of inMemoryStore.quotes.values()) {
    if (quote.customer_phone === phone) {
      results.push(quote);
    }
  }
  return results.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

// 3d. Get Pending Quotes for Worker
export async function getPendingQuotes(limit = 10) {
  if (await checkPG()) {
    try {
      const { rows } = await pool.query(
        "SELECT * FROM quotes WHERE status = 'pending_review' ORDER BY created_at DESC LIMIT $1",
        [limit]
      );
      return rows;
    } catch (e) {
      console.warn('[DB Fallback] getPendingQuotes fallback:', e.message);
    }
  }
  return Array.from(inMemoryStore.quotes.values())
    .filter(q => q.status === 'pending_review')
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, limit);
}

// 3e. Update Quote Price & Status (Worker Quote Engine)
export async function updateQuotePrice({ quoteCode, quotedPriceEtb, depositRequiredEtb, workerNotes = '' }) {
  if (await checkPG()) {
    try {
      const q = `
        UPDATE quotes
        SET quoted_price_etb = $1, deposit_required_etb = $2, worker_notes = $3, status = 'priced', updated_at = CURRENT_TIMESTAMP
        WHERE quote_code = $4
        RETURNING *;
      `;
      const { rows } = await pool.query(q, [quotedPriceEtb, depositRequiredEtb, workerNotes, quoteCode]);
      if (rows.length > 0) return rows[0];
    } catch (e) {
      console.warn('[DB Fallback] updateQuotePrice fallback:', e.message);
    }
  }
  const quote = inMemoryStore.quotes.get(quoteCode);
  if (quote) {
    quote.quoted_price_etb = quotedPriceEtb;
    quote.deposit_required_etb = depositRequiredEtb;
    quote.worker_notes = workerNotes;
    quote.status = 'priced';
    quote.updated_at = new Date().toISOString();
    return quote;
  }
  return null;
}

// 13d. Get All Platform Conversations for Worker TMA
export async function getAllConversationsForWorker() {
  const ticketSet = new Set();
  const quotesMap = new Map();
  const ordersMap = new Map();

  if (await checkPG()) {
    try {
      const qQuotes = await pool.query("SELECT * FROM quotes ORDER BY created_at DESC LIMIT 50");
      for (const r of qQuotes.rows) {
        ticketSet.add(r.quote_code);
        quotesMap.set(r.quote_code, r);
      }
      const qOrders = await pool.query("SELECT * FROM orders ORDER BY created_at DESC LIMIT 50");
      for (const r of qOrders.rows) {
        ticketSet.add(r.order_code);
        ordersMap.set(r.order_code, r);
      }
      const qMsgs = await pool.query("SELECT DISTINCT ticket_code FROM ticket_messages ORDER BY ticket_code DESC LIMIT 50");
      for (const r of qMsgs.rows) {
        ticketSet.add(r.ticket_code);
      }
    } catch (e) {
      console.warn('[DB Fallback] getAllConversationsForWorker PG fallback:', e.message);
    }
  }

  for (const q of inMemoryStore.quotes.values()) {
    ticketSet.add(q.quote_code);
    quotesMap.set(q.quote_code, q);
  }
  for (const o of inMemoryStore.orders.values()) {
    ticketSet.add(o.order_code);
    ordersMap.set(o.order_code, o);
  }
  if (inMemoryStore.ticketMessages) {
    for (const m of inMemoryStore.ticketMessages) {
      ticketSet.add(m.ticket_code);
    }
  }

  const conversations = [];
  for (const code of ticketSet) {
    const quote = quotesMap.get(code) || (await getQuoteByCode(code));
    const order = ordersMap.get(code) || (await getOrderByCode(code));
    const messages = await getTicketMessages(code);

    let category = 'support';
    let summary = 'ከደንበኛ የቀረበ መልዕክት';
    let status = 'ውይይት ላይ';
    let customerPhone = quote?.customer_phone || order?.customer_phone || null;
    let customerTelegramId = quote?.customer_telegram_id || order?.customer_telegram_id || null;

    if (quote) {
      category = 'quote';
      summary = quote.details || (quote.source_type === 'link' ? `ሊንክ፡ ${quote.product_url}` : 'የእቃ ስክሪንሾት');
      status = quote.status === 'pending_review' ? 'ዋጋ እየተሰላ ነው (Pending)' : quote.status === 'priced' ? 'ዋጋ ተሰጥቷል (Priced)' : quote.status;
    } else if (order) {
      category = 'order';
      summary = order.product_summary || `የትዕዛዝ ክፍያ (${order.total_price_etb} ETB)`;
      status = order.status;
    }

    const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
    conversations.push({
      ticketCode: code,
      category,
      summary,
      status,
      customerPhone,
      customerTelegramId,
      latestWorkerResponse: order?.latest_worker_note || quote?.worker_notes || null,
      updatedAt: lastMsg?.created_at || quote?.updated_at || order?.updated_at || new Date().toISOString(),
      messages,
    });
  }

  return conversations.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

// 3c. Resolve any Tracking Target (Order Code, Quote Code, Tracker Number, or Phone Number)
export async function resolveTrackingTarget(targetInput) {
  if (!targetInput) return null;
  const raw = String(targetInput).trim();

  // 1. Check orders by code or phone
  const orderByCode = await getOrderByCode(raw);
  if (orderByCode) {
    return {
      canonicalCode: orderByCode.order_code,
      customerPhone: orderByCode.customer_phone,
      customerTelegramId: orderByCode.customer_telegram_id,
      order: orderByCode,
      quote: null,
    };
  }
  const ordersByPhone = await getOrdersByPhone(raw);
  if (ordersByPhone && ordersByPhone.length > 0) {
    const ord = ordersByPhone[0];
    return {
      canonicalCode: ord.order_code,
      customerPhone: ord.customer_phone,
      customerTelegramId: ord.customer_telegram_id,
      order: ord,
      quote: null,
    };
  }

  // 2. Check quotes by code or phone
  const quoteByCode = await getQuoteByCode(raw);
  if (quoteByCode) {
    return {
      canonicalCode: quoteByCode.quote_code,
      customerPhone: quoteByCode.customer_phone,
      customerTelegramId: quoteByCode.customer_telegram_id,
      order: null,
      quote: quoteByCode,
    };
  }
  const quotesByPhone = await getQuotesByPhone(raw);
  if (quotesByPhone && quotesByPhone.length > 0) {
    const qt = quotesByPhone[0];
    return {
      canonicalCode: qt.quote_code,
      customerPhone: qt.customer_phone,
      customerTelegramId: qt.customer_telegram_id,
      order: null,
      quote: qt,
    };
  }

  // 3. Check inquiry_pings by reference_code or customer_phone
  const pingsByCode = await getCustomerPings(raw);
  if (pingsByCode && pingsByCode.length > 0) {
    const p = pingsByCode.find(x => x.customer_telegram_id) || pingsByCode[0];
    return {
      canonicalCode: p.reference_code || raw,
      customerPhone: p.customer_phone || null,
      customerTelegramId: p.customer_telegram_id || null,
      order: null,
      quote: null,
    };
  }

  if (await checkPG()) {
    try {
      const { rows } = await pool.query(
        'SELECT * FROM inquiry_pings WHERE customer_phone = $1 ORDER BY created_at DESC LIMIT 1',
        [raw]
      );
      if (rows.length > 0) {
        return {
          canonicalCode: rows[0].reference_code || raw,
          customerPhone: rows[0].customer_phone,
          customerTelegramId: rows[0].customer_telegram_id,
          order: null,
          quote: null,
        };
      }
    } catch (_) {}
  }

  const memPing = inMemoryStore.pings
    .filter(p => p.customer_phone === raw || p.reference_code === raw)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];

  if (memPing) {
    return {
      canonicalCode: memPing.reference_code || raw,
      customerPhone: memPing.customer_phone || null,
      customerTelegramId: memPing.customer_telegram_id || null,
      order: null,
      quote: null,
    };
  }

  // 4. Fallback: allow replying to any ad-hoc tracker code or phone number
  return {
    canonicalCode: raw,
    customerPhone: raw,
    customerTelegramId: null,
    order: null,
    quote: null,
  };
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
    syncedToPg: false,
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

// 6b. Get Pending Orders (Awaiting 40% deposit) for Worker
export async function getPendingOrders(limit = 10) {
  if (await checkPG()) {
    try {
      const { rows } = await pool.query(
        "SELECT * FROM orders WHERE status = 'pending_deposit' ORDER BY created_at DESC LIMIT $1",
        [limit]
      );
      return rows;
    } catch (e) {
      console.warn('[DB Fallback] getPendingOrders fallback:', e.message);
    }
  }
  return Array.from(inMemoryStore.orders.values())
    .filter(o => o.status === 'pending_deposit')
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, limit);
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
  order.syncedToPg = false;
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
    syncedToPg: false,
    created_at: now,
  };
  inMemoryStore.pings.push(pingRecord);

  const ord = inMemoryStore.orders.get(referenceCode);
  if (ord) {
    ord.last_customer_ping = now;
    ord.syncedToPg = false;
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
      p.syncedToPg = false;
    }
  }
  const ord = inMemoryStore.orders.get(referenceCode);
  if (ord) {
    if (newStatus) ord.status = newStatus;
    ord.latest_worker_note = responseText;
    ord.worker_response = responseText;
    ord.syncedToPg = false;
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

// 12. Add Ticket Message (Continuous two-way conversation thread)
export async function addTicketMessage({
  ticketCode,
  senderRole, // 'customer' or 'worker'
  senderName = null,
  senderTelegramId = null,
  customerPhone = null,
  messageText,
}) {
  const now = new Date().toISOString();
  if (await checkPG()) {
    try {
      const q = `
        INSERT INTO ticket_messages (
          ticket_code, sender_role, sender_name, sender_telegram_id, customer_phone, message_text
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *;
      `;
      const { rows } = await pool.query(q, [
        ticketCode, senderRole, senderName, senderTelegramId, customerPhone, messageText
      ]);
      return rows[0];
    } catch (e) {
      console.warn('[DB Fallback] addTicketMessage fallback:', e.message);
    }
  }

  // Fallback
  const msgRecord = {
    id: ++inMemoryStore.idCounter,
    ticket_code: ticketCode,
    sender_role: senderRole,
    sender_name: senderName,
    sender_telegram_id: senderTelegramId,
    customer_phone: customerPhone,
    message_text: messageText,
    syncedToPg: false,
    created_at: now,
  };
  if (!inMemoryStore.ticketMessages) inMemoryStore.ticketMessages = [];
  inMemoryStore.ticketMessages.push(msgRecord);
  return msgRecord;
}

// 13. Get Ticket Messages (Chronological conversation history)
export async function getTicketMessages(ticketCode) {
  if (await checkPG()) {
    try {
      const { rows } = await pool.query(
        'SELECT * FROM ticket_messages WHERE ticket_code = $1 ORDER BY created_at ASC',
        [ticketCode]
      );
      return rows;
    } catch (e) {
      console.warn('[DB Fallback] getTicketMessages fallback:', e.message);
    }
  }

  if (!inMemoryStore.ticketMessages) inMemoryStore.ticketMessages = [];
  return inMemoryStore.ticketMessages
    .filter(m => m.ticket_code === ticketCode)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

// 13b. Find the latest active ticket code for a Telegram user (across messages, quotes, orders, and pings)
export async function getLatestCustomerTicketByTelegramId(telegramId) {
  if (!telegramId) return null;
  const numId = Number(telegramId);

  if (await checkPG()) {
    try {
      const qMsg = await pool.query(
        'SELECT ticket_code FROM ticket_messages WHERE sender_telegram_id = $1 ORDER BY created_at DESC LIMIT 1',
        [numId]
      );
      if (qMsg.rows.length > 0) return qMsg.rows[0].ticket_code;

      const qQuote = await pool.query(
        'SELECT quote_code FROM quotes WHERE customer_telegram_id = $1 ORDER BY created_at DESC LIMIT 1',
        [numId]
      );
      if (qQuote.rows.length > 0) return qQuote.rows[0].quote_code;

      const qOrder = await pool.query(
        'SELECT order_code FROM orders WHERE customer_telegram_id = $1 ORDER BY created_at DESC LIMIT 1',
        [numId]
      );
      if (qOrder.rows.length > 0) return qOrder.rows[0].order_code;

      const qPing = await pool.query(
        'SELECT reference_code FROM inquiry_pings WHERE customer_telegram_id = $1 ORDER BY created_at DESC LIMIT 1',
        [numId]
      );
      if (qPing.rows.length > 0) return qPing.rows[0].reference_code;
    } catch (e) {
      console.warn('[DB Fallback] getLatestCustomerTicketByTelegramId fallback:', e.message);
    }
  }

  // Fallback check in memory
  if (inMemoryStore.ticketMessages) {
    const msgs = inMemoryStore.ticketMessages
      .filter(m => Number(m.sender_telegram_id) === numId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    if (msgs.length > 0) return msgs[0].ticket_code;
  }

  const quotes = Array.from(inMemoryStore.quotes.values())
    .filter(q => Number(q.customer_telegram_id) === numId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  if (quotes.length > 0) return quotes[0].quote_code;

  const orders = Array.from(inMemoryStore.orders.values())
    .filter(o => Number(o.customer_telegram_id) === numId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  if (orders.length > 0) return orders[0].order_code;

  const pings = inMemoryStore.pings
    .filter(p => Number(p.customer_telegram_id) === numId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  if (pings.length > 0) return pings[0].reference_code;

  return null;
}

// 13c. Get all customer conversation threads (Price Estimations, Order Tracker, and General Support) for TMA
export async function getCustomerConversations({ telegramId = null, phone = null, codes = [] }) {
  const ticketSet = new Set(Array.isArray(codes) ? codes.filter(Boolean) : []);
  const numTgId = telegramId ? Number(telegramId) : null;
  const cleanPhone = phone ? String(phone).trim() : null;

  const quotesMap = new Map();
  const ordersMap = new Map();
  const pingsMap = new Map();

  if (await checkPG()) {
    try {
      if (numTgId || cleanPhone) {
        const qQuotes = await pool.query(
          `SELECT * FROM quotes WHERE ($1::bigint IS NOT NULL AND customer_telegram_id = $1) OR ($2::text IS NOT NULL AND customer_phone = $2) ORDER BY created_at DESC`,
          [numTgId, cleanPhone]
        );
        for (const r of qQuotes.rows) {
          ticketSet.add(r.quote_code);
          quotesMap.set(r.quote_code, r);
        }

        const qOrders = await pool.query(
          `SELECT * FROM orders WHERE ($1::bigint IS NOT NULL AND customer_telegram_id = $1) OR ($2::text IS NOT NULL AND customer_phone = $2) ORDER BY created_at DESC`,
          [numTgId, cleanPhone]
        );
        for (const r of qOrders.rows) {
          ticketSet.add(r.order_code);
          ordersMap.set(r.order_code, r);
        }

        const qPings = await pool.query(
          `SELECT * FROM inquiry_pings WHERE ($1::bigint IS NOT NULL AND customer_telegram_id = $1) OR ($2::text IS NOT NULL AND customer_phone = $2) ORDER BY created_at DESC`,
          [numTgId, cleanPhone]
        );
        for (const r of qPings.rows) {
          ticketSet.add(r.reference_code);
          if (!pingsMap.has(r.reference_code)) pingsMap.set(r.reference_code, []);
          pingsMap.get(r.reference_code).push(r);
        }

        const qMsgs = await pool.query(
          `SELECT DISTINCT ticket_code FROM ticket_messages WHERE ($1::bigint IS NOT NULL AND sender_telegram_id = $1) OR ($2::text IS NOT NULL AND customer_phone = $2)`,
          [numTgId, cleanPhone]
        );
        for (const r of qMsgs.rows) {
          ticketSet.add(r.ticket_code);
        }
      }
    } catch (e) {
      console.warn('[DB Fallback] getCustomerConversations PG query fallback:', e.message);
    }
  }

  // Also scan in-memory stores
  for (const q of inMemoryStore.quotes.values()) {
    if ((numTgId && Number(q.customer_telegram_id) === numTgId) || (cleanPhone && q.customer_phone === cleanPhone) || ticketSet.has(q.quote_code)) {
      ticketSet.add(q.quote_code);
      if (!quotesMap.has(q.quote_code)) quotesMap.set(q.quote_code, q);
    }
  }
  for (const o of inMemoryStore.orders.values()) {
    if ((numTgId && Number(o.customer_telegram_id) === numTgId) || (cleanPhone && o.customer_phone === cleanPhone) || ticketSet.has(o.order_code)) {
      ticketSet.add(o.order_code);
      if (!ordersMap.has(o.order_code)) ordersMap.set(o.order_code, o);
    }
  }
  for (const p of inMemoryStore.pings) {
    if ((numTgId && Number(p.customer_telegram_id) === numTgId) || (cleanPhone && p.customer_phone === cleanPhone) || ticketSet.has(p.reference_code)) {
      ticketSet.add(p.reference_code);
      if (!pingsMap.has(p.reference_code)) pingsMap.set(p.reference_code, []);
      pingsMap.get(p.reference_code).push(p);
    }
  }
  if (inMemoryStore.ticketMessages) {
    for (const m of inMemoryStore.ticketMessages) {
      if ((numTgId && Number(m.sender_telegram_id) === numTgId) || (cleanPhone && m.customer_phone === cleanPhone)) {
        ticketSet.add(m.ticket_code);
      }
    }
  }

  const conversations = [];
  for (const code of ticketSet) {
    const order = ordersMap.get(code) || (await getOrderByCode(code));
    const quote = quotesMap.get(code) || (await getQuoteByCode(code));
    const pings = pingsMap.get(code) || (await getCustomerPings(code));
    const messages = await getTicketMessages(code);

    const latestWorkerPing = pings.find(p => p.worker_response);
    const latestWorkerMsg = [...messages].reverse().find(m => m.sender_role === 'worker');
    const latestWorkerResponse =
      latestWorkerMsg?.message_text ||
      order?.latest_worker_note ||
      order?.worker_response ||
      latestWorkerPing?.worker_response ||
      null;

    // Synthesize worker response into messages array if it was only recorded in pings/order
    const normalizedMessages = [...messages];
    if (latestWorkerResponse && !normalizedMessages.some(m => m.sender_role === 'worker' && m.message_text === latestWorkerResponse)) {
      normalizedMessages.push({
        id: `worker-note-${code}`,
        ticket_code: code,
        sender_role: 'worker',
        sender_name: 'korcha_support',
        message_text: latestWorkerResponse,
        created_at: latestWorkerPing?.responded_at || order?.updated_at || new Date().toISOString(),
      });
    }

    const category = order
      ? 'order_tracker'
      : quote
      ? 'price_quote'
      : 'support';

    const summary =
      order?.product_summary ||
      quote?.details ||
      quote?.product_url ||
      pings[0]?.customer_note ||
      `የደንበኛ ውይይት (${code})`;

    const status =
      latestWorkerResponse
        ? 'ሰራተኛ ምላሽ ሰጥቷል (Worker Replied)'
        : order?.status || quote?.status || 'በሰራተኛ እየታየ ነው (Waiting for Worker)';

    const updatedAt =
      normalizedMessages[normalizedMessages.length - 1]?.created_at ||
      order?.updated_at ||
      quote?.updated_at ||
      pings[0]?.created_at ||
      new Date().toISOString();

    conversations.push({
      ticketCode: code,
      category,
      summary,
      status,
      customerPhone: order?.customer_phone || quote?.customer_phone || cleanPhone || null,
      latestWorkerResponse,
      messages: normalizedMessages,
      updatedAt,
    });
  }

  return conversations.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

// 14. Get Shelf Products (Optionally filtered by category)
export async function getShelfProducts(categoryId = null) {
  if (await checkPG()) {
    try {
      const q = categoryId && categoryId !== 'all'
        ? 'SELECT * FROM shelf_products WHERE category_id = $1 ORDER BY created_at DESC'
        : 'SELECT * FROM shelf_products ORDER BY created_at DESC';
      const values = categoryId && categoryId !== 'all' ? [categoryId] : [];
      const { rows } = await pool.query(q, values);
      return rows;
    } catch (e) {
      console.warn('[DB Fallback] getShelfProducts fallback:', e.message);
    }
  }

  if (!inMemoryStore.shelfProducts) inMemoryStore.shelfProducts = [];
  if (categoryId && categoryId !== 'all') {
    return inMemoryStore.shelfProducts.filter(p => p.category_id === categoryId);
  }
  return inMemoryStore.shelfProducts;
}

// 15. Get Best Seller Products ("በብዛት የተሸጡ" collection)
export async function getBestSellerProducts() {
  if (await checkPG()) {
    try {
      const q = 'SELECT * FROM shelf_products WHERE is_bestseller = true ORDER BY created_at DESC';
      const { rows } = await pool.query(q);
      return rows;
    } catch (e) {
      console.warn('[DB Fallback] getBestSellerProducts fallback:', e.message);
    }
  }

  if (!inMemoryStore.shelfProducts) inMemoryStore.shelfProducts = [];
  return inMemoryStore.shelfProducts.filter(p => p.is_bestseller);
}

// 16. Add Shelf Product (korcha_support edit/add)
export async function addShelfProduct({
  categoryId,
  name,
  size = null,
  priceEtb,
  photoUrl,
  isBestseller = false,
  createdBy = 'korcha_support',
}) {
  const now = new Date().toISOString();
  if (await checkPG()) {
    try {
      const q = `
        INSERT INTO shelf_products (category_id, name, size, price_etb, photo_url, is_bestseller, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *;
      `;
      const { rows } = await pool.query(q, [
        categoryId,
        name,
        size || null,
        parseFloat(priceEtb),
        photoUrl,
        Boolean(isBestseller),
        createdBy || 'korcha_support',
      ]);
      return rows[0];
    } catch (e) {
      console.warn('[DB Fallback] addShelfProduct fallback:', e.message);
    }
  }

  const record = {
    id: ++inMemoryStore.idCounter,
    category_id: categoryId,
    name,
    size: size || null,
    price_etb: parseFloat(priceEtb),
    photo_url: photoUrl,
    is_bestseller: Boolean(isBestseller),
    created_by: createdBy || 'korcha_support',
    syncedToPg: false,
    created_at: now,
    updated_at: now,
  };
  if (!inMemoryStore.shelfProducts) inMemoryStore.shelfProducts = [];
  inMemoryStore.shelfProducts.unshift(record);
  return record;
}

// 17. Update Shelf Product (korcha_support edit access)
export async function updateShelfProduct(id, updates = {}) {
  const numId = parseInt(id, 10);
  const now = new Date().toISOString();

  if (await checkPG()) {
    try {
      const fields = [];
      const values = [];
      let idx = 1;

      if (updates.name !== undefined) {
        fields.push(`name = $${idx++}`);
        values.push(updates.name);
      }
      if (updates.size !== undefined) {
        fields.push(`size = $${idx++}`);
        values.push(updates.size);
      }
      if (updates.priceEtb !== undefined) {
        fields.push(`price_etb = $${idx++}`);
        values.push(parseFloat(updates.priceEtb));
      }
      if (updates.photoUrl !== undefined) {
        fields.push(`photo_url = $${idx++}`);
        values.push(updates.photoUrl);
      }
      if (updates.categoryId !== undefined) {
        fields.push(`category_id = $${idx++}`);
        values.push(updates.categoryId);
      }
      if (updates.isBestseller !== undefined) {
        fields.push(`is_bestseller = $${idx++}`);
        values.push(Boolean(updates.isBestseller));
      }
      fields.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(numId);

      const q = `UPDATE shelf_products SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *;`;
      const { rows } = await pool.query(q, values);
      if (rows.length > 0) return rows[0];
    } catch (e) {
      console.warn('[DB Fallback] updateShelfProduct fallback:', e.message);
    }
  }

  if (!inMemoryStore.shelfProducts) inMemoryStore.shelfProducts = [];
  const idx = inMemoryStore.shelfProducts.findIndex(p => p.id === numId);
  if (idx !== -1) {
    const existing = inMemoryStore.shelfProducts[idx];
    const updated = {
      ...existing,
      name: updates.name !== undefined ? updates.name : existing.name,
      size: updates.size !== undefined ? updates.size : existing.size,
      price_etb: updates.priceEtb !== undefined ? parseFloat(updates.priceEtb) : existing.price_etb,
      photo_url: updates.photoUrl !== undefined ? updates.photoUrl : existing.photo_url,
      category_id: updates.categoryId !== undefined ? updates.categoryId : existing.category_id,
      is_bestseller: updates.isBestseller !== undefined ? Boolean(updates.isBestseller) : existing.is_bestseller,
      syncedToPg: false,
      updated_at: now,
    };
    inMemoryStore.shelfProducts[idx] = updated;
    return updated;
  }
  return null;
}

// 18. Delete Shelf Product
export async function deleteShelfProduct(id) {
  const numId = parseInt(id, 10);
  if (await checkPG()) {
    try {
      await pool.query('DELETE FROM shelf_products WHERE id = $1', [numId]);
      return { success: true, id: numId };
    } catch (e) {
      console.warn('[DB Fallback] deleteShelfProduct fallback:', e.message);
    }
  }

  if (!inMemoryStore.shelfProducts) inMemoryStore.shelfProducts = [];
  inMemoryStore.shelfProducts = inMemoryStore.shelfProducts.filter(p => p.id !== numId);
  return { success: true, id: numId };
}

// 18b. Get & Update Shelf Categories (Editable by korcha_support)
export async function getShelfCategories() {
  if (await checkPG()) {
    try {
      const { rows } = await pool.query('SELECT * FROM shelf_categories ORDER BY id ASC');
      if (rows.length > 0) {
        return inMemoryStore.shelfCategories.map(def => {
          const found = rows.find(r => r.id === def.id);
          return found ? {
            id: found.id,
            nameAm: found.name_am,
            nameEn: found.name_en,
            icon: found.icon || def.icon,
            color: found.color || def.color
          } : def;
        });
      }
    } catch (e) {
      console.warn('[DB Fallback] getShelfCategories fallback:', e.message);
    }
  }
  return inMemoryStore.shelfCategories;
}

export async function updateShelfCategory(id, updates = {}) {
  const catIdx = inMemoryStore.shelfCategories.findIndex(c => c.id === id);
  if (catIdx === -1) return null;

  const existing = inMemoryStore.shelfCategories[catIdx];
  const updated = {
    ...existing,
    nameAm: updates.nameAm !== undefined && updates.nameAm.trim() ? updates.nameAm.trim() : existing.nameAm,
    nameEn: updates.nameEn !== undefined && updates.nameEn.trim() ? updates.nameEn.trim() : existing.nameEn,
    icon: updates.icon !== undefined && updates.icon.trim() ? updates.icon.trim() : existing.icon,
  };
  inMemoryStore.shelfCategories[catIdx] = updated;

  if (await checkPG()) {
    try {
      const q = `
        INSERT INTO shelf_categories (id, name_am, name_en, icon, color, updated_at)
        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO UPDATE
        SET name_am = EXCLUDED.name_am,
            name_en = EXCLUDED.name_en,
            icon = EXCLUDED.icon,
            updated_at = CURRENT_TIMESTAMP;
      `;
      await pool.query(q, [updated.id, updated.nameAm, updated.nameEn, updated.icon, updated.color]);
    } catch (e) {
      console.warn('[DB Fallback] updateShelfCategory fallback:', e.message);
    }
  }
  return updated;
}

// 19. FALLBACK RECONCILIATION ENGINE: Syncs volatile in-memory fallback data to PostgreSQL upon reconnect
export async function syncFallbackToPostgres() {
  if (isReconciling) return { status: 'in_progress' };
  isReconciling = true;

  let client;
  let syncedCustomers = 0;
  let syncedQuotes = 0;
  let syncedOrders = 0;
  let syncedPings = 0;

  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // 1. Sync in-memory customers
    for (const [key, cust] of inMemoryStore.customers.entries()) {
      if (cust.syncedToPg) continue;
      const q = `
        INSERT INTO customers (telegram_id, telegram_username, first_name, phone_number, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (telegram_id) DO UPDATE
        SET phone_number = EXCLUDED.phone_number, updated_at = CURRENT_TIMESTAMP
        RETURNING id;
      `;
      const res = await client.query(q, [
        cust.telegram_id || null,
        cust.telegram_username || null,
        cust.first_name || null,
        cust.phone_number,
        cust.created_at || new Date(),
        cust.updated_at || new Date()
      ]);
      cust.pgId = res.rows[0]?.id;
      cust.syncedToPg = true;
      syncedCustomers++;
    }

    // 2. Sync in-memory quotes
    for (const [code, quote] of inMemoryStore.quotes.entries()) {
      if (quote.syncedToPg) continue;
      const q = `
        INSERT INTO quotes (
          quote_code, customer_id, customer_telegram_id, customer_phone, source_type,
          product_url, screenshot_url, size, color, quantity, details,
          status, assigned_worker, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT (quote_code) DO NOTHING;
      `;
      await client.query(q, [
        quote.quote_code,
        quote.customer_id || null,
        quote.customer_telegram_id || null,
        quote.customer_phone,
        quote.source_type,
        quote.product_url || null,
        quote.screenshot_url || null,
        quote.size || null,
        quote.color || null,
        quote.quantity || 1,
        quote.details || null,
        quote.status || 'pending_review',
        quote.assigned_worker || 'korcha_support',
        quote.created_at || new Date(),
        quote.updated_at || new Date()
      ]);
      quote.syncedToPg = true;
      syncedQuotes++;
    }

    // 3. Sync in-memory orders
    for (const [code, order] of inMemoryStore.orders.entries()) {
      if (order.syncedToPg) continue;
      const q = `
        INSERT INTO orders (
          order_code, quote_id, customer_id, customer_telegram_id, customer_phone, product_summary,
          total_price_etb, deposit_amount_etb, cod_balance_etb,
          payment_method, delivery_address, status, assigned_worker,
          latest_worker_note, worker_response, last_customer_ping, last_lookup_at,
          created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        ON CONFLICT (order_code) DO UPDATE
        SET status = EXCLUDED.status,
            latest_worker_note = EXCLUDED.latest_worker_note,
            worker_response = EXCLUDED.worker_response,
            last_customer_ping = EXCLUDED.last_customer_ping,
            last_lookup_at = EXCLUDED.last_lookup_at,
            updated_at = CURRENT_TIMESTAMP;
      `;
      await client.query(q, [
        order.order_code,
        order.quote_id || null,
        order.customer_id || null,
        order.customer_telegram_id || null,
        order.customer_phone,
        order.product_summary,
        order.total_price_etb,
        order.deposit_amount_etb,
        order.cod_balance_etb,
        order.payment_method || 'telebirr',
        order.delivery_address || null,
        order.status,
        order.assigned_worker || 'korcha_support',
        order.latest_worker_note || null,
        order.worker_response || null,
        order.last_customer_ping || null,
        order.last_lookup_at || null,
        order.created_at || new Date(),
        order.updated_at || new Date()
      ]);
      order.syncedToPg = true;
      syncedOrders++;
    }

    // 4. Sync in-memory inquiry pings
    for (const ping of inMemoryStore.pings) {
      if (ping.syncedToPg) continue;
      const q = `
        INSERT INTO inquiry_pings (
          reference_code, customer_phone, customer_name, customer_telegram_id,
          ping_type, customer_note, assigned_worker, worker_response,
          responded_at, responded_by, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT DO NOTHING;
      `;
      await client.query(q, [
        ping.reference_code,
        ping.customer_phone,
        ping.customer_name || null,
        ping.customer_telegram_id || null,
        ping.ping_type,
        ping.customer_note || null,
        ping.assigned_worker || 'korcha_support',
        ping.worker_response || null,
        ping.responded_at || null,
        ping.responded_by || null,
        ping.created_at || new Date()
      ]);
      ping.syncedToPg = true;
      syncedPings++;
    }

    // 5. Sync in-memory ticket messages
    if (inMemoryStore.ticketMessages) {
      for (const msg of inMemoryStore.ticketMessages) {
        if (msg.syncedToPg) continue;
        const q = `
          INSERT INTO ticket_messages (
            ticket_code, sender_role, sender_name, sender_telegram_id, customer_phone, message_text, created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT DO NOTHING;
        `;
        await client.query(q, [
          msg.ticket_code,
          msg.sender_role,
          msg.sender_name || null,
          msg.sender_telegram_id || null,
          msg.customer_phone || null,
          msg.message_text,
          msg.created_at || new Date()
        ]);
        msg.syncedToPg = true;
      }
    }

    // 6. Sync in-memory shelf products
    if (inMemoryStore.shelfProducts) {
      for (const prod of inMemoryStore.shelfProducts) {
        if (prod.syncedToPg) continue;
        const q = `
          INSERT INTO shelf_products (
            category_id, name, size, price_etb, photo_url, is_bestseller, created_by, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT DO NOTHING;
        `;
        await client.query(q, [
          prod.category_id,
          prod.name,
          prod.size || null,
          prod.price_etb,
          prod.photo_url,
          prod.is_bestseller || false,
          prod.created_by || 'korcha_support',
          prod.created_at || new Date(),
          prod.updated_at || new Date()
        ]);
        prod.syncedToPg = true;
      }
    }

    await client.query('COMMIT');
    isPostgresAvailable = true;

    const totalSynced = syncedCustomers + syncedQuotes + syncedOrders + syncedPings;
    if (totalSynced > 0) {
      console.log(`✅ [DB Reconciliation] Successfully flushed ${totalSynced} pending in-memory records to PostgreSQL (${syncedQuotes} quotes, ${syncedOrders} orders, ${syncedPings} pings).`);
    }

    return {
      success: true,
      syncedCustomers,
      syncedQuotes,
      syncedOrders,
      syncedPings,
      totalSynced,
    };
  } catch (err) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch (_) {}
    }
    isPostgresAvailable = false;
    return { success: false, error: err.message };
  } finally {
    if (client) client.release();
    isReconciling = false;
  }
}

// 13. Automatic Background Health Check & Reconciliation Worker (Runs every 30 seconds)
let reconciliationInterval = null;
export function startReconciliationWorker(intervalMs = 30000) {
  if (reconciliationInterval) return;

  reconciliationInterval = setInterval(async () => {
    try {
      const client = await pool.connect();
      client.release();
      isPostgresAvailable = true;

      // Check if any in-memory items need syncing
      const hasUnsynced = 
        Array.from(inMemoryStore.quotes.values()).some(q => !q.syncedToPg) ||
        Array.from(inMemoryStore.orders.values()).some(o => !o.syncedToPg) ||
        inMemoryStore.pings.some(p => !p.syncedToPg);

      if (hasUnsynced) {
        await syncFallbackToPostgres();
      }
    } catch (e) {
      isPostgresAvailable = false;
    }
  }, intervalMs);

  console.log(`🔄 [DB Sync Worker] Background reconciliation worker active (interval: ${intervalMs / 1000}s).`);
}

// Auto-start worker on load
startReconciliationWorker();


// 14. Add Internal Worker Note (stored in DB orders/quotes and logged to status history & ticket chat)
export async function addWorkerNote({ referenceCode, noteText, workerUsername = 'korcha_support' }) {
  if (!referenceCode || !noteText) return { success: false, error: 'referenceCode and noteText required' };
  const rawCode = String(referenceCode).trim();
  const cleanNote = String(noteText).trim();
  const worker = workerUsername.startsWith('@') ? workerUsername : `@${workerUsername}`;
  const now = new Date().toISOString();

  const target = await resolveTrackingTarget(rawCode);
  const canonicalCode = target?.canonicalCode || rawCode;
  const isOrder = !!target?.order || canonicalCode.startsWith('KO-') || canonicalCode.startsWith('SO-');
  const targetPhone = target?.customerPhone || null;

  if (await checkPG()) {
    let client;
    try {
      client = await pool.connect();
      await client.query('BEGIN');

      if (isOrder) {
        const { rows: orderRows } = await client.query('SELECT id, status FROM orders WHERE order_code =  FOR UPDATE', [canonicalCode]);
        if (orderRows.length > 0) {
          const ord = orderRows[0];
          await client.query(`
            UPDATE orders 
            SET latest_worker_note = , worker_response = , updated_at = CURRENT_TIMESTAMP
            WHERE id = 
          `, [cleanNote, ord.id]);

          await client.query(`
            INSERT INTO order_status_history (order_id, previous_status, new_status, changed_by, note)
            VALUES (, , , , )
          `, [ord.id, ord.status, worker, `[ማስታወሻ / Note]: ${cleanNote}`]);
        }
      } else {
        await client.query(`
          UPDATE quotes 
          SET worker_notes = , updated_at = CURRENT_TIMESTAMP
          WHERE quote_code = 
        `, [cleanNote, canonicalCode]);
      }

      await client.query('COMMIT');
    } catch (e) {
      if (client) await client.query('ROLLBACK');
      console.warn('[DB Fallback] addWorkerNote Postgres error:', e.message);
    } finally {
      if (client) client.release();
    }
  }

  // Fallback in-memory
  if (inMemoryStore.orders && inMemoryStore.orders.has(canonicalCode)) {
    const ord = inMemoryStore.orders.get(canonicalCode);
    ord.latest_worker_note = cleanNote;
    ord.worker_response = cleanNote;
    ord.updated_at = now;
    if (!inMemoryStore.statusHistory) inMemoryStore.statusHistory = [];
    inMemoryStore.statusHistory.push({
      order_id: ord.id || canonicalCode,
      previous_status: ord.status,
      new_status: ord.status,
      changed_by: worker,
      note: `[ማስታወሻ / Note]: ${cleanNote}`,
      created_at: now,
    });
  } else if (inMemoryStore.quotes && inMemoryStore.quotes.has(canonicalCode)) {
    const quote = inMemoryStore.quotes.get(canonicalCode);
    quote.worker_notes = cleanNote;
    quote.updated_at = now;
  }

  // Also record in continuous ticket messages thread
  try {
    await addTicketMessage({
      ticketCode: canonicalCode,
      senderRole: 'worker',
      senderName: worker,
      customerPhone: targetPhone,
      messageText: `📝 [የሰራተኛ ማስታወሻ]: ${cleanNote}`,
    });
  } catch (_) {}

  return {
    success: true,
    referenceCode: canonicalCode,
    noteText: cleanNote,
    worker,
    updated_at: now,
  };
}

// 15. Comprehensive Order Dossier Generator (Optimized for Telegram Saved Messages & Workers)
export async function getOrderDossier(referenceCode) {
  if (!referenceCode) return null;
  const raw = String(referenceCode).trim();
  const target = await resolveTrackingTarget(raw);
  if (!target) return null;

  const order = target.order;
  const quote = target.quote;
  const code = target.canonicalCode;
  const phone = target.customerPhone || 'N/A';
  const telegramId = target.customerTelegramId || 'N/A';

  // Get customer username/name if available
  let customer = null;
  if (order?.customer_id || quote?.customer_id) {
    const cId = order?.customer_id || quote?.customer_id;
    if (await checkPG()) {
      try {
        const { rows } = await pool.query('SELECT * FROM customers WHERE id = ', [cId]);
        if (rows.length > 0) customer = rows[0];
      } catch (_) {}
    }
  }

  // Get status history notes if order
  let historyNotes = [];
  if (order && await checkPG()) {
    try {
      const { rows } = await pool.query(
        'SELECT note, changed_by, created_at FROM order_status_history WHERE order_id =  AND note IS NOT NULL ORDER BY created_at ASC',
        [order.id]
      );
      historyNotes = rows;
    } catch (_) {}
  }

  // Get ticket messages count
  const messages = await getTicketMessages(code);

  const createdAt = order?.created_at || quote?.created_at || new Date().toISOString();
  const formattedDate = new Date(createdAt).toLocaleString('en-US', {
    timeZone: 'Africa/Addis_Ababa',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const productDesc = order?.product_summary || quote?.details || (quote?.product_url ? `ዕቃ ከሊንክ፡ ${quote.product_url}` : 'የተዘዘ ዕቃ');
  const sizeColor = [quote?.size ? `ሳይዝ፡ ${quote.size}` : null, quote?.color ? `ቀለም፡ ${quote.color}` : null, quote?.quantity ? `ብዛት፡ ${quote.quantity}` : null].filter(Boolean).join(' | ');

  const total = order?.total_price_etb || quote?.quoted_price_etb || 0;
  const deposit = order?.deposit_amount_etb || quote?.deposit_required_etb || (total > 0 ? Math.round(total * 0.4) : 0);
  const balance = order?.cod_balance_etb || (total > 0 ? total - deposit : 0);

  const paymentMethodName = order?.payment_method === 'cbe_birr' ? 'CBE Birr (የኢትዮጵያ ንግድ ባንክ)' : 'Telebirr (ቴሌብር)';
  const address = order?.delivery_address || (order?.delivery_city ? `${order.delivery_city}` : 'አዲስ አበባ (Addis Ababa)');

  const statusMap = {
    pending_review: 'ዋጋ በመገመት ላይ (Pending Review)',
    priced: 'ዋጋ የተሰጠው (Priced - Awaiting Confirmation)',
    pending_deposit: 'ቅድመ ክፍያ የሚጠብቅ (Awaiting Deposit)',
    deposit_verified: 'ክፍያ ተረጋግጧል (Deposit Verified)',
    purchased: 'ዕቃው ተገዝቷል (Purchased from Store)',
    cargo_transit: 'በአውሮፕላን ካርጎ ጉዞ ላይ (In Cargo Transit)',
    arrived_addis: 'አዲስ አበባ ቦሌ ካርጎ ደርሷል (Arrived in Addis)',
    out_for_delivery: 'ለማድረስ በመንገድ ላይ (Out for Delivery)',
    delivered: 'ተጠናቋል - ደንበኛ ተረክቧል (Delivered)',
    cancelled: 'ተሰርዟል (Cancelled)'
  };
  const statusText = statusMap[order?.status || quote?.status] || (order?.status || quote?.status || 'Active');

  let etaText = 'በ10-14 የስራ ቀናት ውስጥ (10-14 days)';
  if (order?.latest_worker_note && order.latest_worker_note.includes('ይደርሳል')) {
    etaText = order.latest_worker_note;
  }

  const workerNotes = order?.latest_worker_note || quote?.worker_notes || 'የለም (No internal note recorded)';

  const formattedDossierText = `
📋 <b>የኮርቻ ትዕዛዝ ሙሉ መረጃ (Order Dossier Card)</b>
━━━━━━━━━━━━━━━━━━━━
🏷️ <b>የትዕዛዝ ኮድ:</b> <code>${code}</code>
📅 <b>የታዘዘበት ቀን:</b> ${formattedDate}
📊 <b>የአሁኑ ሁኔታ:</b> <b>${statusText}</b>

👤 <b>የደንበኛ መረጃ:</b>
• ስልክ ቁጥር: <code>${phone}</code>
• ቴሌግራም: ${customer?.telegram_username ? `@${customer.telegram_username}` : (telegramId !== 'N/A' ? `ID: <code>${telegramId}</code>` : 'በስልክ ብቻ')}
• የማድረሻ አድራሻ: <b>${address}</b>

📦 <b>የእቃው መረጃ (Product Summary):</b>
• መግለጫ: <b>${productDesc}</b>
${sizeColor ? `• ዝርዝር: ${sizeColor}\n` : ''}${quote?.product_url ? `• ኦሪጅናል ሊንክ: ${quote.product_url}\n` : ''}
💰 <b>የክፍያና ሂሳብ ዝርዝር (Financials):</b>
• ጠቅላላ ዋጋ: <b>${Number(total).toLocaleString()} ETB</b>
• የተከፈለ 40% ቅድመ ክፍያ: <b>${Number(deposit).toLocaleString()} ETB</b> (${paymentMethodName})
• የሚቀረው 60% ቀሪ ሂሳብ: <b>${Number(balance).toLocaleString()} ETB</b> (ዕቃው ሲረከቡ)

🚚 <b>የማድረሻ ሁኔታ (Logistics & ETA):</b>
• የሚደርስበት ጊዜ: <b>${etaText}</b>
• ከተማ: አዲስ አበባ

📝 <b>የሰራተኛ ማስታወሻ (Worker Internal Note):</b>
👉 <i>${workerNotes}</i>
${messages.length > 0 ? `💬 <b>የተመዘገቡ መልዕክቶች:</b> ${messages.length} መልዕክቶች ተለዋውጠዋል` : ''}
━━━━━━━━━━━━━━━━━━━━
💾 <b>ጠቃሚ ማሳሰቢያ ለሰራተኛ (@korcha_support):</b>
ይህንን መልዕክት በቀጥታ Forward በማድረግ ወደ ቴሌግራም <b>'Saved Messages'</b> ውስጥ ማስቀመጥ ይችላሉ!
`.trim();

  return {
    success: true,
    data: {
      code,
      phone,
      telegramId,
      createdAt,
      formattedDate,
      productDesc,
      sizeColor,
      productUrl: quote?.product_url || null,
      screenshotUrl: quote?.screenshot_url || null,
      totalPriceEtb: Number(total),
      depositAmountEtb: Number(deposit),
      codBalanceEtb: Number(balance),
      paymentMethod: order?.payment_method || 'telebirr',
      deliveryAddress: address,
      status: order?.status || quote?.status,
      statusText,
      etaText,
      workerNotes,
      messageCount: messages.length,
      historyNotes,
    },
    formattedDossierText,
  };
}


// 16. Graceful pool & background worker shutdown
export async function closePool() {
  if (reconciliationInterval) {
    clearInterval(reconciliationInterval);
    reconciliationInterval = null;
  }
  if (pool) {
    try {
      await pool.end();
    } catch (_) {}
  }
}

export default pool;
