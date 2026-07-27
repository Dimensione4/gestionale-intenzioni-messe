ALTER TABLE parish_settings ADD COLUMN memo_show_notes INTEGER NOT NULL DEFAULT 0 CHECK(memo_show_notes IN (0,1));
