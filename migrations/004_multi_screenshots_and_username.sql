-- 004_multi_screenshots_and_username.sql
-- Support multiple product screenshots + explicit telegram_username on quotes

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS customer_telegram_username VARCHAR(255);
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS screenshot_urls JSONB DEFAULT '[]'::jsonb;

-- Keep screenshot_url for backward compatibility (first image); screenshot_urls holds the full list
CREATE INDEX IF NOT EXISTS idx_quotes_telegram_username ON quotes(customer_telegram_username);

COMMENT ON COLUMN quotes.screenshot_urls IS 'JSON array of screenshot file paths or Telegram file_ids';
COMMENT ON COLUMN quotes.customer_telegram_username IS 'Telegram @username captured from bot/TMA when available';
