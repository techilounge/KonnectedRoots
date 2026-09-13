const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const path=require('node:path');
const env={NODE_ENV:'test',GCLOUD_PROJECT:'demo-konnectedroots-phase2',FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9099',FIRESTORE_EMULATOR_HOST:'127.0.0.1:8080',STRIPE_SECRET_KEY:'sk_test_fixture'};
function load(overrides={},customerOverride={},clockOverride={}){
  const calls=[],mod={exports:{}};
  const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/lib/billing/evaluationTime.server.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021}}).outputText;
  new Function('require','module','exports','process','fetch',code)(r=>r==='server-only'?{}:require(r),mod,mod.exports,{...process,env:{...env,...overrides}},async(url,options)=>{
    calls.push({url,method:options.method,cache:options.cache});assert.equal(options.method,'GET');
    return {ok:true,json:async()=>url.includes('/customers/')?{id:'cus_test',livemode:false,test_clock:'clock_test',metadata:{kr_uid:'owner',kr_test_scenario:'phase2_family_downgrade'},...customerOverride}:{id:'clock_test',livemode:false,frozen_time:1791818571,...clockOverride}};
  });return {...mod.exports,calls};
}
test('server billing view clock adapter reads only owned customer/clock, no writes or public configuration',async()=>{
  const f=load();assert.equal(await f.billingEvaluationTime({stripeCustomerId:'cus_test'},'owner'),1791818571000);assert.equal(f.calls.length,2);assert.equal(f.calls.every(c=>c.method==='GET' && c.cache==='no-store'),true);
});
for(const override of [{NODE_ENV:'production'},{VERCEL:'1'},{VERCEL_ENV:'preview'},{GCLOUD_PROJECT:'prod_fixture'},{FIREBASE_AUTH_EMULATOR_HOST:'remote:9099'},{FIRESTORE_EMULATOR_HOST:'remote:8080'}])test(`server clock cannot activate outside exact local scope: ${Object.keys(override)[0]}`,async()=>{
  const f=load(override),before=Date.now();assert.ok(await f.billingEvaluationTime({stripeCustomerId:'cus_test'},'owner')>=before);assert.equal(f.calls.length,0);
});
for(const change of [{livemode:true},{deleted:true},{id:'cus_other'},{metadata:{kr_uid:'other'}},{metadata:{kr_uid:'owner',kr_test_scenario:'unknown'}}])test(`unverified clock customer fails rather than falling back to overgranting wall time: ${Object.keys(change)[0]}`,async()=>{
  await assert.rejects(load({},change).billingEvaluationTime({stripeCustomerId:'cus_test'},'owner'));
});
test('invalid live/foreign clock fails safely',async()=>{
  for(const clock of [{id:'clock_other'},{livemode:true},{frozen_time:0}])await assert.rejects(load({}, {},clock).billingEvaluationTime({stripeCustomerId:'cus_test'},'owner'));
});
