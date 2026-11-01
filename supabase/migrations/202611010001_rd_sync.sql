-- Apply only to the dedicated R&D project. No client can edit/delete history.
begin;
create table public.rd_records (
  owner_id uuid not null references auth.users(id),
  kind text not null check (kind in ('trial','evidence')),
  record_id text not null check (length(record_id) between 1 and 200),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  revision bigint generated always as identity unique,
  recorded_at timestamptz not null default now(),
  primary key (owner_id, kind, record_id),
  check (payload->>'id' = record_id)
);
alter table public.rd_records enable row level security;
create policy rd_read_own on public.rd_records for select to authenticated
  using (owner_id = (select auth.uid()));
revoke all on public.rd_records from public, anon, authenticated;
grant select on public.rd_records to authenticated;

-- One atomic append-and-read operation. Serialize per account so returned
-- revision order cannot skip a concurrently committed record for that account.
create function public.rd_sync(p_records jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid(); item jsonb; data jsonb; old_data jsonb;
  item_kind text; rid text; field text; result jsonb; added integer := 0;
begin
  if actor is null then raise exception 'rd_auth_required' using errcode='28000'; end if;
  if jsonb_typeof(p_records) is distinct from 'array' then raise exception 'rd_invalid_batch'; end if;
  if jsonb_array_length(p_records) > 5000 or octet_length(p_records::text) > 10000000 then
    raise exception 'rd_batch_too_large';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text, 0));
  if exists (select 1 from jsonb_array_elements(p_records) x
    group by x->>'kind', x->'payload'->>'id' having count(*) > 1) then
    raise exception 'rd_duplicate_batch_id';
  end if;
  for item in select value from jsonb_array_elements(p_records) loop
    item_kind := item->>'kind'; data := item->'payload'; rid := data->>'id';
    if item_kind is null or item_kind not in ('trial','evidence') or
       jsonb_typeof(data) is distinct from 'object' or
       jsonb_typeof(data->'id') is distinct from 'string' or
       rid is null or length(btrim(rid)) = 0 or length(rid) > 200 or
       jsonb_typeof(data->'menu') is distinct from 'string' or
       length(btrim(data->>'menu')) = 0 then raise exception 'rd_invalid_record'; end if;
    if item_kind = 'trial' then
      if data->>'status' is null or data->>'status' not in
        ('PLANNED','RUNNING','NEEDS_ADJUSTMENT','PASS','FAIL','HOLD','SENSORY_LOCKED','LOCKED') then
        raise exception 'rd_invalid_trial_status';
      end if;
      foreach field in array array['changed','formula'] loop
        if jsonb_typeof(data->field) is distinct from 'string' or length(btrim(data->>field)) = 0 then
          raise exception 'rd_invalid_trial';
        end if;
      end loop;
      if data->>'status' = 'LOCKED' then
        foreach field in array array['t0','t5','t10','ingredients'] loop
          if jsonb_typeof(data->field) is distinct from 'string' or length(btrim(data->>field)) = 0 then
            raise exception 'rd_lock_gate_missing';
          end if;
        end loop;
        foreach field in array array['repeatability','dilution','cupIce','costing','sop','qc'] loop
          if data->field is distinct from 'true'::jsonb then raise exception 'rd_lock_gate_missing'; end if;
        end loop;
      end if;
    else
      if data->>'type' is null or data->>'type' not in
        ('PEER_REVIEWED','OFFICIAL_GUIDE','PRODUCT_PAGE','PROFESSIONAL','YOUTUBE','LEMON8','SOCIAL','GEMINI','OTHER') or
        jsonb_typeof(data->'url') is distinct from 'string' or length(btrim(data->>'url')) = 0 then
        raise exception 'rd_invalid_evidence';
      end if;
    end if;
    select payload into old_data from public.rd_records
      where owner_id=actor and kind=item_kind and record_id=rid;
    if found then
      if old_data <> data then raise exception 'rd_conflict:%:%', item_kind, rid using errcode='P0001'; end if;
    else
      insert into public.rd_records(owner_id,kind,record_id,payload) values(actor,item_kind,rid,data);
      added := added + 1;
    end if;
  end loop;
  select jsonb_build_object('records',coalesce(jsonb_agg(jsonb_build_object(
    'kind',kind,'payload',payload,'revision',revision,'recordedAt',recorded_at) order by revision),'[]'::jsonb),
    'revision',coalesce(max(revision),0),'added',added) into result
    from public.rd_records where owner_id=actor;
  return result;
end $$;
revoke all on function public.rd_sync(jsonb) from public, anon;
grant execute on function public.rd_sync(jsonb) to authenticated;
commit;
