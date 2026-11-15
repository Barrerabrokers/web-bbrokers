-- Start a clean welcome-only release. Preserve CRM contacts, messages and website inventory.
DO $$ BEGIN
 PERFORM pg_advisory_xact_lock(74102616);
 IF EXISTS(SELECT 1 FROM crm_whatsapp_agent_settings WHERE key='mia-runtime-v2') THEN RETURN; END IF;
 IF NOT EXISTS(SELECT 1 FROM agents WHERE id='72114681-27f9-4bb0-980a-1a880a8b6d80' AND role='admin' AND name='Pablo Barrera')
 OR NOT EXISTS(SELECT 1 FROM crm_whatsapp_conversations WHERE id='945a8948-9cad-472b-bf7f-985a1ddaedf7' AND channel='whatsapp')
 THEN RAISE EXCEPTION 'Verified test administrator or conversation missing'; END IF;
 DELETE FROM crm_whatsapp_agent_settings WHERE key LIKE 'mia-%';
 INSERT INTO crm_whatsapp_agent_settings(key,value) VALUES
 ('mia-runtime-v2',jsonb_build_object('resetAt',now(),'testAdministratorId','72114681-27f9-4bb0-980a-1a880a8b6d80','testConversationId','945a8948-9cad-472b-bf7f-985a1ddaedf7')::text),
 ('mia-access-v1','{"mode":"disabled","conversationIds":[],"pausePolicy":"manual","reason":"Activar solo después de verificar el despliegue de bienvenida"}'),
 ('mia-guidance-v1','{"instructions":"","corrections":[],"revision":0,"approvedProjects":[],"approvedProjectValues":{}}');
 UPDATE crm_leads SET meta_properties=meta_properties-'crm_mia_sequence_v1'
 WHERE meta_properties ? 'crm_mia_sequence_v1';
 UPDATE crm_whatsapp_ai_retry SET state='skipped',error_code='mia_reset' WHERE state IN ('pending','processing');
 UPDATE crm_whatsapp_conversations SET ai_enabled=true,ai_assist_assigned=true WHERE id='945a8948-9cad-472b-bf7f-985a1ddaedf7';
END $$;
