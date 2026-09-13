const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const jsx=(type,props)=>({type,props:props || {}});
const nodes=v=>Array.isArray(v)?v.flatMap(nodes):v&&typeof v==='object'?[v,...nodes(v.props?.children)]:[];
const text=v=>Array.isArray(v)?v.map(text).join(''):v&&typeof v==='object'?text(v.props?.children):v==null||typeof v==='boolean'?'':String(v);
function control(overrides={}){
  let props={needed:true,released:false,loading:false,viewUid:'synthetic_owner',readStartedAt:1,plan:'pro',status:'active',paid:true,paymentAttention:false,refresh:()=>refreshes++,...overrides};
  let refreshes=0,index=0,uid='synthetic_owner';const slots=[],effects=[],timers=[],calls=[],errors=[];
  let resolve,reject;const gate=new Promise((yes,no)=>{resolve=yes;reject=no;});
  const mod={exports:{}};
  const code=ts.transpileModule(fs.readFileSync('src/components/billing/ScheduledBillingReconciliation.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  new Function('require','module','exports','window',code)(name=>{
    if(name==='react/jsx-runtime')return {jsx,jsxs:jsx};
    if(name==='react')return {useState:initial=>{const slot=index++;if(!(slot in slots))slots[slot]=initial;return [slots[slot],next=>slots[slot]=next];},
      useRef:initial=>{const slot=index++;if(!(slot in slots))slots[slot]={current:initial};return slots[slot];},useEffect:fn=>effects.push(fn)};
    if(name==='firebase/functions')return {httpsCallable:(_,name)=>async payload=>{calls.push({name,payload});return gate;}};
    if(name==='@/lib/firebase/clients')return {functions:{}};
    if(name==='@/hooks/useAuth')return {useAuth:()=>({user:uid?{uid}:null})};
    if(name==='@/components/ui/button')return {Button:'Button'};
    if(name==='lucide-react')return {Loader2:'Loader2',RefreshCw:'RefreshCw'};
    if(name==='@/lib/billing/notifications')return {billingError:()=>errors.push('static error')};
    if(name==='@/lib/billing/notificationFreshness')return {markBillingReadBoundary:()=>10000};
    throw Error(name);
  },mod,mod.exports,{setTimeout:(fn,ms)=>{const t={fn,ms};timers.push(t);return t;},clearTimeout:t=>t.canceled=true,setInterval:()=>1,clearInterval(){}});
  return {calls,errors,resolve,reject,get refreshes(){return refreshes;},setProps:next=>props={...props,...next},setUid:next=>uid=next,
    render:()=>{index=0;effects.length=0;return mod.exports.default(props);},effects:()=>effects.map(fn=>fn()),
    flush:ms=>{const due=timers.splice(0).filter(t=>!t.canceled&&t.ms<=ms);due.forEach(t=>t.fn());}};
}
test('ordinary Billing Settings reconciliation mount and effect refresh never invoke a mutation',()=>{
  const f=control();f.render();f.effects();assert.deepEqual(f.calls,[]);
  f.setProps({needed:false});assert.equal(f.render(),null);f.effects();assert.deepEqual(f.calls,[]);
});
test('one explicit click sends exactly an empty callable payload and prevents same-render duplicate clicks',async()=>{
  const f=control(),button=nodes(f.render()).find(n=>n.type==='Button');assert.equal(text(button),'Refresh billing status');
  const first=button.props.onClick();await button.props.onClick();assert.deepEqual(f.calls,[{name:'reconcileScheduledBilling',payload:{}}]);
  assert.equal(nodes(f.render()).find(n=>n.type==='Button').props.disabled,true);assert.match(text(f.render()),/Updating billing status/);
  f.resolve({scheduleReleaseConfirmed:true});await first;assert.equal(f.refreshes,1);assert.match(text(f.render()),/Confirming/);
  assert.doesNotMatch(text(f.render()),/Billing status refreshed|plan changed|Welcome/);
});
test('confirmation needs a fresh released/detached authoritative view and is neutral for already-Pro cleanup',async()=>{
  const f=control(),request=nodes(f.render()).find(n=>n.type==='Button').props.onClick();f.resolve({scheduleReleaseConfirmed:true});await request;
  f.setProps({needed:false,released:true,readStartedAt:9999});f.render();f.effects();f.flush(0);assert.doesNotMatch(text(f.render()),/Billing status refreshed/);
  f.setProps({readStartedAt:10001});f.render();f.effects();f.flush(0);const page=f.render();assert.match(text(page),/Billing status refreshed/);
  assert.doesNotMatch(text(page),/Your plan changed to Pro|Welcome to Pro|plan activated/);assert.deepEqual(f.errors,[]);
});
test('successful callable POST without authoritative detachment cannot claim success',async()=>{
  const f=control(),request=nodes(f.render()).find(n=>n.type==='Button').props.onClick();f.resolve({scheduleReleaseConfirmed:false});await request;
  f.setProps({readStartedAt:10001});f.render();f.effects();f.flush(0);assert.match(text(f.render()),/Confirming/);assert.doesNotMatch(text(f.render()),/Billing status refreshed/);
});
test('delayed action offers a read-only refresh rather than another cleanup invocation',async()=>{
  const f=control(),request=nodes(f.render()).find(n=>n.type==='Button').props.onClick();f.resolve({});await request;
  f.render();f.effects();f.flush(45000);const page=f.render();assert.match(text(page),/Still confirming/);
  const button=nodes(page).find(n=>n.type==='Button');assert.equal(text(button),'Refresh status');button.props.onClick();assert.equal(f.calls.length,1);assert.equal(f.refreshes,2);
});
test('transport failure uses static error and can later confirm cleanup from authority',async()=>{
  const f=control(),request=nodes(f.render()).find(n=>n.type==='Button').props.onClick();f.reject(Error('private Stripe failure detail'));await request;
  assert.deepEqual(f.errors,['static error']);assert.doesNotMatch(text(f.render()),/private|Stripe|unchanged/);
  f.setProps({needed:false,released:true,readStartedAt:10001});f.render();f.effects();f.flush(0);assert.match(text(f.render()),/Billing status refreshed/);
});
test('payment, loading, account mismatch and conflicting billing intents block cleanup',async()=>{
  for(const state of [{paymentAttention:true},{loading:true},{paid:false},{plan:'family'},{status:'past_due'},{viewUid:'other'},{disabled:true}]){
    const f=control(state),button=nodes(f.render()).find(n=>n.type==='Button');assert.equal(button.props.disabled,true);await button.props.onClick();assert.deepEqual(f.calls,[]);
  }
  const f=control();f.setUid(null);assert.equal(f.render(),null);assert.deepEqual(f.calls,[]);
});
test('other-account or loading authoritative response cannot confirm the preceding click',async()=>{
  const f=control(),request=nodes(f.render()).find(n=>n.type==='Button').props.onClick();f.resolve({});await request;
  for(const invalid of [{loading:true},{viewUid:'other'}]){
    f.setProps({needed:false,released:true,readStartedAt:10001,...invalid});f.render();f.effects();f.flush(0);assert.doesNotMatch(text(f.render()),/Billing status refreshed/);
  }
});
