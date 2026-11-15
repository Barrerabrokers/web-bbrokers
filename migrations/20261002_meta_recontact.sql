CREATE TABLE IF NOT EXISTS crm_meta_recontacts (meta_lead_id TEXT PRIMARY KEY, lead_id UUID NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
ALTER TABLE crm_meta_recontacts ENABLE ROW LEVEL SECURITY;
    CREATE OR REPLACE FUNCTION crm_require_meeting() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      -- ON CONFLICT will run the UPDATE trigger; don't treat existing leads as new inserts.
      IF TG_OP='INSERT' AND EXISTS(SELECT 1 FROM crm_leads WHERE id=NEW.id) THEN RETURN NEW; END IF;
      IF TG_OP='UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
      -- A new Meta submission reopens the contact without discarding its meetings.
      -- The event must have been inserted by this same transaction.
      IF TG_OP='UPDATE' AND NEW.status='Nuevo' AND EXISTS (
        SELECT 1 FROM crm_meta_recontacts e WHERE e.lead_id=NEW.id
          AND e.meta_lead_id=current_setting('crm.meta_recontact_event',true)
          AND e.created_at=transaction_timestamp()
      ) THEN RETURN NEW; END IF;
      IF EXISTS(SELECT 1 FROM crm_meeting_schedules s JOIN crm_activities a ON a.id=s.activity_id
        LEFT JOIN crm_activity_results r ON r.activity_id=a.id
        WHERE a.lead_id=NEW.id AND (s.ends_at<=NOW() OR s.cancelled_at IS NOT NULL) AND COALESCE(TRIM(r.outcome),'')='') THEN
        RAISE EXCEPTION 'Registrá el resultado o el motivo de cancelación de la reunión pendiente antes de cambiar el estado.';
      END IF;
      IF lower(trim(translate(NEW.status,'óÓ','oO')))='reunion' AND NOT EXISTS(
        SELECT 1 FROM crm_activities a JOIN crm_meeting_schedules s ON s.activity_id=a.id
        LEFT JOIN crm_activity_results r ON r.activity_id=a.id
        WHERE a.lead_id=NEW.id AND a.type='reunion' AND a.external_source='google_calendar'
          AND a.external_id IS NOT NULL AND a.scheduled_at>NOW() AND s.ends_at>a.scheduled_at
          AND s.cancelled_at IS NULL AND COALESCE(r.outcome_status,'completed')<>'cancelled') THEN
        RAISE EXCEPTION 'Para cambiar a Reunión primero debés agendar día y horario en el calendario.';
      END IF;
      RETURN NEW;
    END; $$;
