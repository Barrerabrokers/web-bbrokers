ALTER TABLE crm_task_schedules ADD COLUMN IF NOT EXISTS duration_minutes INTEGER NOT NULL DEFAULT 30 CHECK (duration_minutes IN (30,60));
ALTER TABLE crm_meeting_links ALTER COLUMN weekdays SET DEFAULT '{0,1,2,3,4,5,6}',ALTER COLUMN start_time SET DEFAULT '08:00',ALTER COLUMN end_time SET DEFAULT '21:00',ALTER COLUMN slot_interval SET DEFAULT 30;
UPDATE crm_meeting_links SET weekdays='{0,1,2,3,4,5,6}',start_time='08:00',end_time='21:00',slot_interval=30,durations='{30,60}',updated_at=now()
WHERE weekdays IS DISTINCT FROM ARRAY[0,1,2,3,4,5,6] OR start_time<>'08:00' OR end_time<>'21:00' OR slot_interval<>30 OR durations IS DISTINCT FROM ARRAY[30,60];
