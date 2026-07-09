ALTER TABLE mass_intentions ADD COLUMN delete_reason TEXT;

CREATE TRIGGER IF NOT EXISTS audit_intention_update
AFTER UPDATE OF mass_date,mass_time,offerer_first_name,offerer_last_name,offerer_phone,intention_text,remembered_person,offering_cents,payment_method,internal_notes ON mass_intentions
WHEN OLD.status = NEW.status
BEGIN
  UPDATE receipts SET amount_cents=NEW.offering_cents,updated_at=datetime('now') WHERE intention_id=NEW.id;
  INSERT INTO audit_logs(action,entity_type,entity_id,details,created_at)
  VALUES('update','mass_intention',NEW.id,'Intenzione modificata',datetime('now'));
END;

CREATE TRIGGER IF NOT EXISTS archive_deleted_intention
AFTER UPDATE OF status ON mass_intentions
WHEN OLD.status != 'deleted' AND NEW.status = 'deleted'
BEGIN
  UPDATE receipts SET status='cancelled',cancelled_reason=NEW.delete_reason,updated_at=datetime('now') WHERE intention_id=NEW.id;
  INSERT INTO audit_logs(action,entity_type,entity_id,details,created_at)
  VALUES('delete','mass_intention',NEW.id,NEW.delete_reason,datetime('now'));
END;

CREATE TRIGGER IF NOT EXISTS restore_deleted_intention
AFTER UPDATE OF status ON mass_intentions
WHEN OLD.status = 'deleted' AND NEW.status = 'active'
BEGIN
  UPDATE receipts SET status='valid',cancelled_reason=NULL,updated_at=datetime('now') WHERE intention_id=NEW.id;
  INSERT INTO audit_logs(action,entity_type,entity_id,details,created_at)
  VALUES('restore','mass_intention',NEW.id,'Intenzione ripristinata',datetime('now'));
END;
