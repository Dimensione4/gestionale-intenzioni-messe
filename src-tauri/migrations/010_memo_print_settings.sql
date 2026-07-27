ALTER TABLE parish_settings ADD COLUMN memo_thermal_font_scale INTEGER NOT NULL DEFAULT 115 CHECK(memo_thermal_font_scale BETWEEN 90 AND 135);
