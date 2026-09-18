-- Realtime project presence/sync for the canonical ProjectX workspace.
-- RLS remains authoritative for which authenticated users can receive changes.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'projects'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'project_messages'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.project_messages;
    END IF;
  END IF;
END $$;