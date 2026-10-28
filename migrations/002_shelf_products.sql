-- 002_shelf_products.sql: On-Hand Shelf Inventory Table Migration
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
CREATE INDEX IF NOT EXISTS idx_shelf_in_stock ON shelf_products(in_stock);
