-- 003_add_ticket_chat_messages.sql
-- Ensure ticket_messages and related indexes exist (idempotent).
-- Primary definition also lives in 002_add_worker_notifications_and_pings.sql.

CREATE TABLE IF NOT EXISTS ticket_messages (
    id SERIAL PRIMARY KEY,
    ticket_code VARCHAR(50) NOT NULL,
    sender_role VARCHAR(20) NOT NULL,
    sender_name VARCHAR(100),
    sender_telegram_id BIGINT,
    customer_phone VARCHAR(50),
    message_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ticket_messages_code ON ticket_messages(ticket_code);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_created ON ticket_messages(created_at ASC);

-- Ensure quotes.customer_telegram_id exists even if 002 was partially applied
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS customer_telegram_id BIGINT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_telegram_id BIGINT;

CREATE INDEX IF NOT EXISTS idx_quotes_customer_telegram_id ON quotes(customer_telegram_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_telegram_id ON orders(customer_telegram_id);
