ALTER TABLE parish_settings ADD COLUMN receipt_custom_width_mm INTEGER NOT NULL DEFAULT 0 CHECK(receipt_custom_width_mm BETWEEN 0 AND 120);
ALTER TABLE parish_settings ADD COLUMN receipt_custom_height_mm INTEGER NOT NULL DEFAULT 0 CHECK(receipt_custom_height_mm BETWEEN 0 AND 300);
