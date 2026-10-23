-- 002_add_worker_notifications_and_pings.sql: Worker Notifications, Follow-up Pings & Direct Responses

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
