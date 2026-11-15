-- Retire AI Sales capture without deleting CRM or analysis history.
DO $$ DECLARE t RECORD; BEGIN
 FOR t IN SELECT c.relname AS table_name, tr.tgname AS trigger_name
  FROM pg_trigger tr JOIN pg_class c ON c.oid=tr.tgrelid
  JOIN pg_namespace n ON n.oid=c.relnamespace
  JOIN pg_proc p ON p.oid=tr.tgfoid
  WHERE n.nspname='public' AND p.proname='crm_ai_capture' AND NOT tr.tgisinternal
 LOOP
  EXECUTE format('ALTER TABLE public.%I DISABLE TRIGGER %I',t.table_name,t.trigger_name);
 END LOOP;
END $$;
