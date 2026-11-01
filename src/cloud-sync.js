import {mergeImmutableRecords, trialValidationErrors, SOURCE_TYPES} from './rd-core.js';

export const LOCAL_TRIAL_KEY = 'field-rd-trials-v3';
export const LOCAL_SOURCE_KEY = 'field-rd-research-v1';
export const CLOUD_CACHE_KEY = 'field-rd-cloud-cache-v1';
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])])) : value;
const same = (a,b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const statuses = new Set(['PLANNED','RUNNING','NEEDS_ADJUSTMENT','PASS','FAIL','HOLD','SENSORY_LOCKED','LOCKED']);
export const withCloudLock = action => typeof window !== 'undefined' && globalThis.navigator?.locks
  ? navigator.locks.request('field-rd-cloud-cache',action) : Promise.resolve().then(action);

export function validateCollections({trials,sources}) {
  if (!Array.isArray(trials) || !Array.isArray(sources)) throw new Error('rd_invalid_collections');
  mergeImmutableRecords([],trials); mergeImmutableRecords([],sources);
  for (const t of trials) {
    if (!statuses.has(t.status) || trialValidationErrors(t).length || t.id.length > 200 ||
      (t.status === 'LOCKED' && ['repeatability','dilution','cupIce','costing','sop','qc'].some(k=>t[k]!==true))) throw new Error('rd_invalid_trial');
  }
  for (const s of sources) {
    if (typeof s.menu !== 'string' || !s.menu.trim() || !Object.hasOwn(SOURCE_TYPES,s.type) || typeof s.url !== 'string' || !s.url.trim() || s.id.length > 200) throw new Error('rd_invalid_evidence');
  }
}

// A single envelope is the authoritative cloud cache. Never reuse a cache/outbox
// for another account or project, even after signing out on a shared device.
export function readCloudCache(storage, owner) {
  const raw = storage.getItem(CLOUD_CACHE_KEY);
  if (raw === null) return null;
  const cache = JSON.parse(raw);
  if (!cache || cache.version !== 1 || typeof cache.owner !== 'string' || !Array.isArray(cache.pending) || !Number.isSafeInteger(cache.revision) || cache.revision < 0) throw new Error('rd_corrupt_cloud_cache');
  if (cache.owner !== owner) throw new Error('rd_other_account_cache');
  validateCollections(cache);
  for (const batch of cache.pending) {
    if (!batch || typeof batch.id !== 'string') throw new Error('rd_corrupt_outbox');
    validateCollections(batch);
  }
  return cache;
}
export function writeCloudCache(storage, cache) {
  const raw = JSON.stringify(cache);
  storage.setItem(CLOUD_CACHE_KEY, raw);
  if (storage.getItem(CLOUD_CACHE_KEY) !== raw) throw new Error('rd_storage_verify_failed');
  return cache;
}
export function newCloudCache(owner) {
  return {version:1,owner,trials:[],sources:[],pending:[],revision:0,lastSync:null};
}
export function queueCloudRecords(storage, cache, incoming, id = globalThis.crypto.randomUUID()) {
  validateCollections(incoming);
  const trials = mergeImmutableRecords(cache.trials,incoming.trials,'Trial');
  const sources = mergeImmutableRecords(cache.sources,incoming.sources,'Evidence');
  const newTrials = incoming.trials.filter(t => !cache.trials.some(x => x.id === t.id));
  const newSources = incoming.sources.filter(t => !cache.sources.some(x => x.id === t.id));
  if (!newTrials.length && !newSources.length) return cache;
  // Queue and visible history commit together in one durable write.
  return writeCloudCache(storage,{...cache,trials:trials.records,sources:sources.records,
    pending:[...cache.pending,{id,trials:newTrials,sources:newSources}]});
}
export function parseRemote(result) {
  if (!result || !Array.isArray(result.records) || !Number.isSafeInteger(result.revision) || result.revision < 0) throw new Error('rd_invalid_remote');
  const data = {trials:[],sources:[]};
  const revisions = new Set();
  for (const r of result.records) {
    if (!r || !['trial','evidence'].includes(r.kind) || !Number.isSafeInteger(r.revision) || r.revision <= 0 || r.revision > result.revision || revisions.has(r.revision)) throw new Error('rd_invalid_remote');
    revisions.add(r.revision);
    data[r.kind === 'trial' ? 'trials' : 'sources'].push(r.payload);
  }
  validateCollections(data);
  return data;
}

// A migration plan is read-only: no queue, timestamps, backups or storage writes.
// Immutable identities must agree before an operator can approve an upload.
export function planDeviceImport(device, cloud) {
  validateCollections(device); validateCollections(cloud);
  const plan={trials:{added:0,unchanged:0},sources:{added:0,unchanged:0},conflicts:[],incoming:{trials:[],sources:[]}};
  for (const kind of ['trials','sources']) {
    const known=new Map(cloud[kind].map(row=>[row.id,row]));
    for (const row of device[kind]) {
      const server=known.get(row.id);
      if (!server) {plan[kind].added++;plan.incoming[kind].push(row);}
      else if(same(row,server))plan[kind].unchanged++;
      else plan.conflicts.push({kind,id:row.id,device:row,cloud:server,
        fields:[...new Set([...Object.keys(row),...Object.keys(server)])].filter(k=>!same(row[k],server[k]))});
    }
  }
  plan.canImport=plan.conflicts.length===0 && plan.trials.added+plan.sources.added>0;
  return plan;
}

export async function syncCloud({storage,owner,remote}) {
  const before = readCloudCache(storage,owner);
  if (!before) throw new Error('rd_cloud_not_initialized');
  const sent = before.pending.flatMap(b => [
    ...b.trials.map(payload => ({kind:'trial',payload})),
    ...b.sources.map(payload => ({kind:'evidence',payload}))]);
  // Keep the exact pending content until a verified reply AND local commit.
  const result = await remote(sent);
  const incoming = parseRemote(result);
  for (const r of sent) {
    const rows = r.kind === 'trial' ? incoming.trials : incoming.sources;
    if (!rows.some(x => x.id === r.payload.id && same(x,r.payload))) throw new Error('rd_unacknowledged_record');
  }
  return withCloudLock(()=>{
  const current = readCloudCache(storage,owner);
  if (!current || current.revision > result.revision) throw new Error('rd_stale_sync');
  // Reread local state after await: records saved during sync must survive.
  const trials = mergeImmutableRecords(current.trials,incoming.trials,'Trial').records;
  const sources = mergeImmutableRecords(current.sources,incoming.sources,'Evidence').records;
  // A full server response must contain every previously acknowledged record.
  const pendingIds = new Set(current.pending.flatMap(b => [...b.trials.map(t=>'trial:'+t.id),...b.sources.map(s=>'evidence:'+s.id)]));
  for (const [kind,rows,received] of [['trial',current.trials,incoming.trials],['evidence',current.sources,incoming.sources]]) {
    for (const row of rows) if (!pendingIds.has(kind+':'+row.id) && !received.some(x => x.id === row.id)) throw new Error('rd_remote_history_missing');
  }
  const sentIds = new Set(before.pending.map(b => b.id));
  const cache = {...current,trials,sources,pending:current.pending.filter(b => !sentIds.has(b.id)),revision:result.revision,lastSync:new Date().toISOString()};
  storage.setItem('field-rd-precloud-'+Date.now(),JSON.stringify(current));
  return writeCloudCache(storage,cache);
  });
}
