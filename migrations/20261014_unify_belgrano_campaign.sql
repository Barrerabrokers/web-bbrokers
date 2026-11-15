LOCK TABLE crm_leads IN SHARE ROW EXCLUSIVE MODE;
CREATE OR REPLACE FUNCTION crm_normalize_alpha_place_belgrano() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.development_id='588929b7-ee8d-42cc-a7de-3bb22fd1ab4d'::uuid
 OR (NEW.development_id IS NULL AND lower(btrim(NEW.development_name_text)) IN ('alpha place belgrano','alpha place belgrano german','campaña: campaña 1 version 21787782816953 · belgrano/nuñez','campaña: campaña 1 version 21787782816953 belgrano/nuñez')) THEN
  NEW.development_id:='588929b7-ee8d-42cc-a7de-3bb22fd1ab4d'::uuid;
  NEW.development_name_text:='Alpha Place Belgrano';
 END IF;
 RETURN NEW;
END $$;

UPDATE crm_leads SET development_id='588929b7-ee8d-42cc-a7de-3bb22fd1ab4d',development_name_text='Alpha Place Belgrano',updated_at=now()
WHERE lower(btrim(development_name_text)) IN ('campaña: campaña 1 version 21787782816953 · belgrano/nuñez','campaña: campaña 1 version 21787782816953 belgrano/nuñez');
UPDATE crm_data_properties SET active=false,local_development_id='588929b7-ee8d-42cc-a7de-3bb22fd1ab4d',updated_at=now()
WHERE type='development' AND (lower(btrim(value)) IN ('campaña: campaña 1 version 21787782816953 · belgrano/nuñez','campaña: campaña 1 version 21787782816953 belgrano/nuñez') OR lower(btrim(label)) IN ('campaña: campaña 1 version 21787782816953 · belgrano/nuñez','campaña: campaña 1 version 21787782816953 belgrano/nuñez'));
