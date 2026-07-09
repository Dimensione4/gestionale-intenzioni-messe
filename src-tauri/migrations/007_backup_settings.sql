ALTER TABLE parish_settings ADD COLUMN backup_frequency_hours INTEGER NOT NULL DEFAULT 6 CHECK(backup_frequency_hours IN (6,12,24));
ALTER TABLE parish_settings ADD COLUMN online_backup_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE parish_settings ADD COLUMN online_backup_provider TEXT NOT NULL DEFAULT 'google_drive';
ALTER TABLE parish_settings ADD COLUMN online_backup_account_email TEXT NOT NULL DEFAULT '';
ALTER TABLE parish_settings ADD COLUMN online_backup_encryption_enabled INTEGER NOT NULL DEFAULT 1;
