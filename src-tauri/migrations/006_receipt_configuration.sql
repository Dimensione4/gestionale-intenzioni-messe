ALTER TABLE parish_settings ADD COLUMN receipt_show_address INTEGER NOT NULL DEFAULT 1;
ALTER TABLE parish_settings ADD COLUMN receipt_show_contacts INTEGER NOT NULL DEFAULT 1;
ALTER TABLE parish_settings ADD COLUMN receipt_show_priest INTEGER NOT NULL DEFAULT 1;
ALTER TABLE parish_settings ADD COLUMN receipt_show_offerer INTEGER NOT NULL DEFAULT 1;
ALTER TABLE parish_settings ADD COLUMN receipt_show_intention INTEGER NOT NULL DEFAULT 1;
ALTER TABLE parish_settings ADD COLUMN receipt_show_mass INTEGER NOT NULL DEFAULT 1;
ALTER TABLE parish_settings ADD COLUMN receipt_show_offering INTEGER NOT NULL DEFAULT 1;
ALTER TABLE parish_settings ADD COLUMN receipt_custom_message TEXT NOT NULL DEFAULT 'Grazie';
