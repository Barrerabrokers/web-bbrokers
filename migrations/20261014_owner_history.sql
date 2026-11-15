CREATE TABLE IF NOT EXISTS crm_owner_history (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 lead_id uuid NOT NULL,
 previous_owner_id uuid,
 owner_id uuid,
 previous_owner_name text NOT NULL,
 owner_name text NOT NULL,
 actor_id uuid,
 actor_name text NOT NULL,
 kind text NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE crm_owner_history ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS crm_owner_history_lead_idx ON crm_owner_history(lead_id,id);
CREATE OR REPLACE FUNCTION crm_owner_history_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'El historial de propietarios es permanente'; END $$;
DROP TRIGGER IF EXISTS crm_owner_history_immutable ON crm_owner_history;
CREATE TRIGGER crm_owner_history_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON crm_owner_history FOR EACH STATEMENT EXECUTE FUNCTION crm_owner_history_immutable();
LOCK TABLE crm_leads IN SHARE ROW EXCLUSIVE MODE;
INSERT INTO crm_owner_history(lead_id,owner_id,previous_owner_name,owner_name,actor_name,kind)
SELECT l.id,l.assigned_agent_id,'No disponible',COALESCE(a.name,a.email,'Sin asignar'),'Sistema: propietario al activar el historial','baseline'
FROM crm_leads l LEFT JOIN agents a ON a.id=l.assigned_agent_id
WHERE NOT EXISTS(SELECT 1 FROM crm_owner_history h WHERE h.lead_id=l.id);
CREATE OR REPLACE FUNCTION crm_record_owner_history() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE old_id uuid; actor uuid; actor_label text; old_label text; new_label text;
BEGIN
 IF TG_OP='UPDATE' AND NEW.assigned_agent_id IS NOT DISTINCT FROM OLD.assigned_agent_id THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' THEN old_id:=OLD.assigned_agent_id; END IF;
 actor:=NULLIF(current_setting('crm.owner_actor_id',true),'')::uuid;
 SELECT COALESCE(name,email) INTO actor_label FROM agents WHERE id=actor;
 SELECT COALESCE(name,email) INTO old_label FROM agents WHERE id=old_id;
 SELECT COALESCE(name,email) INTO new_label FROM agents WHERE id=NEW.assigned_agent_id;
 INSERT INTO crm_owner_history(lead_id,previous_owner_id,owner_id,previous_owner_name,owner_name,actor_id,actor_name,kind)
 VALUES(NEW.id,old_id,NEW.assigned_agent_id,COALESCE(old_label,CASE WHEN old_id IS NULL THEN 'Sin asignar' ELSE 'Agente no disponible' END),COALESCE(new_label,CASE WHEN NEW.assigned_agent_id IS NULL THEN 'Sin asignar' ELSE 'Agente no disponible' END),actor,COALESCE(actor_label,'Sistema o integración (sin autor registrado)'),CASE WHEN TG_OP='INSERT' THEN 'initial' ELSE 'change' END);
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS crm_record_owner_history ON crm_leads;
CREATE TRIGGER crm_record_owner_history AFTER INSERT OR UPDATE OF assigned_agent_id ON crm_leads FOR EACH ROW EXECUTE FUNCTION crm_record_owner_history();
