CREATE TRIGGER IF NOT EXISTS enforce_mass_intention_limit
BEFORE INSERT ON mass_intentions
WHEN (
  SELECT COUNT(*) FROM mass_intentions
  WHERE status = 'active'
    AND mass_date = NEW.mass_date
    AND mass_time = NEW.mass_time
) >= COALESCE((SELECT max_intentions_per_mass FROM parish_settings WHERE id = 1), 3)
BEGIN
  SELECT RAISE(ABORT, 'Limite intenzioni raggiunto per questa messa');
END;

CREATE TRIGGER IF NOT EXISTS create_receipt_after_intention
AFTER INSERT ON mass_intentions
BEGIN
  INSERT INTO receipts(receipt_number,intention_id,receipt_date,amount_cents,status,created_at,updated_at)
  VALUES(
    COALESCE((SELECT MAX(receipt_number) FROM receipts), 0) + 1,
    NEW.id,
    date('now'),
    NEW.offering_cents,
    'valid',
    datetime('now'),
    datetime('now')
  );
  INSERT INTO audit_logs(action,entity_type,entity_id,details,created_at)
  VALUES('create','mass_intention',NEW.id,'Intenzione e ricevuta create',datetime('now'));
END;
