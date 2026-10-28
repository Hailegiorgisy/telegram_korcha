-- 002_add_worker_notifications_and_pings.sql: Worker Notifications, Follow-up Pings, Continuous Two-Way Chat & Shelf Products

-- 1. Add worker tracking, response fields, and telegram IDs to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS assigned_worker VARCHAR(100) DEFAULT 'korcha_support';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS latest_worker_note TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS worker_response TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS last_customer_ping TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS last_lookup_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_telegram_id BIGINT;

-- 2. Add customer telegram ID to quotes
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS customer_telegram_id BIGINT;

-- 3. Customer Inquiries & Follow-up Pings Table with direct worker response tracking
CREATE TABLE IF NOT EXISTS inquiry_pings (
    id SERIAL PRIMARY KEY,
    reference_code VARCHAR(50) NOT NULL,
    customer_phone VARCHAR(50) NOT NULL,
    customer_name VARCHAR(100),
    customer_telegram_id BIGINT,
    ping_type VARCHAR(30) DEFAULT 'status_followup', -- 'status_followup', 'order_lookup', 'urgent_ping', 'direct_chat'
    customer_note TEXT,
    assigned_worker VARCHAR(100) DEFAULT 'korcha_support',
    worker_response TEXT,
    responded_at TIMESTAMP WITH TIME ZONE,
    responded_by VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inquiry_pings_code ON inquiry_pings(reference_code);
CREATE INDEX IF NOT EXISTS idx_inquiry_pings_phone ON inquiry_pings(customer_phone);
CREATE INDEX IF NOT EXISTS idx_inquiry_pings_created ON inquiry_pings(created_at DESC);

-- 4. Continuous Two-Way Chat Thread for Orders & Quotes
CREATE TABLE IF NOT EXISTS ticket_messages (
    id SERIAL PRIMARY KEY,
    ticket_code VARCHAR(50) NOT NULL,
    sender_role VARCHAR(20) NOT NULL, -- 'customer' or 'worker'
    sender_name VARCHAR(100),
    sender_telegram_id BIGINT,
    customer_phone VARCHAR(50),
    message_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ticket_messages_code ON ticket_messages(ticket_code);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_created ON ticket_messages(created_at ASC);

-- 5. Shelf Products (Configurable by korcha_support with categories, sizes, prices, and bestsellers)
CREATE TABLE IF NOT EXISTS shelf_products (
    id SERIAL PRIMARY KEY,
    category_id VARCHAR(50) NOT NULL, -- 'womens', 'kids', 'beauty', 'electronics', 'home', 'miscellaneous'
    name VARCHAR(255) NOT NULL,
    size VARCHAR(100),
    price_etb NUMERIC(12, 2) NOT NULL,
    photo_url TEXT NOT NULL,
    is_bestseller BOOLEAN DEFAULT FALSE,
    created_by VARCHAR(100) DEFAULT 'korcha_support',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_shelf_products_cat ON shelf_products(category_id);
CREATE INDEX IF NOT EXISTS idx_shelf_products_bestseller ON shelf_products(is_bestseller);

-- 6. Shelf Categories (Editable by korcha_support)
CREATE TABLE IF NOT EXISTS shelf_categories (
    id VARCHAR(50) PRIMARY KEY,
    name_am VARCHAR(150) NOT NULL,
    name_en VARCHAR(150) NOT NULL,
    icon VARCHAR(30) DEFAULT '📦',
    color VARCHAR(100) DEFAULT 'from-amber-500 to-orange-600',
    updated_by VARCHAR(100) DEFAULT 'korcha_support',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
