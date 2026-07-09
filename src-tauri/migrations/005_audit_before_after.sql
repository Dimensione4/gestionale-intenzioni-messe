DROP TRIGGER IF EXISTS audit_intention_update;

CREATE TRIGGER audit_intention_update
AFTER UPDATE OF mass_date,mass_time,offerer_first_name,offerer_last_name,offerer_phone,intention_text,remembered_person,offering_cents,payment_method,internal_notes ON mass_intentions
WHEN OLD.status = NEW.status
BEGIN
  UPDATE receipts SET amount_cents=NEW.offering_cents,updated_at=datetime('now') WHERE intention_id=NEW.id;
  INSERT INTO audit_logs(action,entity_type,entity_id,details,created_at)
  VALUES(
    'update',
    'mass_intention',
    NEW.id,
    json_object(
      'before',json_object('data',OLD.mass_date,'ora',OLD.mass_time,'offerente',trim(COALESCE(OLD.offerer_first_name,'')||' '||COALESCE(OLD.offerer_last_name,'')),'intenzione',OLD.intention_text,'persona',COALESCE(OLD.remembered_person,''),'offerta',OLD.offering_cents),
      'after',json_object('data',NEW.mass_date,'ora',NEW.mass_time,'offerente',trim(COALESCE(NEW.offerer_first_name,'')||' '||COALESCE(NEW.offerer_last_name,'')),'intenzione',NEW.intention_text,'persona',COALESCE(NEW.remembered_person,''),'offerta',NEW.offering_cents)
    ),
    datetime('now')
  );
END;
