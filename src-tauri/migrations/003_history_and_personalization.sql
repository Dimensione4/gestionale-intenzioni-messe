ALTER TABLE parish_settings ADD COLUMN priest_first_name TEXT NOT NULL DEFAULT '';
ALTER TABLE parish_settings ADD COLUMN priest_last_name TEXT NOT NULL DEFAULT '';
ALTER TABLE parish_settings ADD COLUMN primary_color TEXT NOT NULL DEFAULT '#173D61';
ALTER TABLE parish_settings ADD COLUMN accent_color TEXT NOT NULL DEFAULT '#B69943';
ALTER TABLE parish_settings ADD COLUMN logo_data_url TEXT NOT NULL DEFAULT '';

CREATE TRIGGER IF NOT EXISTS enforce_mass_intention_limit_on_update
BEFORE UPDATE OF mass_date, mass_time, status ON mass_intentions
WHEN NEW.status = 'active' AND (
  SELECT COUNT(*) FROM mass_intentions
  WHERE status = 'active'
    AND mass_date = NEW.mass_date
    AND mass_time = NEW.mass_time
    AND id != NEW.id
) >= COALESCE((SELECT max_intentions_per_mass FROM parish_settings WHERE id = 1), 3)
BEGIN
  SELECT RAISE(ABORT, 'Limite intenzioni raggiunto per questa messa');
END;
