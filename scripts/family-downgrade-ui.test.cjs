const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function controls(overrides = {}) {
  let props={scheduled:null,periodEnd:2_000_000_000_000,interval:'month',hasAIPack:true,disabled:false,refresh:()=>refreshes++,...overrides};
  let refreshes=0,index=0;const states=[],calls=[];
  const jsx=(type,props)=>({type,props:props || {}});
  let resolve;const gate=new Promise(r=>resolve=r);
  const code=ts.transpileModule(fs.readFileSync('src/components/billing/FamilyDowngradeControls.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const mod={exports:{}};
  new Function('require','module','exports',code)(name=>{
    if(name==='react')return {useState:initial=>{const slot=index++;if(!(slot in states))states[slot]=initial;return [states[slot],next=>states[slot]=next];}};
    if(name==='react/jsx-runtime')return {jsx,jsxs:jsx};
    if(name==='@/lib/firebase/clients')return {functions:{}};
    if(name==='@/hooks/useAuth')return {useAuth:()=>({user:{uid:'synthetic_owner'}})};
    if(name==='./BillingActionFeedback')return {useBillingProgress:()=>null};
    if(name==='@/lib/billing/notifications')return {billingRequestRejected:()=>false,billingNotifications:()=>({begin:()=> 'synthetic-operation',accepted(){},failed(){}})};
    if(name==='firebase/functions')return {httpsCallable:(_,name)=>async payload=>{calls.push({name,payload});await gate;return {data:{success:true}};}};
    if(name.startsWith('@/components/ui/'))return new Proxy({}, {get:(_,key)=>key});
    throw Error(name);
  },mod,mod.exports);
  return {calls,done:resolve,render:()=>{index=0;return mod.exports.default(props);},setProps:next=>props={...props,...next},get refreshes(){return refreshes;}};
}
const nodes=value=>Array.isArray(value)?value.flatMap(nodes):value&&typeof value==='object'?[value,...nodes(value.props?.children)]:[];
const text=value=>Array.isArray(value)?value.map(text).join(''):value&&typeof value==='object'?text(value.props?.children):value==null||typeof value==='boolean'?'':String(value);
const scheduled={scheduledPlan:'pro',scheduledInterval:'month',scheduledChangeAt:2_000_000_000_000,scheduledChangeStatus:'scheduled',scheduledChangeType:'downgrade'};

test('Family downgrade requires confirmation and sends only logical Pro selection',async()=>{
  const f=controls();let page=f.render();assert.equal(f.calls.length,0);
  assert.match(text(page),/Family remains fully active until/);assert.match(text(page),/no immediate refund, proration credit or charge/);
  assert.match(text(page),/membership and genealogy data are preserved/);assert.match(text(page),/paid-seat access ends/);assert.match(text(page),/valid AI Pack access is preserved/);
  const promise=nodes(page).find(n=>n.type==='AlertDialogAction').props.onClick();
  assert.deepEqual(f.calls,[{name:'scheduleDowngradeToPro',payload:{plan:'pro'}}]);
  assert.match(text(f.render()),/Scheduling…/);f.done();await promise;assert.equal(f.refreshes,1);
});
test('authoritative schedule and cancellation update controls on rerender',async()=>{
  const f=controls();f.setProps({scheduled});let page=f.render();assert.match(text(page),/Scheduled: Downgrades to Pro on/);assert.match(text(page),/Keep Family Plan/);
  const promise=nodes(page).find(n=>n.type==='AlertDialogAction').props.onClick();assert.match(text(f.render()),/Canceling…/);
  assert.deepEqual(f.calls,[{name:'cancelScheduledDowngrade',payload:{}}]);f.done();await promise;
  f.setProps({scheduled:null});assert.doesNotMatch(text(f.render()),/Scheduled:|Keep Family Plan/);
});
test('loading/payment-attention restrictions cannot invoke downgrade or cancellation',async()=>{
  for(const state of [null,scheduled]){const f=controls({scheduled:state,disabled:true});const action=nodes(f.render()).find(n=>n.type==='AlertDialogAction');
    assert.equal(action.props.disabled,true);await action.props.onClick();assert.deepEqual(f.calls,[]);}
});
test('yearly downgrade confirms same interval and has no pending Pack grant promise',()=>{
  const f=controls({interval:'year',hasAIPack:false});assert.match(text(f.render()),/same yearly billing interval/);assert.match(text(f.render()),/Pending or failed AI Pack purchases do not grant access/);
});
