-- Make durable execution events available to the existing Supabase Realtime channel used by the Runs surface.
alter publication supabase_realtime add table public.project_execution_events;
