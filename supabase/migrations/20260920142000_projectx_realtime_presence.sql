-- Private workspace Presence authorization for ProjectX collaboration.
drop policy if exists "projectx workspace presence send" on realtime.messages;
create policy "projectx workspace presence send" on realtime.messages
for insert to authenticated
with check (
  realtime.messages.extension = 'presence'
  and exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = substring(realtime.topic() from '^workspace:([0-9a-f-]{36})$')::uuid
      and wm.user_id = (select auth.uid())
  )
);
drop policy if exists "projectx workspace presence read" on realtime.messages;
create policy "projectx workspace presence read" on realtime.messages
for select to authenticated
using (
  realtime.messages.extension = 'presence'
  and exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = substring(realtime.topic() from '^workspace:([0-9a-f-]{36})$')::uuid
      and wm.user_id = (select auth.uid())
  )
);