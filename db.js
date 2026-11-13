// korcha/db.js: Complete In-Memory & PostgreSQL Database Layer for Telegram Korcha
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

let isPostgresAvailable = false;
let hasCheckedPostgres = false;

// Fail-safe In-Memory Store

function loadPersistedShelf() {
  try {
    if (fs.existsSync(SHELF_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(SHELF_FILE, 'utf8'));
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (_) {}
  const seed = [{"id": 1, "country": "USA", "category": "Food", "name": "Original Stanley Quencher H2.0 FlowState 40oz Tumbler", "size": "40oz (1.18L)", "price_etb": 4850, "photo_url": "https://images.unsplash.com/photo-1577705998148-6da4f3963bc8?w=500&auto=format&fit=crop&q=80", "photos": ["https://images.unsplash.com/photo-1577705998148-6da4f3963bc8?w=500&auto=format&fit=crop&q=80", "https://images.unsplash.com/photo-1544816155-12df9643f363?w=500&auto=format&fit=crop&q=80", "https://images.unsplash.com/photo-1517256064527-09c73fc73e38?w=500&auto=format&fit=crop&q=80"], "description": "በእጃችን ያለ ኦሪጅናል ስታንሊ ተምብለር። ቀኑን ሙሉ ቀዝቃዛ ወይም ትኩስ የሚያቆይ፣ ለስፖርትና ለቢሮ ተወዳጅ እቃ። 100% ኦሪጅናል ከ USA።", "is_bestseller": true}, {"id": 2, "country": "USA", "category": "Supplements", "name": "Optimum Nutrition Gold Standard 100% Whey Protein (5 lbs)", "size": "5 lbs (2.27kg)", "price_etb": 8900, "photo_url": "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500&auto=format&fit=crop&q=80", "photos": ["https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500&auto=format&fit=crop&q=80", "https://images.unsplash.com/photo-1579722821273-0f6c7d44362f?w=500&auto=format&fit=crop&q=80"], "description": "በእጃችን ያለ ዝግጁ የጡንቻ ማጎልበቻ ፕሮቲን። 24g ንፁህ ዋይ ፕሮቲን በየስኩፑ፣ ከ USA በቀጥታ የመጣ።", "is_bestseller": true}, {"id": 3, "country": "KOREAN", "category": "Skin care products", "name": "COSRX Advanced Snail 96 Mucin Power Essence", "size": "100ml", "price_etb": 2450, "photo_url": "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=500&auto=format&fit=crop&q=80", "photos": ["https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=500&auto=format&fit=crop&q=80", "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=500&auto=format&fit=crop&q=80"], "description": "በእጃችን ያለ የኮሪያ K-Beauty ሰረም። የፊት ቆዳን የሚያለሰልስ፣ እርጥበት የሚሰጥ እና ጠባሳ የሚያጠፋ ኦሪጅናል የኮሪያ ምርት።", "is_bestseller": true}, {"id": 4, "country": "KOREAN", "category": "Skin care products", "name": "Beauty of Joseon Relief Sun: Rice + Probiotics SPF50+", "size": "50ml", "price_etb": 2100, "photo_url": "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=500&auto=format&fit=crop&q=80", "photos": ["https://images.unsplash.com/photo-1556228720-195a672e8a03?w=500&auto=format&fit=crop&q=80", "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=500&auto=format&fit=crop&q=80"], "description": "ከፀሐይ ጨረር የሚከላከል፣ ነጭ ምልክት የማይተው እና ቆዳን የሚያለሰልስ ተወዳጅ የኮሪያ ሰንስክሪን።", "is_bestseller": true}, {"id": 5, "country": "KOREAN", "category": "Skin care products", "name": "Anua Heartleaf 77% Soothing Toner", "size": "250ml", "price_etb": 2650, "photo_url": "https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?w=500&auto=format&fit=crop&q=80", "photos": ["https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?w=500&auto=format&fit=crop&q=80"], "description": "ስሜታዊ እና በቀላሉ የሚቆጣ ቆዳን የሚያረጋጋ 77% ሃርትሊፍ ያለው ኦሪጅናል የኮሪያ ቶነር።", "is_bestseller": false}, {"id": 6, "country": "KOREAN", "category": "Skin care products", "name": "Laneige Lip Sleeping Mask Berry", "size": "20g", "price_etb": 1850, "photo_url": "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=500&auto=format&fit=crop&q=80", "photos": ["https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=500&auto=format&fit=crop&q=80"], "description": "ከንፈርን በሌሊት ውስጥ የሚያለሰልስ እና እርጥበት የሚሰጥ የኮሪያ ሊፕ ማስክ።", "is_bestseller": false}, {"id": 7, "country": "ARABIAN", "category": "Perfume & Oud", "name": "Lattafa Khamrah Luxury Arabian Eau de Parfum", "size": "100ml", "price_etb": 3800, "photo_url": "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=500&auto=format&fit=crop&q=80", "photos": ["https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=500&auto=format&fit=crop&q=80", "https://images.unsplash.com/photo-1547887537-6158d64c35b3?w=500&auto=format&fit=crop&q=80"], "description": "በእጃችን ያለ ኦሪጅናል የዱባይ ቅንጦት ሽቶ። ረጅም ሰዓት የሚቆይ ልዩ የቫኒላና የአምበር መአዛ ያለው።", "is_bestseller": true}, {"id": 8, "country": "ARABIAN", "category": "Perfume & Oud", "name": "Royal Bakhoor Oud Incense & Burner Gift Set", "size": "80g Jar", "price_etb": 2200, "photo_url": "https://images.unsplash.com/photo-1547887537-6158d64c35b3?w=500&auto=format&fit=crop&q=80", "photos": ["https://images.unsplash.com/photo-1547887537-6158d64c35b3?w=500&auto=format&fit=crop&q=80"], "description": "ቤትን እና ልብስን በጥሩ የአረብኛ ኡድ መዓዛ የሚያውድ ኦሪጅናል ባኹር።", "is_bestseller": false}, {"id": 9, "country": "ARABIAN", "category": "Abaya & Fashion", "name": "Dubai Nida Crepe Luxury Open Abaya with Matching Sheila", "size": "54 / 56 / 58", "price_etb": 6500, "photo_url": "https://images.unsplash.com/photo-1583391733956-6c78276477e2?w=500&auto=format&fit=crop&q=80", "photos": ["https://images.unsplash.com/photo-1583391733956-6c78276477e2?w=500&auto=format&fit=crop&q=80"], "description": "ቀላል እና የማይጨማደድ የዱባይ ኒዳ ክሬፕ አባያ ከተመሳሳይ ሻሽ ጋር።", "is_bestseller": true}, {"id": 10, "country": "ARABIAN", "category": "Abaya & Fashion", "name": "Embroidered Medinah Silk Hijab & Under-Cap Set", "size": "180 x 75 cm", "price_etb": 1450, "photo_url": "https://images.unsplash.com/photo-1606760227091-3dd870d97f1d?w=500&auto=format&fit=crop&q=80", "photos": ["https://images.unsplash.com/photo-1606760227091-3dd870d97f1d?w=500&auto=format&fit=crop&q=80"], "description": "ለስላሳ እና የማይንሸራተት የመዲና ሐር ሂጃብ በተለያዩ ከለሮች።", "is_bestseller": false}, {"id": 11, "country": "ARABIAN", "category": "Supplements", "name": "Pure Yemeni Sidr Honey (100% Natural)", "size": "500g", "price_etb": 4200, "photo_url": "https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=500&auto=format&fit=crop&q=80", "photos": ["https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=500&auto=format&fit=crop&q=80"], "description": "ለጤና እና ለበሽታ መከላከያ የሚረዳ 100% ንፁህ የየመን ሲድር ማር።", "is_bestseller": true}, {"id": 12, "country": "ARABIAN", "category": "Supplements", "name": "Cold-Pressed Black Seed (Habbat Al-Baraka) Oil", "size": "250ml", "price_etb": 1750, "photo_url": "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=500&auto=format&fit=crop&q=80", "photos": ["https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=500&auto=format&fit=crop&q=80"], "description": "በቀዝቃዛ ተጭኖ የተዘጋጀ ንፁህ የጥቁር አዝሙድ ዘይት ለዕለታዊ ጤና።", "is_bestseller": false}, {"id": 13, "country": "ARABIAN", "category": "Others", "name": "Dubai Chocolate (Pistachio & Kunafa Bar)", "size": "200g Bar", "price_etb": 600, "photo_url": "https://images.unsplash.com/photo-1549007994-cb92caebd54b?w=500&auto=format&fit=crop&q=80", "photos": ["https://images.unsplash.com/photo-1549007994-cb92caebd54b?w=500&auto=format&fit=crop&q=80"], "description": "በፒስታቺዮ እና በኩናፋ የተሞላ ተወዳጅ የዱባይ ቸኮሌት።", "is_bestseller": true}, {"id": 14, "country": "ARABIAN", "category": "Others", "name": "Baharat Mushakkal (Arabian Mix Spices)", "size": "Shaker Bottle", "price_etb": 900, "photo_url": "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=500&auto=format&fit=crop&q=80", "photos": ["https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=500&auto=format&fit=crop&q=80"], "description": "ለምግብ ማጣፈጫ የሚሆን የአረብኛ የተቀላቀለ ቅመም።", "is_bestseller": false}, {"id": 15, "country": "ARABIAN", "category": "Others", "name": "Dried Pink Rose Buds (For Tea & Decor)", "size": "Pack", "price_etb": 550, "photo_url": "https://images.unsplash.com/photo-1563822249366-3efb23b8e0c9?w=500&auto=format&fit=crop&q=80", "photos": ["https://images.unsplash.com/photo-1563822249366-3efb23b8e0c9?w=500&auto=format&fit=crop&q=80"], "description": "ለሻይ እና ለመዓዛ የሚሆን ደረቅ የሮዝ አበባ።", "is_bestseller": false}];
  try { fs.writeFileSync(SHELF_FILE, JSON.stringify(seed, null, 2)); } catch (_) {}
  return seed;
}

function savePersistedShelf(list) {
  try { fs.writeFileSync(SHELF_FILE, JSON.stringify(list, null, 2)); } catch (_) {}
}

const inMemoryStore = {
  customers: new Map(),
  quotes: new Map(),
  orders: new Map(),
  pings: [],
  ticketMessages: [],
  merchantSubmissions: new Map(),
  shelfCategories: [
    { id: 'womens', nameAm: 'የሴቶች አልባሳት', nameEn: "Women's Clothing", icon: '👗', color: 'from-pink-500 to-rose-600' },
    { id: 'kids', nameAm: 'የህጻናት', nameEn: 'Kids & Babies', icon: '🧸', color: 'from-amber-400 to-orange-500' },
    { id: 'beauty', nameAm: 'የመዋቢያ ዕቃዎች', nameEn: 'Beauty & Skin Care', icon: '💄', color: 'from-fuchsia-500 to-purple-600' },
    { id: 'electronics', nameAm: 'ኤሌክትሮኒክስ', nameEn: 'Electronics', icon: '📱', color: 'from-blue-500 to-indigo-600' },
    { id: 'home', nameAm: 'የቤት ውስጥ', nameEn: 'Home & Kitchen', icon: '🍳', color: 'from-stone-600 to-stone-800' },
    { id: 'miscellaneous', nameAm: 'ሌሎች', nameEn: 'Other', icon: '✨', color: 'from-emerald-500 to-teal-700' }
  ],
  shelfProducts: loadPersistedShelf(),
  idCounter: 1000,
};

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || undefined,
  host: process.env.PGHOST || 'localhost',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
  database: process.env.PGDATABASE || 'korcha_db',
  port: parseInt(process.env.PGPORT || '5432', 10),
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 3000,
});

pool.on('error', (err) => {
  console.warn('[DB Pool] Notice:', err.message);
});

export async function checkPG() {
  if (!hasCheckedPostgres) {
    if (!process.env.DATABASE_URL && !process.env.PGDATABASE) {
      isPostgresAvailable = false;
      hasCheckedPostgres = true;
      return false;
    }
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

export async function runMigrations() {
  if (await checkPG()) {
    console.log('[DB] PostgreSQL connected.');
  } else {
    console.log('[DB] In-memory fail-safe persistence active.');
  }
}

export async function upsertCustomer({ telegramId, telegramUsername, firstName, phone }) {
  const key = telegramId ? String(telegramId) : `phone_${phone}`;
  const item = {
    id: ++inMemoryStore.idCounter,
    telegram_id: telegramId || null,
    telegram_username: telegramUsername || null,
    first_name: firstName || null,
    phone_number: phone,
    created_at: new Date().toISOString()
  };
  inMemoryStore.customers.set(key, item);
  return item;
}

export async function createQuote(data) {
  const record = {
    id: ++inMemoryStore.idCounter,
    ...data,
    status: 'pending_review',
    created_at: new Date().toISOString()
  };
  inMemoryStore.quotes.set(data.quoteCode, record);
  return record;
}

export async function getQuoteByCode(code) {
  return inMemoryStore.quotes.get(code) || null;
}

export async function getQuotesByPhone(phone) {
  const res = [];
  for (const q of inMemoryStore.quotes.values()) {
    if (q.customerPhone === phone || q.customer_phone === phone) res.push(q);
  }
  return res.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export async function createOrder(data) {
  const record = {
    id: ++inMemoryStore.idCounter,
    ...data,
    status: 'pending_deposit',
    created_at: new Date().toISOString()
  };
  inMemoryStore.orders.set(data.orderCode, record);
  return record;
}

export async function getOrderByCode(code) {
  return inMemoryStore.orders.get(code) || null;
}

export async function getOrdersByPhone(phone) {
  const res = [];
  for (const o of inMemoryStore.orders.values()) {
    if (o.customerPhone === phone || o.customer_phone === phone) res.push(o);
  }
  return res.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export async function updateOrderStatus(code, status, workerName, note = '') {
  const ord = inMemoryStore.orders.get(code);
  if (ord) {
    ord.status = status;
    ord.latest_worker_note = note;
    ord.worker_response = note;
  }
  const q = inMemoryStore.quotes.get(code);
  if (q) {
    q.status = status;
    q.worker_notes = note;
  }
  return { success: true, code, status, note };
}

export async function updateQuotePrice({ quoteCode, quotedPriceEtb, depositRequiredEtb, workerNotes = '' }) {
  const q = inMemoryStore.quotes.get(quoteCode);
  if (q) {
    q.total_price_etb = quotedPriceEtb;
    q.deposit_amount_etb = depositRequiredEtb;
    q.worker_notes = workerNotes;
    q.status = 'priced';
  }
  return q;
}

export async function getPendingQuotes(limit = 30) {
  const res = [];
  for (const q of inMemoryStore.quotes.values()) {
    if (q.status === 'pending_review') res.push(q);
  }
  return res.slice(0, limit);
}

export async function getPendingOrders(limit = 30) {
  const res = [];
  for (const o of inMemoryStore.orders.values()) {
    if (o.status === 'pending_deposit') res.push(o);
  }
  return res.slice(0, limit);
}

export async function getShelfProducts(category = null) {
  let list = inMemoryStore.shelfProducts;
  if (category && category !== 'all') {
    list = list.filter(p => p.category_id === category);
  }
  return list;
}

export async function getBestSellerProducts() {
  return inMemoryStore.shelfProducts.filter(p => p.is_bestseller);
}

export async function addShelfProduct(product) {
  const photosList = Array.isArray(product.photos) && product.photos.length > 0
    ? product.photos
    : (product.photoUrl || product.photo_url ? [product.photoUrl || product.photo_url] : []);
  const item = {
    id: product.id || ++inMemoryStore.idCounter,
    country: (product.country || 'USA').toUpperCase(),
    category: product.category || 'Others',
    category_id: product.categoryId || product.category_id || 'miscellaneous',
    name: product.name,
    size: product.size || 'Standard',
    price_etb: Number(product.priceEtb || product.price_etb || 0),
    photo_url: product.photoUrl || product.photo_url || photosList[0] || '',
    photos: photosList,
    description: product.description || '',
    is_bestseller: Boolean(product.isBestseller || product.is_bestseller),
    created_by: product.createdBy || 'korcha_support',
    created_at: new Date().toISOString()
  };
  inMemoryStore.shelfProducts.unshift(item);
  savePersistedShelf(inMemoryStore.shelfProducts);
  return item;
}

export async function updateShelfProduct(id, updates = {}) {
  const numId = parseInt(id, 10);
  const idx = inMemoryStore.shelfProducts.findIndex(p => p.id === numId);
  if (idx !== -1) {
    const existing = inMemoryStore.shelfProducts[idx];
    const updated = {
      ...existing,
      country: updates.country ? String(updates.country).toUpperCase() : existing.country,
      category: updates.category !== undefined ? updates.category : existing.category,
      description: updates.description !== undefined ? updates.description : existing.description,
      photos: Array.isArray(updates.photos) && updates.photos.length > 0 ? updates.photos : existing.photos,
      name: updates.name !== undefined ? updates.name : existing.name,
      size: updates.size !== undefined ? updates.size : existing.size,
      price_etb: updates.priceEtb !== undefined ? parseFloat(updates.priceEtb) : (updates.price_etb !== undefined ? parseFloat(updates.price_etb) : existing.price_etb),
      photo_url: updates.photoUrl || updates.photo_url || existing.photo_url,
      category_id: updates.categoryId || updates.category_id || existing.category_id,
      is_bestseller: updates.isBestseller !== undefined ? Boolean(updates.isBestseller) : existing.is_bestseller,
    };
    inMemoryStore.shelfProducts[idx] = updated;
    savePersistedShelf(inMemoryStore.shelfProducts);
    return updated;
  }
  return null;
}

export async function deleteShelfProduct(id) {
  const numId = parseInt(id, 10);
  inMemoryStore.shelfProducts = inMemoryStore.shelfProducts.filter(p => p.id !== numId);
  savePersistedShelf(inMemoryStore.shelfProducts);
  return { success: true, id: numId };
}

export async function getShelfCategories() {
  return inMemoryStore.shelfCategories;
}

export async function updateShelfCategory(id, updates = {}) {
  const idx = inMemoryStore.shelfCategories.findIndex(c => c.id === id);
  if (idx !== -1) {
    inMemoryStore.shelfCategories[idx] = {
      ...inMemoryStore.shelfCategories[idx],
      ...updates
    };
    return inMemoryStore.shelfCategories[idx];
  }
  return null;
}

export async function createMerchantSubmission(data) {
  const record = {
    id: ++inMemoryStore.idCounter,
    ...data,
    status: 'pending_review',
    created_at: new Date().toISOString()
  };
  inMemoryStore.merchantSubmissions.set(data.ticketCode, record);
  return record;
}

export async function getMerchantSubmissionByCode(code) {
  return inMemoryStore.merchantSubmissions.get(code) || null;
}

export async function getMerchantSubmissions({ phone, telegramId, codes = [] }) {
  const list = [];
  for (const m of inMemoryStore.merchantSubmissions.values()) {
    if (
      (phone && (m.merchantPhone === phone || m.merchant_phone === phone)) ||
      (telegramId && String(m.merchantTelegramId || m.merchant_telegram_id) === String(telegramId)) ||
      (codes && codes.includes(m.ticketCode || m.ticket_code))
    ) {
      list.push(m);
    }
  }
  return list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export async function getAllMerchantSubmissionsForWorker() {
  return Array.from(inMemoryStore.merchantSubmissions.values()).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export async function approveMerchantSubmissionToShelf({ ticketCode, publicPriceEtb, workerUsername = 'korcha_support', workerNotes = '' }) {
  const submission = inMemoryStore.merchantSubmissions.get(ticketCode);
  if (!submission) throw new Error('Submission not found');
  const price = publicPriceEtb ? parseFloat(publicPriceEtb) : (submission.askingPriceEtb || submission.asking_price_etb || 2000);
  const prod = await addShelfProduct({
    name: submission.productName || submission.product_name,
    size: submission.sizeColorDetails || submission.size_color_details || 'Standard',
    priceEtb: price,
    photoUrl: submission.photoUrls || submission.photo_urls || '',
    categoryId: submission.categoryId || submission.category_id || 'miscellaneous',
    createdBy: `merchant_${ticketCode}`
  });
  submission.status = 'approved_listed';
  submission.listed_shelf_product_id = prod.id;
  submission.agreed_shelf_price_etb = price;
  return { success: true, submission, product: prod };
}

export async function addTicketMessage(data) {
  const msg = {
    id: ++inMemoryStore.idCounter,
    ticket_code: data.ticketCode || data.ticket_code,
    sender_role: data.senderRole || data.sender_role,
    sender_name: data.senderName || data.sender_name,
    sender_telegram_id: data.senderTelegramId || data.sender_telegram_id,
    customer_phone: data.customerPhone || data.customer_phone,
    message_text: data.messageText || data.message_text,
    created_at: new Date().toISOString()
  };
  inMemoryStore.ticketMessages.push(msg);
  return msg;
}

export async function getTicketMessages(ticketCode) {
  return inMemoryStore.ticketMessages
    .filter(m => m.ticket_code === ticketCode)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

export async function getLatestCustomerTicketByTelegramId(userId) {
  const msgs = inMemoryStore.ticketMessages
    .filter(m => String(m.sender_telegram_id) === String(userId))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return msgs[0]?.ticket_code || null;
}

export async function getCustomerConversations({ telegramId, phone, codes = [] }) {
  const matchedCodes = new Set(codes);
  if (phone) {
    for (const q of inMemoryStore.quotes.values()) {
      if (q.customerPhone === phone || q.customer_phone === phone) matchedCodes.add(q.quoteCode || q.quote_code);
    }
    for (const o of inMemoryStore.orders.values()) {
      if (o.customerPhone === phone || o.customer_phone === phone) matchedCodes.add(o.orderCode || o.order_code);
    }
  }
  const result = [];
  for (const c of matchedCodes) {
    const msgs = inMemoryStore.ticketMessages.filter(m => m.ticket_code === c);
    result.push({
      ticketCode: c,
      category: 'support',
      summary: msgs[0]?.message_text || `Ticket ${c}`,
      status: 'active',
      customerPhone: phone || null,
      updatedAt: msgs[msgs.length - 1]?.created_at || new Date().toISOString(),
      messages: msgs
    });
  }
  return result;
}

export async function getAllConversationsForWorker() {
  const map = new Map();
  for (const m of inMemoryStore.ticketMessages) {
    if (!map.has(m.ticket_code)) {
      map.set(m.ticket_code, {
        ticketCode: m.ticket_code,
        summary: m.message_text,
        customerPhone: m.customer_phone || null,
        updatedAt: m.created_at,
        messages: []
      });
    }
    map.get(m.ticket_code).messages.push(m);
  }
  return Array.from(map.values());
}

export async function recordCustomerPing(data) {
  const ping = {
    id: ++inMemoryStore.idCounter,
    ...data,
    created_at: new Date().toISOString()
  };
  inMemoryStore.pings.push(ping);
  return ping;
}

export async function recordOrderLookup(target, count) {
  return true;
}

export async function respondToCustomerPing(data) {
  return { success: true, ...data };
}

export async function getCustomerPings(code) {
  return inMemoryStore.pings.filter(p => p.referenceCode === code || p.reference_code === code);
}

export async function addWorkerNote(data) {
  return { success: true, ...data };
}

export async function getOrderDossier(code) {
  const q = inMemoryStore.quotes.get(code);
  const o = inMemoryStore.orders.get(code);
  const target = o || q;
  return {
    success: true,
    code,
    formattedDossierText: `📋 <b>Dossier: ${code}</b>\\nStatus: ${target?.status || 'Active'}\\nPhone: ${target?.customerPhone || target?.customer_phone || 'N/A'}`
  };
}

export async function resolveTrackingTarget(code) {
  const q = inMemoryStore.quotes.get(code);
  const o = inMemoryStore.orders.get(code);
  return {
    canonicalCode: code,
    customerTelegramId: o?.customerTelegramId || q?.customerTelegramId || o?.customer_telegram_id || q?.customer_telegram_id || null,
    customerPhone: o?.customerPhone || q?.customerPhone || o?.customer_phone || q?.customer_phone || null,
  };
}

export async function closePool() {
  if (pool) {
    try { await pool.end(); } catch (_) {}
  }
}

export async function syncFallbackToPostgres() {
  return { success: true };
}

export function startReconciliationWorker() {}

export default pool;
