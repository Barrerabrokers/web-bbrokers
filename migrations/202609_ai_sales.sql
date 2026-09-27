-- Additive migration. Run in a transaction; never alters CRM business records.
CREATE TABLE IF NOT EXISTS crm_ai_events (
 id BIGSERIAL PRIMARY KEY, lead_id UUID NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
 event_type TEXT NOT NULL, source TEXT NOT NULL, source_id TEXT NOT NULL,
 event_data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 processed_at TIMESTAMPTZ, dedupe_key TEXT UNIQUE
);
CREATE INDEX IF NOT EXISTS crm_ai_pending ON crm_ai_events(lead_id,id) WHERE processed_at IS NULL;
CREATE INDEX IF NOT EXISTS crm_ai_events_signals ON crm_ai_events(lead_id,created_at DESC,event_type);
CREATE TABLE IF NOT EXISTS crm_ai_usage (
 day DATE PRIMARY KEY, requests INTEGER NOT NULL DEFAULT 0
);
-- One shared provider gate across cron and post-response workers, including serverless replicas.
CREATE TABLE IF NOT EXISTS crm_ai_control (
 id INTEGER PRIMARY KEY CHECK(id=1), lease_token UUID, lease_until TIMESTAMPTZ,
 next_model_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO crm_ai_control(id) VALUES(1) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS crm_ai_state (
 lead_id UUID PRIMARY KEY REFERENCES crm_leads(id) ON DELETE CASCADE,
 ai_score INTEGER NOT NULL DEFAULT 0 CHECK(ai_score BETWEEN 0 AND 100),
 ai_status TEXT NOT NULL DEFAULT 'NEW', analysis JSONB NOT NULL DEFAULT '{}',
 summary TEXT NOT NULL DEFAULT '', last_analyzed_at TIMESTAMPTZ,
 next_followup_at TIMESTAMPTZ, next_review_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 lease_token UUID, lease_until TIMESTAMPTZ, attempts INTEGER NOT NULL DEFAULT 0,
 retry_at TIMESTAMPTZ, last_error TEXT, model_version TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS crm_ai_recommendations (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), lead_id UUID NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
 assigned_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL, fingerprint TEXT NOT NULL,
 priority TEXT NOT NULL, title TEXT NOT NULL, reasoning TEXT NOT NULL, confidence REAL NOT NULL CHECK(confidence BETWEEN 0 AND 1),
 suggested_message TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'pending'
 CHECK(status IN ('pending','completed','dismissed','snoozed','superseded')),
 due_at TIMESTAMPTZ, snoozed_until TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(lead_id,fingerprint)
);
CREATE TABLE IF NOT EXISTS crm_ai_history (
 id BIGSERIAL PRIMARY KEY, lead_id UUID NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
 previous_score INTEGER, score INTEGER NOT NULL, previous_status TEXT, status TEXT NOT NULL,
 reasoning TEXT NOT NULL, snapshot JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crm_ai_history_time ON crm_ai_history(created_at DESC);
CREATE TABLE IF NOT EXISTS crm_ai_feedback (
 id BIGSERIAL PRIMARY KEY, recommendation_id UUID NOT NULL REFERENCES crm_ai_recommendations(id) ON DELETE CASCADE,
 actor_id UUID REFERENCES agents(id) ON DELETE SET NULL, action TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION crm_ai_capture() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE n JSONB:=to_jsonb(NEW); o JSONB:='{}'; lid UUID; kind TEXT; sid TEXT;
BEGIN
 IF TG_OP='UPDATE' THEN o:=to_jsonb(OLD); END IF;
 -- Scheduler bookkeeping and read receipts are not new commercial interactions.
 IF (n-'updated_at'-'read_by'-'checked_at'-'last_error'-'calendar_version'-'assignment_version'-'reminder_version')=
    (o-'updated_at'-'read_by'-'checked_at'-'last_error'-'calendar_version'-'assignment_version'-'reminder_version') THEN RETURN NEW; END IF;
 sid:=COALESCE(n->>'id',n->>'activity_id','');
 IF TG_TABLE_NAME='crm_leads' THEN
   lid:=(n->>'id')::uuid;
   kind:=CASE WHEN TG_OP='INSERT' THEN 'lead_created' WHEN n->>'status' IS DISTINCT FROM o->>'status' THEN 'pipeline_changed'
     WHEN n->>'assigned_agent_id' IS DISTINCT FROM o->>'assigned_agent_id' THEN 'agent_changed'
     WHEN n->'meta_properties' IS DISTINCT FROM o->'meta_properties' THEN 'form_submitted' ELSE 'lead_updated' END;
 ELSIF TG_TABLE_NAME='crm_whatsapp_messages' THEN
   SELECT lead_id INTO lid FROM crm_whatsapp_conversations WHERE id=(n->>'conversation_id')::uuid;
   IF n->>'status' IN ('failed','error') THEN RETURN NEW; END IF;
   IF TG_OP='UPDATE' AND n->>'status'='read' AND o->>'status' IS DISTINCT FROM 'read' AND n->>'direction'='outbound' THEN
     kind:='whatsapp_read';
   ELSE
     IF TG_OP='UPDATE' AND n->>'content' IS NOT DISTINCT FROM o->>'content' THEN RETURN NEW; END IF;
     kind:=CASE WHEN n->>'direction'='inbound' THEN 'whatsapp_received' ELSE 'whatsapp_sent' END;
   END IF;
 ELSIF TG_TABLE_NAME IN ('crm_activity_results','crm_meeting_schedules') THEN
   SELECT lead_id INTO lid FROM crm_activities WHERE id=(n->>'activity_id')::uuid;
   kind:=CASE WHEN n->>'outcome_status'='cancelled' OR n->>'cancelled_at' IS NOT NULL THEN 'meeting_cancelled' WHEN TG_TABLE_NAME='crm_activity_results' THEN 'meeting_completed' ELSE 'meeting_updated' END;
 ELSIF TG_TABLE_NAME='crm_client_mail_events' THEN
   SELECT c.lead_id INTO lid FROM crm_client_mail_history h JOIN crm_private_clients c ON c.id=h.client_id WHERE h.id=(n->>'history_id')::uuid;
   kind:=CASE WHEN n->>'event_type'='click' THEN 'email_clicked' ELSE 'email_opened' END;
 ELSIF TG_TABLE_NAME IN ('crm_email_trackings','crm_email_attachment_trackings') THEN
   IF COALESCE((n->>'open_count')::int,0)<=COALESCE((o->>'open_count')::int,0) THEN RETURN NEW; END IF;
   lid:=(n->>'lead_id')::uuid; kind:='email_opened';
 ELSE
   lid:=(n->>'lead_id')::uuid;
   kind:=CASE n->>'type' WHEN 'correo' THEN CASE WHEN n->>'title' ~* '(abierto|apertura)' THEN 'email_opened' WHEN n->>'title' ~* '(clic|click)' THEN 'email_clicked' WHEN n->>'external_source'='gmail_inbound' OR n->>'title' ~* '^Respuesta por correo' THEN 'email_received' ELSE 'email_sent' END
     WHEN 'whatsapp' THEN CASE WHEN n->>'title' ~* '^(Respuesta por WhatsApp|WhatsApp recibido)' OR n->>'external_source'='whatsapp_inbound' THEN 'whatsapp_received' ELSE 'whatsapp_sent' END
     WHEN 'reunion' THEN 'meeting_created' WHEN 'llamada' THEN 'call_logged' WHEN 'tarea' THEN 'task_updated' ELSE 'note_created' END;
 END IF;
 IF lid IS NOT NULL THEN
   INSERT INTO crm_ai_events(lead_id,event_type,source,source_id,event_data)
   VALUES(lid,kind,TG_TABLE_NAME,sid,jsonb_build_object('operation',TG_OP,'previous_status',o->>'status','status',n->>'status','type',n->>'type','title',n->>'title','direction',n->>'direction','occurred_at',COALESCE(n->>'occurred_at',n->>'created_at'),'body',left(COALESCE(n->>'body',n->>'content',n->>'outcome',''),4000)));
   UPDATE crm_ai_state SET attempts=0,retry_at=NULL WHERE lead_id=lid AND attempts>=5;
 END IF;
 RETURN NEW;
END $$;
DO $$ DECLARE t TEXT; BEGIN
 FOREACH t IN ARRAY ARRAY['crm_leads','crm_activities','crm_whatsapp_messages','crm_activity_results','crm_meeting_schedules','crm_email_trackings','crm_email_attachment_trackings','crm_client_mail_events'] LOOP
  IF to_regclass('public.'||t) IS NOT NULL THEN
   EXECUTE format('CREATE OR REPLACE TRIGGER crm_ai_event AFTER INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION crm_ai_capture()',t);
  END IF;
 END LOOP;
 FOREACH t IN ARRAY ARRAY['crm_ai_events','crm_ai_state','crm_ai_recommendations','crm_ai_history','crm_ai_feedback','crm_ai_usage','crm_ai_control'] LOOP
   EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
   EXECUTE format('REVOKE ALL ON %I FROM PUBLIC',t);
   IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN EXECUTE format('REVOKE ALL ON %I FROM anon,authenticated',t); END IF;
 END LOOP;
END $$;
INSERT INTO crm_ai_events(lead_id,event_type,source,source_id,dedupe_key)
 SELECT id,'lead_created','initial_backfill',id::text,'initial:'||id::text FROM crm_leads ON CONFLICT(dedupe_key) DO NOTHING;
