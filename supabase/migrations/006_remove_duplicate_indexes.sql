-- Remove only confirmed duplicate indexes reported by the Supabase performance advisor.
-- Keep the original foreign-key indexes and drop the exact duplicates.
drop index if exists public.project_capabilities_project_idx;
drop index if exists public.project_decisions_project_idx;
drop index if exists public.project_requirements_project_idx;
drop index if exists public.project_resources_project_idx;
drop index if exists public.resource_chunks_resource_idx;
