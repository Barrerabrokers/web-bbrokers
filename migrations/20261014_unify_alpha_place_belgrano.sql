-- Only the three explicitly requested aliases belong to this consolidation.
LOCK TABLE crm_leads IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE crm_data_properties IN SHARE ROW EXCLUSIVE MODE;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM developments WHERE id='588929b7-ee8d-42cc-a7de-3bb22fd1ab4d' AND name='Alpha Place Belgrano') THEN
  RAISE EXCEPTION 'No se encontró el desarrollo canónico Alpha Place Belgrano';
 END IF;
END $$;
CREATE OR REPLACE FUNCTION crm_normalize_alpha_place_belgrano() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.development_id='588929b7-ee8d-42cc-a7de-3bb22fd1ab4d'::uuid
 OR (NEW.development_id IS NULL AND lower(btrim(NEW.development_name_text)) IN ('alpha place belgrano','alpha place belgrano german')) THEN
  NEW.development_id:='588929b7-ee8d-42cc-a7de-3bb22fd1ab4d'::uuid;
  NEW.development_name_text:='Alpha Place Belgrano';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS crm_normalize_alpha_place_belgrano ON crm_leads;
CREATE TRIGGER crm_normalize_alpha_place_belgrano BEFORE INSERT OR UPDATE OF development_id,development_name_text ON crm_leads FOR EACH ROW EXECUTE FUNCTION crm_normalize_alpha_place_belgrano();
UPDATE crm_leads SET development_id='588929b7-ee8d-42cc-a7de-3bb22fd1ab4d',development_name_text='Alpha Place Belgrano',updated_at=now()
WHERE (development_id='588929b7-ee8d-42cc-a7de-3bb22fd1ab4d' OR lower(btrim(development_name_text)) IN ('alpha place belgrano','alpha place belgrano german'))
AND (development_id IS DISTINCT FROM '588929b7-ee8d-42cc-a7de-3bb22fd1ab4d'::uuid OR development_name_text IS DISTINCT FROM 'Alpha Place Belgrano');
-- The official development already provides the sole selectable option. Keep the
-- former custom property as inactive metadata rather than deleting its mapping.
UPDATE crm_data_properties SET local_development_id='588929b7-ee8d-42cc-a7de-3bb22fd1ab4d',active=false,updated_at=now()
WHERE type='development' AND (lower(btrim(value)) IN ('alpha place belgrano','alpha place belgrano german') OR lower(btrim(label)) IN ('alpha place belgrano','alpha place belgrano german'));
