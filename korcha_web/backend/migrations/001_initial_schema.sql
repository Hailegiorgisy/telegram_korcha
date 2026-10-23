-- 001_initial_schema.sql: ACID-compliant Schema for Telegram Korcha

-- 1. Customers Table
CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT UNIQUE,
    telegram_username VARCHAR(255),
    first_name VARCHAR(255),
    phone_number VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customers_telegram_id ON customers(telegram_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone_number);

-- 2. Quotes Table (Inbound requests from Link or Screenshot)
CREATE TABLE IF NOT EXISTS quotes (
    id SERIAL PRIMARY KEY,
    quote_code VARCHAR(32) UNIQUE NOT NULL,
    customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
    customer_phone VARCHAR(50) NOT NULL,
    source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('link', 'screenshot', 'both')),
    product_url TEXT,
    screenshot_url TEXT,
    size VARCHAR(100),
    color VARCHAR(100),
    quantity INTEGER DEFAULT 1,
    details TEXT,
    status VARCHAR(30) DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'priced', 'accepted', 'rejected', 'expired')),
    quoted_price_etb NUMERIC(12, 2),
    deposit_required_etb NUMERIC(12, 2),
    worker_notes TEXT,
    assigned_worker VARCHAR(100) DEFAULT 'korcha_support',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_quotes_code ON quotes(quote_code);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_phone ON quotes(customer_phone);

-- 3. Orders Table
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    order_code VARCHAR(32) UNIQUE NOT NULL,
    quote_id INTEGER REFERENCES quotes(id) ON DELETE SET NULL,
    customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
    customer_phone VARCHAR(50) NOT NULL,
    product_summary TEXT,
    status VARCHAR(30) DEFAULT 'pending_deposit' CHECK (status IN (
        'pending_deposit',
        'deposit_verified',
        'purchased',
        'cargo_transit',
        'arrived_addis',
        'out_for_delivery',
        'delivered',
        'cancelled'
    )),
    total_price_etb NUMERIC(12, 2) NOT NULL,
    deposit_amount_etb NUMERIC(12, 2) NOT NULL,
    cod_balance_etb NUMERIC(12, 2) NOT NULL,
    payment_method VARCHAR(50) DEFAULT 'telebirr',
    deposit_receipt_url TEXT,
    delivery_city VARCHAR(100) DEFAULT 'Addis Ababa',
    delivery_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orders_code ON orders(order_code);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders(customer_phone);

-- 4. Order Status Audit History Table
CREATE TABLE IF NOT EXISTS order_status_history (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    previous_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    changed_by VARCHAR(100) DEFAULT 'system',
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order ON order_status_history(order_id);
