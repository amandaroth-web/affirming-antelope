-- Voice role-play quotas (docs/voice.md). Two new buckets for consume_ai_quota:
--   stt: one speech-to-text upload (POST /api/voice/transcribe), one per learner turn
--   tts: one text-to-speech request (POST /api/voice/speak), one per spoken sentence
-- Counted per request like the other buckets, lower for anonymous users, and covered by
-- the global circuit breaker (ai_global_limits), because take_ai_quota already reads
-- the ceiling for whatever bucket it is given. Tune later without a deploy:
--   update app_private.ai_quota_limits set per_day = 120 where tier = 'anonymous' and bucket = 'stt';
--
-- The legacy x-antelope-key tier gets no voice rows: the voice routes require a Supabase
-- user, and take_ai_quota raises for a tier/bucket pair that has no row.

alter table app_private.ai_quota_limits drop constraint ai_quota_limits_bucket_check;
alter table app_private.ai_quota_limits
  add constraint ai_quota_limits_bucket_check check (bucket in ('turn', 'debrief', 'drill', 'stt', 'tts'));

alter table app_private.ai_global_limits drop constraint ai_global_limits_bucket_check;
alter table app_private.ai_global_limits
  add constraint ai_global_limits_bucket_check check (bucket in ('turn', 'debrief', 'drill', 'stt', 'tts'));

alter table app_private.ai_usage drop constraint ai_usage_bucket_check;
alter table app_private.ai_usage
  add constraint ai_usage_bucket_check check (bucket in ('turn', 'debrief', 'drill', 'stt', 'tts'));

alter table app_private.ai_usage_legacy_ip drop constraint ai_usage_legacy_ip_bucket_check;
alter table app_private.ai_usage_legacy_ip
  add constraint ai_usage_legacy_ip_bucket_check check (bucket in ('turn', 'debrief', 'drill', 'stt', 'tts'));

alter table app_private.ai_usage_global drop constraint ai_usage_global_bucket_check;
alter table app_private.ai_usage_global
  add constraint ai_usage_global_bucket_check check (bucket in ('turn', 'debrief', 'drill', 'stt', 'tts'));

insert into app_private.ai_quota_limits (tier, bucket, per_day, per_minute) values
  ('anonymous', 'stt', 60, 8),
  ('anonymous', 'tts', 200, 30),
  ('permanent', 'stt', 300, 15),
  ('permanent', 'tts', 1000, 60);

-- Across all callers per UTC day. Speech costs more than text, so these are tighter
-- per request than turn's 20000.
insert into app_private.ai_global_limits (bucket, per_day) values
  ('stt', 5000),
  ('tts', 25000);
