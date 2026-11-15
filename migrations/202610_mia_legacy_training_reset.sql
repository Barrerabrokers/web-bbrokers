-- Delete only MIA-specific training and drafts; preserve CRM messages and unrelated training.
DO $$ BEGIN
 IF to_regclass('public.crm_ai_training') IS NOT NULL AND to_regclass('public.crm_whatsapp_ai_corrections') IS NOT NULL THEN
  DELETE FROM crm_ai_training WHERE id IN (SELECT source_message_id FROM crm_whatsapp_ai_corrections);
 END IF;
 IF to_regclass('public.crm_whatsapp_ai_corrections') IS NOT NULL THEN
  DELETE FROM crm_whatsapp_ai_corrections;
 END IF;
 IF to_regclass('public.crm_whatsapp_admin_recontacts') IS NOT NULL THEN
  DELETE FROM crm_whatsapp_admin_recontacts WHERE state='prepared';
 END IF;
END $$;
