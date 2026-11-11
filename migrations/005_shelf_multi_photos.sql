-- 005_shelf_multi_photos.sql: Multiple images per shelf product
ALTER TABLE shelf_products ADD COLUMN IF NOT EXISTS photo_urls JSONB DEFAULT '[]'::jsonb;

-- Backfill primary photo into array when empty
UPDATE shelf_products
SET photo_urls = jsonb_build_array(photo_url)
WHERE (photo_urls IS NULL OR photo_urls = '[]'::jsonb)
  AND photo_url IS NOT NULL
  AND photo_url <> '';
