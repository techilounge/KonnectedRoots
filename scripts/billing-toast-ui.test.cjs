const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const jsx=(type,props)=>({type,props:props || {}});
const nodes=value=>Array.isArray(value)?value.flatMap(nodes):value&&typeof value==='object'?[value,...nodes(value.props?.children)]:[];
function component(file,mocks){
  const mod={exports:{}};
  const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  new Function('require','module','exports',code)(name=>name==='react/jsx-runtime'?{jsx,jsxs:jsx}:mocks[name] || require(name),mod,mod.exports);
  return mod.exports;
}
const ui=new Proxy({}, {get:(_,key)=>key});
test('actual Toaster renders success and error icons, text, polite/foreground types and dismissal',()=>{
  const toasts=[{id:'success',variant:'success',type:'background',title:'Welcome to Pro',description:'Your Pro plan is now active.'},
    {id:'error',variant:'destructive',type:'foreground',title:'Billing update could not be confirmed',description:'Refresh your billing status or try again.'}];
  const {Toaster}=component('src/components/ui/toaster.tsx',{'@/hooks/use-toast':{useToast:()=>({toasts})},'@/components/ui/toast':ui,'lucide-react':ui});
  const tree=Toaster(),all=nodes(tree);
  assert.equal(tree.props.duration,6000);assert.equal(tree.props.label,'Notifications');
  assert.deepEqual(all.filter(n=>n.type==='Toast').map(n=>n.props.type),['background','foreground']);
  assert.equal(all.find(n=>n.type==='CheckCircle2').props['aria-hidden'],'true');
  assert.equal(all.find(n=>n.type==='AlertCircle').props['aria-hidden'],'true');
  assert.equal(all.filter(n=>n.type==='ToastClose').length,2);
  assert.match(all.find(n=>n.type==='ToastTitle').props.className,/text-green-800 dark:text-green-300/);
  assert.equal(all.find(n=>n.type==='ToastDescription').props.children,toasts[0].description);
});
test('actual Toast wrappers retain neutral surfaces, reduced motion, mobile bounds and visible keyboard dismissal',()=>{
  const radix=new Proxy({}, {get:(_,key)=>{const primitive=String(key);return primitive;}});
  const toast=component('src/components/ui/toast.tsx',{'react':{forwardRef:fn=>props=>fn(props,null)},'@radix-ui/react-toast':radix,
    'lucide-react':ui,'@/lib/utils':{cn:(...args)=>args.filter(Boolean).join(' ')}});
  const success=toast.Toast({variant:'success',type:'background'}),error=toast.Toast({variant:'destructive'});
  for(const t of [success,error]){assert.match(t.props.className,/bg-background text-foreground/);assert.match(t.props.className,/motion-reduce:animate-none/);}
  assert.doesNotMatch(success.props.className,/bg-green/);assert.doesNotMatch(error.props.className,/bg-destructive/);
  const close=toast.ToastClose({});assert.equal(close.props['aria-label'],'Dismiss notification');
  assert.match(close.props.className,/focus:ring-2/);assert.doesNotMatch(close.props.className,/opacity-0/);
  const viewport=toast.ToastViewport({});assert.match(viewport.props.className,/bottom-0/);assert.match(viewport.props.className,/max-h-\[50vh\]/);
  assert.match(viewport.props.className,/pointer-events-none/);assert.match(success.props.className,/pointer-events-auto/);
  assert.match(viewport.props.className,/overflow-y-auto/);assert.match(viewport.props.className,/safe-area-inset-bottom/);
});
test('success and error title accents meet WCAG AA contrast on actual light/dark backgrounds',()=>{
  const css=fs.readFileSync('src/app/globals.css','utf8');
  const blocks=[css.split(':root {')[1].split('}')[0],css.split('.dark {')[1].split('}')[0]];
  const hsl=(h,s,l)=>{s/=100;l/=100;const a=s*Math.min(l,1-l);return [0,8,4].map(n=>{const k=(n+h/30)%12;return l-a*Math.max(-1,Math.min(k-3,9-k,1));});};
  const luminance=rgb=>rgb.map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((total,v,i)=>total+v*[.2126,.7152,.0722][i],0);
  const hex=color=>color.match(/\w\w/g).map(v=>parseInt(v,16)/255);
  for(const [i,block] of blocks.entries()){
    const values=block.match(/--background:\s*([\d.]+) ([\d.]+)% ([\d.]+)%/).slice(1).map(Number);
    const background=luminance(hsl(...values));
    for(const color of (i===0?['166534','991b1b']:['86efac','fca5a5'])){
      const foreground=luminance(hex(color));const ratio=(Math.max(background,foreground)+.05)/(Math.min(background,foreground)+.05);
      assert.ok(ratio>=4.5,`${color} theme ${i} contrast ${ratio}`);
    }
  }
});
test('delayed feedback offers only a safe status refresh with accessible text',()=>{
  let refreshed=0;
  const progress={uid:'synthetic_owner',phase:'delayed'};
  const {default:Feedback}=component('src/components/billing/BillingActionFeedback.tsx',{
    react:{useSyncExternalStore:(_subscribe,snapshot)=>snapshot()},'@/hooks/useAuth':{useAuth:()=>({user:{uid:'synthetic_owner'}})},
    '@/components/ui/button':ui,'lucide-react':ui,'@/lib/billing/notifications':{getBillingProgress:()=>progress,getServerBillingProgress:()=>null,subscribeToBillingFeedback(){}}});
  const tree=Feedback({refresh:()=>refreshed++});assert.equal(tree.props.role,'status');assert.equal(tree.props['aria-live'],'polite');
  const button=nodes(tree).find(n=>n.type==='Button');assert.equal(button.props.children,'Refresh status');button.props.onClick();assert.equal(refreshed,1);
  assert.match(JSON.stringify(tree),/Still confirming/);assert.doesNotMatch(JSON.stringify(tree),/success|failed|unchanged/i);
});
test('global observer rejects loading/error/account-mismatched views and confirms only a new authoritative read',()=>{
  const module={exports:{}};
  const trackerCode=ts.transpileModule(fs.readFileSync('src/lib/billing/notificationTracker.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
  new Function('require','module','exports',trackerCode)(require,module,module.exports);
  let time=100_000,refreshed=0;
  const notices=[],effects=[];
  const tracker=module.exports.createBillingNotificationTracker({emit:n=>notices.push(n),now:()=>time});
  let view={plan:'free',canonicalStatus:'none',effectivePaidEntitlement:false,paymentAttentionRequired:false,aiPackEntitlementValid:false,
    aiPackItemExists:false,aiPackCancelAtPeriodEnd:false,aiPackPaidThrough:null,aiPackRemovalPending:false,aiPackResumePending:false,planChangeStatus:'none',
    scheduledDowngrade:null,billingScheduleCleanupRequired:false,billingScheduleReleaseConfirmed:false,billingViewUid:'synthetic_owner',billingReadStartedAt:time,
    loading:false,error:null,entitlements:{},refresh:()=>refreshed++};
  const {default:Observer}=component('src/components/billing/BillingNotifications.tsx',{
    react:{useEffect:fn=>effects.push(fn)},'next/navigation':{usePathname:()=>'/settings/billing'},
    '@/hooks/useAuth':{useAuth:()=>({user:{uid:'synthetic_owner'},loading:false})},'@/hooks/useEntitlements':{useEntitlements:()=>view},
    '@/lib/billing/notifications':{billingNotifications:()=>tracker},'./BillingActionFeedback':{useBillingProgress:()=>tracker.getProgress()}});
  const originalWindow=global.window;
  global.window={location:{search:''},setTimeout:()=>1,setInterval:()=>2,clearTimeout(){},clearInterval(){}};
  const render=()=>{effects.length=0;Observer();const cleanups=effects.map(effect=>effect());cleanups.forEach(cleanup=>cleanup?.());};
  try{
    render();const id=tracker.begin('synthetic_owner','pro_checkout');time++;tracker.accepted(id);
    view={...view,plan:'pro',canonicalStatus:'active',effectivePaidEntitlement:true};render();assert.deepEqual(notices,[]);assert.ok(refreshed>0);
    for(const invalid of [{loading:true},{error:new Error('synthetic')},{entitlements:null},{billingViewUid:'different_owner'}]){
      const valid=view;view={...view,billingReadStartedAt:time,...invalid};render();assert.deepEqual(notices,[]);view=valid;
    }
    view={...view,billingReadStartedAt:time};render();render();assert.deepEqual(notices.map(n=>n.title),['Welcome to Pro']);
  }finally{global.window=originalWindow;}
});
test('actual session adapter restores a checkout intent even before its observer baseline exists',()=>{
  const originalWindow=global.window;
  const saved={uid:'synthetic_owner',last:null,pending:{id:'synthetic-intent',uid:'synthetic_owner',action:'pro_checkout',phase:'confirming',startedAt:Date.now(),acceptedAt:Date.now(),remaining:['pro_checkout']},deferredPro:false,savedAt:Date.now()};
  const storage=new Map([['konnectedroots.billing-feedback.v1',JSON.stringify(saved)]]),toasts=[];
  global.window={sessionStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)}};
  const trackerModule=component('src/lib/billing/notificationTracker.ts',{});
  try{
    const {billingNotifications}=component('src/lib/billing/notifications.ts',{'@/hooks/use-toast':{toast:n=>toasts.push(n)},
      './notificationTracker':trackerModule,'./notificationFreshness':{markBillingReadBoundary:()=>Date.now()}});
    const tracker=billingNotifications();assert.equal(tracker.getProgress().id,'synthetic-intent');
    tracker.observe('synthetic_owner',{plan:'pro',canonicalStatus:'active',effectivePaidEntitlement:true,paymentAttentionRequired:false},Date.now());
    assert.deepEqual(toasts.map(n=>n.title),['Welcome to Pro']);assert.equal(toasts[0].type,'background');assert.equal(toasts[0].duration,6000);
    tracker.reset();assert.equal(storage.size,0);
  }finally{global.window=originalWindow;}
});
