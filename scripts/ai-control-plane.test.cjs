const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { test } = require('node:test');
const assert = require('node:assert/strict');
function loader(mocks = {}, globals = {}) {
  const cache = new Map();
  function load(file) {
    file = path.resolve(file);
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file, module);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
    const localRequire = name => {
      if (name in mocks) return mocks[name];
      if (name === 'server-only') return {};
      if (name.startsWith('@/') || name.startsWith('.')) {
        let target = name.startsWith('@/') ? path.resolve('src', name.slice(2)) : path.resolve(path.dirname(file), name);
        if (!path.extname(target)) target = fs.existsSync(target + '.ts') ? target + '.ts' : path.join(target, 'index.ts');
        return load(target);
      }
      return require(name);
    };
    new Function('require', 'module', 'exports', ...Object.keys(globals), code)(localRequire, module, module.exports, ...Object.values(globals));
    return module.exports;
  }
  return load;
}
const load = loader();
const { defaults, compatible, modelKey } = load('src/lib/ai/registry.ts');
const { candidates, qualifyingFailure, nextCircuit } = load('src/lib/ai/router.ts');
const { cost, enforceBudget, budgetState } = load('src/lib/ai/cost-engine.ts');
const { AIError, modelSchema, budgetSchema } = load('src/lib/ai/types.ts');
const providers = ['google', 'deepseek', 'openrouter'].map(providerId => ({ providerId, enabled: true, credentialConfigured: true }));
const req = { prompt: 'Synthetic fixture', maxOutputTokens: 512, structured: true };
const config = () => structuredClone(defaults);
test('vault credentials accept verified numeric project aliases and reject foreign references', async () => {
  const calls = [];
  const name = 'projects/123456/secrets/konnectedroots-ai-openrouter/versions/7';
  const l = loader({'@/lib/firebase/admin': {adminApp: {options: {credential: {getAccessToken: async () => ({access_token: 'fixture'})}}}}}, {
    process: {env: {AI_SECRET_PROJECT_ID: 'fixture-project'}},
    fetch: async (url, options) => {
      calls.push({url, method: options.method});
      return {ok: true, json: async () => url.endsWith(':access') ? {payload: {data: Buffer.from('synthetic-key').toString('base64')}} : {name}};
    },
  });
  const secrets = l('src/lib/ai/secrets.ts');
  const provider = {providerId: 'openrouter', credentialConfigured: true, credentialSource: 'vault', secretVersion: name};
  assert.equal(await secrets.providerSecret(provider), 'synthetic-key');
  assert.equal(calls.length, 2);
  assert.ok(calls.every(c => c.url.includes('projects/fixture-project/')));
  await secrets.destroySecretVersion('openrouter', name);
  assert.ok(calls.at(-1).url.endsWith('/versions/7:destroy'));
  const before = calls.length;
  await assert.rejects(() => secrets.providerSecret({...provider, secretVersion: name.replace('openrouter', 'google')}), /secret_reference_invalid/);
  assert.equal(calls.length, before);
  await assert.rejects(() => secrets.providerSecret({...provider, secretVersion: name.replace('123456', '999999')}), /secret_reference_invalid/);
  assert.equal(calls.length, before + 1); // Metadata only; no payload access.
  await assert.rejects(() => secrets.destroySecretVersion('openrouter', name.replace('123456', '999999')), /secret_reference_invalid/);
  assert.ok(!calls.at(-1).url.endsWith(':destroy'));
  await assert.rejects(() => secrets.providerSecret({...provider, secretVersion: name.replace('/7', '/latest')}), /secret_reference_invalid/);
});
test('fixed defaults and unconfigured primary use available fallback', () => {
  assert.equal(candidates(config(), providers, 'generateBiography', req)[0].providerId, 'deepseek');
  assert.equal(candidates(config(), providers.slice(0, 1), 'generateBiography', req)[0].providerId, 'google');
});
test('capability validation separates vision, text and image editing', () => {
  const c = config();
  assert.equal(compatible('extractDocumentText', c.models[2]), false);
  assert.equal(compatible('enhancePhoto', c.models[0]), false);
  assert.equal(compatible('enhancePhoto', c.models[1]), true);
});
test('privacy blocks aggregator even as fallback', () => {
  const c = config(); const m = { ...c.models[0], providerId: 'openrouter' }; c.models.push(m);
  c.routes.generateBiography.primary = m; c.routes.generateBiography.fallbacks = [];
  assert.throws(() => candidates(c, providers, 'generateBiography', req), /no_eligible_model/);
  c.routes.generateBiography.privacy = 'aggregator_allowed';
  assert.equal(candidates(c, providers, 'generateBiography', req)[0].providerId, 'openrouter');
});
test('routing modes order by cost, quality, and price per quality point', () => {
  const c = config(); const r = c.routes.generateBiography;
  r.mode = 'lowest_cost'; assert.equal(candidates(c, providers, 'generateBiography', req)[0].providerId, 'deepseek');
  r.mode = 'quality_first'; assert.equal(candidates(c, providers, 'generateBiography', req)[0].providerId, 'google');
  r.mode = 'balanced'; assert.equal(candidates(c, providers, 'generateBiography', req)[0].providerId, 'deepseek');
});
test('disabled models, unknown prices and excessive cost are ineligible', () => {
  const c = config(); c.routes.generateBiography.fallbacks = [];
  c.models[2].enabled = false; assert.throws(() => candidates(c, providers, 'generateBiography', req));
  c.models[2].enabled = true; c.models[2].inputCostPerMillion = null; assert.throws(() => candidates(c, providers, 'generateBiography', req));
  c.models[2].inputCostPerMillion = 100000; assert.throws(() => candidates(c, providers, 'generateBiography', req));
});
test('cost includes tokens and generated image charge', () => {
  assert.equal(cost(defaults.models[0], 1000000, 1000000), 4.5);
  assert.equal(cost(defaults.models[1], 0, 0, 1), 0.067);
  assert.throws(() => cost(defaults.models[0], -1, 2), /usage_invalid/);
});
test('hard budgets include outstanding reservations and feature caps', () => {
  const c = config(); const r = c.routes.generateBiography;
  assert.throws(() => enforceBudget(c.budgets, r, 124.9, 0, 0.2), /budget_exceeded/);
  r.monthlyBudget = 1; assert.throws(() => enforceBudget(c.budgets, r, 0.9, 0.9, 0.2));
  enforceBudget(c.budgets, r, 0, 0, 0.1);
});
test('threshold policies preserve essentials and alert-only does not block', () => {
  const c = config(); const r = c.routes.generateBiography;
  assert.equal(budgetState(c.budgets, 80), 'warning');
  assert.equal(budgetState(c.budgets, 95), 'emergency');
  enforceBudget(c.budgets, r, 95, 0, 1);
  c.budgets.policy = 'disable_nonessential_ai'; assert.throws(() => enforceBudget(c.budgets, r, 95, 0, 1));
  r.essential = true; enforceBudget(c.budgets, r, 95, 0, 1);
});
test('only qualifying errors allow fallback', () => {
  for (const code of ['timeout','rate_limited','provider_5xx','provider_outage','model_unavailable']) assert.equal(qualifyingFailure(code), true);
  for (const code of ['authentication','invalid_request','content_policy','insufficient_credits','invalid_structured_output']) assert.equal(qualifyingFailure(code), false);
});
test('circuit threshold, cooldown and successful reset', () => {
  let state = nextCircuit({}, 'timeout', 2, 60, 1000); assert.equal(state.unavailableUntil, 0);
  state = nextCircuit(state, 'provider_5xx', 2, 60, 1000); assert.equal(state.unavailableUntil, 61000);
  assert.deepEqual(nextCircuit(state, null, 2, 60, 1000), { failures: 0, unavailableUntil: 0 });
});
test('configuration rejects secrets and invalid money', () => {
  assert.equal(modelSchema.safeParse({ ...defaults.models[0], apiKey: 'test-fixture' }).success, false);
  assert.equal(modelSchema.safeParse({ ...defaults.models[0], inputCostPerMillion: NaN }).success, false);
  assert.equal(budgetSchema.safeParse({ ...defaults.budgets, warningThreshold: 0.99, emergencyThreshold: 0.5 }).success, false);
});
function fakeDb() {
  const values = new Map(); let seq = 0; let queue = Promise.resolve();
  const snapshot = ref => ({ exists: values.has(ref.path), data: () => structuredClone(values.get(ref.path)) });
  function collection(name) { return { doc: (id = String(++seq)) => ({ path: name + '/' + id, id, get: async function() { return snapshot(this); } }) }; }
  const db = { collection, runTransaction: fn => {
    const pending = queue.then(async () => {
      const writes = [];
      const tx = { get: async ref => snapshot(ref), set: (ref, value, options) => writes.push([ref.path, options?.merge ? { ...values.get(ref.path), ...value } : value]), update: (ref,value) => writes.push([ref.path,{ ...values.get(ref.path), ...value }]), create: (ref, value) => writes.push([ref.path, value]) };
      const result = await fn(tx);
      for (const [key, value] of writes) values.set(key, structuredClone(value));
      return result;
    }); queue = pending.catch(() => {}); return pending;
  } };
  return { db, values };
}
test('transaction integration: concurrent requests cannot overspend hard budget', async () => {
  const { db } = fakeDb();
  const l = loader({ '@/lib/firebase/admin': { adminDb: db }, 'firebase-admin/firestore': { FieldValue: { serverTimestamp: () => 'now' } } });
  const telemetry = l('src/lib/ai/telemetry.ts'); const c = config(); c.budgets.hardBudget = 0.3;
  const results = await Promise.allSettled([1,2].map(() => telemetry.reserve(c, 'generateBiography', c.models[2], 0.2)));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
});
test('settlement integration: idempotent counters and no prompt contents', async () => {
  const { db, values } = fakeDb();
  const l = loader({ '@/lib/firebase/admin': { adminDb: db }, 'firebase-admin/firestore': { FieldValue: { serverTimestamp: () => 'now' } } });
  const t = l('src/lib/ai/telemetry.ts'); const c = config(); const r = await t.reserve(c, 'generateBiography', c.models[2], 0.2);
  const event = { providerId: 'deepseek', modelId: c.models[2].modelId, uid:'test-user', familyId:null, plan:'free', feature:'generateBiography', timestamp:new Date().toISOString(), latencyMs:50, inputTokens:10, outputTokens:20, estimatedCostUsd:0.01, success:true, fallbackUsed:false, errorCode:null, costIsReservation:false };
  await t.settle(r, event, c); await t.settle(r, event, c);
  const u = await t.readUsage(); assert.equal(u.count,1); assert.equal(u.spent,0.01); assert.equal(u.reserved,0);
  assert.equal(JSON.stringify([...values.values()]).includes('prompt'),false);
});
function gatewayHarness(failure) {
  const events = []; const called = []; let count = 0;
  const l = loader({
    '@/lib/firebase/admin': { adminDb: { collection: () => ({ doc: () => ({ get: async () => ({ data: () => ({ plan:'free' }) }) }) }) } },
    './config': { loadControl: async () => config(), loadProviders: async () => providers },
    './telemetry': { readUsage: async () => ({ spent:0,reserved:0 }), reserve: async (_c,_f,_m,amount) => ({id:String(count++),month:'test',amount}), settle: async (_r,e) => { events.push(e); } },
    './providers': { getProvider: async p => ({ generateStructured: async () => { called.push(p.providerId); if (called.length===1 && failure) throw new (l('src/lib/ai/types.ts').AIError)(failure); return { text:'{"name":"Test","reason":"fixture"}',inputTokens:12,outputTokens:15 }; } }) },
  });
  return { g:l('src/lib/ai/gateway.ts'), events, called };
}
test('gateway integration records failed and fallback attempts', async () => {
  const {g, events, called}=gatewayHarness('rate_limited');
  await g.withAIContext('u',()=>g.generate('suggestName',req));
  assert.deepEqual(called,['deepseek','google']); assert.equal(events.length,2); assert.equal(events[1].fallbackUsed,true);
  assert.equal(events[0].errorCode,'rate_limited'); assert.equal(events[1].uid,'u');
});
test('gateway rejects unauthenticated direct invocation', async () => {
  const {g,called}=gatewayHarness(); await assert.rejects(()=>g.generate('suggestName',req),/authentication/); assert.equal(called.length,0);
});
test('gateway never falls back on authentication, policy or malformed output', async () => {
  for(const error of ['authentication','content_policy','invalid_request']) {
    const {g,called}=gatewayHarness(error); await assert.rejects(()=>g.withAIContext('u',()=>g.generate('suggestName',req)),new RegExp(error)); assert.equal(called.length,1);
  }
  const {g,called}=gatewayHarness(); await assert.rejects(()=>g.withAIContext('u',()=>g.generate('suggestName',req,()=>{throw new Error('schema');})),/invalid_structured_output/); assert.equal(called.length,1);
});
test('credential fingerprint is a digest, and unprivileged mutation rejects before vault access', async () => {
  const l=loader({ '@/lib/firebase/admin': {adminApp:{},adminDb:{},adminAuth:{verifyIdToken:async()=>({uid:'u',role:'admin'})}} });
  const {fingerprint}=l('src/lib/ai/secrets.ts'); assert.match(fingerprint('synthetic-fixture'),/^[a-f0-9]{12}$/); assert.notEqual(fingerprint('synthetic-fixture'),fingerprint('different-fixture'));
  await assert.rejects(()=>l('src/app/admin/ai-configuration/actions.ts').mutateCredential('token',{providerId:'google',operation:'save',key:'synthetic-fixture'}),/Insufficient administrator role/);
});
test('relationship finder is deterministic and handler never invokes metering', async () => {
  const {findRelationship}=load('src/ai/flows/find-relationship-flow.ts');
  const p={id:'a',firstName:'Test',gender:'unknown'};assert.equal((await findRelationship({person1:p,person2:p,allPeople:[p]})).relationship,'Same Person');
  const s=fs.readFileSync('src/app/actions.ts','utf8').split('export async function handleFindRelationship')[1].split('// 4. Translate Document')[0];
  assert.equal(/verifyAuthAndDeduct|refundAI|generate\(/.test(s),false);
});
test('provider HTTP errors are sanitized without exposing response or key', async () => {
  const l=loader({}, {fetch:async()=>({ok:false,status:401,json:async()=>({error:'sensitive-fixture'})})});
  await assert.rejects(()=>l('src/lib/ai/providers/http.ts').requestJson('https://example.invalid',{}),e=>e.code==='authentication' && !e.message.includes('sensitive-fixture'));
});
test('credential mutation writes only metadata and audits, pins new version and destroys old', async () => {
  const {db,values}=fakeDb(); const destroyed=[]; const secret='synthetic-not-a-real-api-key';
  const provider={providerId:'google',enabled:true,credentialConfigured:true,credentialFingerprint:'old-digest',secretVersion:'projects/test/secrets/konnectedroots-ai-google/versions/1',credentialSource:'vault',status:'untested',lastTestedAt:null,lastSuccessfulTest:null};
  values.set('ai_providers/google',provider);
  const l=loader({
    '@/lib/firebase/admin':{adminDb:db,adminAuth:{verifyIdToken:async()=>({uid:'super',role:'super_admin'})}},
    'firebase-admin/firestore':{FieldValue:{serverTimestamp:()=> 'now',delete:()=> null}},
    '@/lib/ai/config':{loadProviders:async()=>[provider]},
    '@/lib/ai/secrets':{addSecretVersion:async(_id,value)=>{assert.equal(value,secret);return 'projects/test/secrets/konnectedroots-ai-google/versions/2';},destroySecretVersion:async(_id,value)=>destroyed.push(value),fingerprint:()=> 'new-digest'},
  });
  await l('src/app/admin/ai-configuration/actions.ts').mutateCredential('token',{providerId:'google',operation:'save',key:secret});
  assert.equal(values.get('ai_providers/google').credentialFingerprint,'new-digest');
  assert.equal(values.get('ai_providers/google').secretVersion.endsWith('/2'),true);
  assert.equal(JSON.stringify([...values.values()]).includes(secret),false);
  assert.equal(destroyed[0],provider.secretVersion);
  assert.equal([...values.keys()].filter(k=>k.startsWith('audit_logs/')).length,2);
});
test('Google adapter separates generated image price from reported total tokens', async () => {
  const l=loader({'./http':{tokens:n=>typeof n==='number'?n:null,requestJson:async()=>({candidates:[{content:{parts:[{text:'Restored'},{inlineData:{data:'synthetic',mimeType:'image/png'}}]}}],usageMetadata:{promptTokenCount:30,candidatesTokenCount:1140,thoughtsTokenCount:10,candidatesTokensDetails:[{modality:'TEXT',tokenCount:20},{modality:'IMAGE',tokenCount:1120}]}})}});
  const p=l('src/lib/ai/providers/google.ts').googleProvider('synthetic');
  const result=await p.imageEdit({...req,imageOutput:true},'test-model');
  assert.equal(result.outputTokens,1150);assert.equal(result.textOutputTokens,30);assert.equal(result.image.mimeType,'image/png');
});
test('custom endpoint only accepts server-allowlisted HTTPS origins without credentials', () => {
  const l=loader({'../secrets':{}}, {process:{env:{AI_CUSTOM_ALLOWED_ORIGINS:'https://approved.example'}}});
  const {validateCustomUrl}=l('src/lib/ai/providers/index.ts');
  assert.equal(validateCustomUrl('https://approved.example/v1'),'https://approved.example/v1');
  for(const value of ['http://approved.example/v1','https://127.0.0.1/v1','https://user:pass@approved.example/v1','https://approved.example/v1?key=bad']) assert.throws(()=>validateCustomUrl(value));
});
test('migrated structured flow strips unexpected fields and preserves output schema', async () => {
  let request;
  const l=loader({'@/lib/ai/gateway':{structured:async(feature,prompt,schema)=>{request={feature,prompt};return schema.parse({biography:'Synthetic biography'});}}});
  const result=await l('src/ai/flows/generate-biography-flow.ts').generateBiography({firstName:'Synthetic',authToken:'must-not-reach-provider'});
  assert.equal(result.biography,'Synthetic biography');assert.equal(request.feature,'generateBiography');assert.equal(request.prompt.includes('must-not-reach-provider'),false);
});
test('latest configuration and provider disablement are checked inside reservation transaction', async () => {
  const {db,values}=fakeDb(); const c=config();const current=config();current.budgets.hardBudget=0.1;
  values.set('ai_configuration/control',current);
  const l=loader({'@/lib/firebase/admin':{adminDb:db},'firebase-admin/firestore':{FieldValue:{serverTimestamp:()=> 'now'}}});
  const t=l('src/lib/ai/telemetry.ts');await assert.rejects(()=>t.reserve(c,'generateBiography',c.models[2],0.2),/budget_exceeded/);
  values.delete('ai_configuration/control');values.set('ai_providers/deepseek',{enabled:false,credentialConfigured:true});
  await assert.rejects(()=>t.reserve(c,'generateBiography',c.models[2],0.2),/configuration_changed/);
});
test('ordinary users cannot read private AI configuration through server action', async () => {
  const l=loader({'@/lib/firebase/admin':{adminAuth:{verifyIdToken:async()=>({uid:'normal',role:'user'})},adminDb:{}}});
  await assert.rejects(()=>l('src/app/admin/ai-configuration/actions.ts').getAIConfiguration('token'),/Insufficient administrator role/);
});
test('invalid provider JSON is not reclassified as an outage', async () => {
  const l=loader({}, {fetch:async()=>({ok:true,json:async()=>{throw new Error('private invalid response');}})});
  await assert.rejects(()=>l('src/lib/ai/providers/http.ts').requestJson('https://example.invalid',{}),e=>e.code==='invalid_response');
});
