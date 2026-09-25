-- ProjectX transactional execution: durable inverse patches and conflict-safe rollback.

create table if not exists public.project_execution_transactions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid references public.job_queue(id) on delete set null,
  action_id text not null,
  base_version integer not null,
  status text not null default 'prepared' check (status in ('prepared','committed','rolled_back')),
  operations jsonb not null default '[]'::jsonb,
  inverse_operations jsonb not null default '[]'::jsonb,
  changed_paths jsonb not null default '[]'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  rollback_reason text,
  created_at timestamptz not null default now(),
  committed_at timestamptz,
  rolled_back_at timestamptz
);

create index if not exists project_execution_transactions_project_idx
  on public.project_execution_transactions(project_id, created_at desc);
create index if not exists project_execution_transactions_job_idx
  on public.project_execution_transactions(job_id, created_at desc);

alter table public.project_execution_transactions enable row level security;

drop policy if exists "execution transactions read" on public.project_execution_transactions;
create policy "execution transactions read" on public.project_execution_transactions
for select to authenticated
using (
  user_id = (select auth.uid())
  or (project_id is not null and (select private.is_project_member(project_id)))
);

revoke insert, update, delete on public.project_execution_transactions from anon, authenticated;

create or replace function public.commit_project_execution(
  p_project_id uuid,
  p_user_id uuid,
  p_base_version integer,
  p_job_id uuid,
  p_action_id text,
  p_executor text,
  p_status text,
  p_settings jsonb,
  p_file_operations jsonb default '[]'::jsonb,
  p_event text default 'action_finished'::text,
  p_tool text default null,
  p_message text default '',
  p_evidence jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  current_project public.projects%rowtype;
  workspace_role text;
  op jsonb;
  normalized_op jsonb;
  path text;
  content text;
  before_content text;
  before_exists boolean;
  current_settings jsonb;
  normalized_ops jsonb := '[]'::jsonb;
  inverse_ops jsonb := '[]'::jsonb;
  changed_paths jsonb := '[]'::jsonb;
  tx_id uuid := gen_random_uuid();
  tx_count integer := 0;
  total_write_bytes integer := 0;
begin
  select * into current_project
  from public.projects
  where id=p_project_id
  for update;

  if not found then raise exception 'Project not found'; end if;

  if current_project.owner_id <> p_user_id then
    select role into workspace_role
    from public.workspace_members
    where workspace_id=current_project.workspace_id and user_id=p_user_id
    limit 1;
    if workspace_role is null or workspace_role not in ('owner','admin','editor') then
      raise exception 'Not authorized';
    end if;
  end if;

  if greatest(coalesce(current_project.spec_version,1),1) <> greatest(coalesce(p_base_version,1),1) then
    return jsonb_build_object(
      'ok',true,'status','stale',
      'currentVersion',greatest(coalesce(current_project.spec_version,1),1),
      'requestedVersion',greatest(coalesce(p_base_version,1),1)
    );
  end if;

  if jsonb_typeof(coalesce(p_file_operations,'[]'::jsonb)) <> 'array'
     then raise exception 'Execution file operations must be an array'; end if;
  if jsonb_array_length(coalesce(p_file_operations,'[]'::jsonb)) > 12
     then raise exception 'Execution transaction contains too many file operations'; end if;

  current_settings := coalesce(current_project.settings,'{}'::jsonb);

  for op in select value from jsonb_array_elements(coalesce(p_file_operations,'[]'::jsonb))
  loop
    path := replace(coalesce(op->>'path',''),'\\','/');
    if path='' or length(path)>180 or path like '%..%' or path like '/%' or path ~ '^[a-zA-Z][a-zA-Z0-9+.-]*://'
      then raise exception 'Unsafe execution file path'; end if;

    select pf.content into before_content
    from public.project_files pf
    where pf.project_id=p_project_id and pf.path=path;
    before_exists := found;

    if op->>'op' = 'delete' then
      if not before_exists then raise exception 'Cannot delete missing execution file'; end if;
      normalized_op := jsonb_build_object('op','delete','path',path);
      normalized_ops := normalized_ops || jsonb_build_array(normalized_op);
      inverse_ops := jsonb_build_array(jsonb_build_object('op','write','path',path,'content',before_content)) || inverse_ops;
      changed_paths := changed_paths || jsonb_build_array(path);
      tx_count := tx_count + 1;
    elsif op->>'op' = 'write' then
      content := coalesce(op->>'content','');
      if length(content)>600000 then raise exception 'Execution file exceeds 600KB'; end if;
      total_write_bytes := total_write_bytes + length(content);
      if total_write_bytes > 4000000 then raise exception 'Execution transaction exceeds 4MB of writes'; end if;
      normalized_op := jsonb_build_object('op','write','path',path,'content',content);
      normalized_ops := normalized_ops || jsonb_build_array(normalized_op);
      if before_exists then
        inverse_ops := jsonb_build_array(jsonb_build_object('op','write','path',path,'content',before_content)) || inverse_ops;
      else
        inverse_ops := jsonb_build_array(jsonb_build_object('op','delete','path',path)) || inverse_ops;
      end if;
      changed_paths := changed_paths || jsonb_build_array(path);
      tx_count := tx_count + 1;
    else
      raise exception 'Unsupported execution file operation'; 
    end if;
  end loop;

  if tx_count > 0 then
    insert into public.project_execution_transactions(
      id,project_id,user_id,job_id,action_id,base_version,status,
      operations,inverse_operations,changed_paths,summary,created_at
    ) values (
      tx_id,p_project_id,p_user_id,p_job_id,p_action_id,
      greatest(coalesce(current_project.spec_version,1),1),'prepared',
      normalized_ops,inverse_ops,changed_paths,
      jsonb_build_object(
        'filesChanged',tx_count,
        'writeBytes',total_write_bytes,
        'createdAt',now()
      ),
      now()
    );

    for op in select value from jsonb_array_elements(normalized_ops)
    loop
      path := op->>'path';
      if op->>'op' = 'delete' then
        delete from public.project_files pf
        where pf.project_id=p_project_id and pf.path=path;
      else
        content := coalesce(op->>'content','');
        insert into public.project_files(project_id,path,content,size_bytes,mime_type,updated_at)
        values (
          p_project_id,
          path,
          content,
          length(content),
          case
            when path ~* '\\.(html?)$' then 'text/html'
            when path ~* '\\.(css)$' then 'text/css'
            when path ~* '\\.(js|mjs|ts)$' then 'text/javascript'
            when path ~* '\\.(json)$' then 'application/json'
            when path ~* '\\.(md|txt)$' then 'text/plain'
            else 'text/plain'
          end,
          now()
        )
        on conflict(project_id,path) do update
        set content=excluded.content,size_bytes=excluded.size_bytes,mime_type=excluded.mime_type,updated_at=now();
      end if;
    end loop;

    update public.project_execution_transactions
    set status='committed',committed_at=now()
    where id=tx_id;
  end if;

  current_settings := coalesce(p_settings,current_settings);
  if tx_count > 0 then
    current_settings := jsonb_set(current_settings,'{executionState,lastTransactionId}',to_jsonb(tx_id::text),true);
    current_settings := jsonb_set(
      current_settings,
      '{executionState,transactionHistory}',
      (
        coalesce(current_settings->'executionState'->'transactionHistory','[]'::jsonb)
        || jsonb_build_array(jsonb_build_object(
          'transactionId',tx_id::text,
          'actionId',p_action_id,
          'changedPaths',changed_paths,
          'summary',jsonb_build_object('filesChanged',tx_count,'writeBytes',total_write_bytes),
          'at',now()
        ))
      ),
      true
    );
    current_settings := jsonb_set(
      current_settings,
      '{executionState,transactionHistory}',
      to_jsonb(
        case
          when jsonb_array_length(current_settings->'executionState'->'transactionHistory') > 20
          then (
            select jsonb_agg(value order by ord)
            from jsonb_array_elements(current_settings->'executionState'->'transactionHistory') with ordinality as x(value,ord)
            where ord > jsonb_array_length(current_settings->'executionState'->'transactionHistory') - 20
          )
          else current_settings->'executionState'->'transactionHistory'
        end
      ),
      true
    );
  end if;

  update public.projects
  set settings=current_settings,
      updated_at=now()
  where id=p_project_id;

  insert into public.project_execution_events(
    project_id,user_id,job_id,action_id,event,status,executor,tool,message,evidence,project_version
  ) values (
    p_project_id,p_user_id,p_job_id,p_action_id,left(coalesce(p_event,'action_finished'),80),
    left(coalesce(p_status,''),40),left(coalesce(p_executor,''),100),left(coalesce(p_tool,''),100),
    left(coalesce(p_message,''),1000),coalesce(p_evidence,'[]'::jsonb),
    greatest(coalesce(current_project.spec_version,1),1)
  );

  return jsonb_build_object(
    'ok',true,
    'status','accepted',
    'projectVersion',greatest(coalesce(current_project.spec_version,1),1),
    'filesChanged',tx_count,
    'transactionId',case when tx_count>0 then tx_id::text else null end,
    'changedPaths',changed_paths
  );
end;
$$;

create or replace function public.rollback_project_execution(
  p_project_id uuid,
  p_user_id uuid,
  p_transaction_id uuid,
  p_reason text default ''
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  current_project public.projects%rowtype;
  tx public.project_execution_transactions%rowtype;
  workspace_role text;
  op jsonb;
  path text;
  current_content text;
  content text;
  current_exists boolean;
  conflict_paths jsonb := '[]'::jsonb;
  settings jsonb;
begin
  select * into current_project
  from public.projects
  where id=p_project_id
  for update;
  if not found then raise exception 'Project not found'; end if;

  if current_project.owner_id <> p_user_id then
    select role into workspace_role
    from public.workspace_members
    where workspace_id=current_project.workspace_id and user_id=p_user_id
    limit 1;
    if workspace_role is null or workspace_role not in ('owner','admin','editor') then
      raise exception 'Not authorized';
    end if;
  end if;

  select * into tx
  from public.project_execution_transactions
  where id=p_transaction_id and project_id=p_project_id
  for update;
  if not found then raise exception 'Execution transaction not found'; end if;
  if tx.status='rolled_back' then
    return jsonb_build_object('ok',true,'status','already_rolled_back','transactionId',tx.id::text,'changedPaths',tx.changed_paths);
  end if;
  if tx.status <> 'committed' then
    raise exception 'Execution transaction is not committed'; 
  end if;
  if greatest(coalesce(current_project.spec_version,1),1) <> greatest(coalesce(tx.base_version,1),1) then
    return jsonb_build_object('ok',false,'status','version_conflict','currentVersion',current_project.spec_version,'transactionVersion',tx.base_version);
  end if;

  for op in select value from jsonb_array_elements(coalesce(tx.operations,'[]'::jsonb))
  loop
    path := op->>'path';
    select pf.content into current_content
    from public.project_files pf
    where pf.project_id=p_project_id and pf.path=path;
    current_exists := found;
    if op->>'op'='write' then
      if not current_exists or coalesce(current_content,'') <> coalesce(op->>'content','')
        then conflict_paths := conflict_paths || jsonb_build_array(path); end if;
    elsif op->>'op'='delete' then
      if current_exists then conflict_paths := conflict_paths || jsonb_build_array(path); end if;
    end if;
  end loop;

  if jsonb_array_length(conflict_paths) > 0 then
    return jsonb_build_object('ok',false,'status','conflict','transactionId',tx.id::text,'conflicts',conflict_paths);
  end if;

  for op in select value from jsonb_array_elements(coalesce(tx.inverse_operations,'[]'::jsonb))
  loop
    path := op->>'path';
    if op->>'op'='delete' then
      delete from public.project_files pf where pf.project_id=p_project_id and pf.path=path;
    elsif op->>'op'='write' then
      content := coalesce(op->>'content','');
      insert into public.project_files(project_id,path,content,size_bytes,mime_type,updated_at)
      values (
        p_project_id,path,content,length(content),
        case
          when path ~* '\\.(html?)$' then 'text/html'
          when path ~* '\\.(css)$' then 'text/css'
          when path ~* '\\.(js|mjs|ts)$' then 'text/javascript'
          when path ~* '\\.(json)$' then 'application/json'
          when path ~* '\\.(md|txt)$' then 'text/plain'
          else 'text/plain'
        end,
        now()
      )
      on conflict(project_id,path) do update
      set content=excluded.content,size_bytes=excluded.size_bytes,mime_type=excluded.mime_type,updated_at=now();
    end if;
  end loop;

  settings := coalesce(current_project.settings,'{}'::jsonb);
  settings := jsonb_set(
    settings,
    '{executionState,rollbackHistory}',
    coalesce(settings->'executionState'->'rollbackHistory','[]'::jsonb)
      || jsonb_build_array(jsonb_build_object(
        'transactionId',tx.id::text,
        'actionId',tx.action_id,
        'changedPaths',tx.changed_paths,
        'reason',left(coalesce(p_reason,'User requested rollback'),500),
        'at',now()
      )),
    true
  );
  update public.projects
  set settings=settings,updated_at=now()
  where id=p_project_id;

  update public.project_execution_transactions
  set status='rolled_back',
      rollback_reason=left(coalesce(p_reason,'User requested rollback'),500),
      rolled_back_at=now()
  where id=tx.id;

  insert into public.project_execution_events(
    project_id,user_id,job_id,action_id,event,status,executor,tool,message,evidence,project_version
  ) values (
    p_project_id,p_user_id,tx.job_id,tx.action_id,'transaction_rolled_back','rolled_back',
    'projectx-orchestrator','rollback','Execution transaction rolled back safely.',
    jsonb_build_array(jsonb_build_object('transactionId',tx.id::text,'changedPaths',tx.changed_paths)),
    greatest(coalesce(current_project.spec_version,1),1)
  );

  return jsonb_build_object(
    'ok',true,'status','rolled_back','transactionId',tx.id::text,
    'changedPaths',tx.changed_paths
  );
end;
$$;

revoke all on function public.cancel_project_job(uuid,uuid) from public, anon, authenticated;
revoke all on function public.commit_project_execution(uuid,uuid,integer,uuid,text,text,text,jsonb,jsonb,text,text,text,jsonb) from public, anon, authenticated;
revoke all on function public.rollback_project_execution(uuid,uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.cancel_project_job(uuid,uuid) to service_role;
grant execute on function public.commit_project_execution(uuid,uuid,integer,uuid,text,text,text,jsonb,jsonb,text,text,text,jsonb) to service_role;
grant execute on function public.rollback_project_execution(uuid,uuid,uuid,text) to service_role;
