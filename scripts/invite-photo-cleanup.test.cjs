const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const jsx = (type, props) => ({type, props: props || {}});
const ui = new Proxy({}, {get: (_, name) => name});
function load(file, mocks = {}) {
  const mod = {exports: {}};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  }}).outputText;
  new Function('require', 'module', 'exports', code)(name => {
    if (name === 'react/jsx-runtime') return {jsx, jsxs: jsx};
    if (name in mocks) return mocks[name];
    if (name.startsWith('@/components/')) return new Proxy({}, {get: (_, key) => key === '__esModule' ? true : key === 'default' ? name : key});
    if (name === 'lucide-react') return ui;
    return require(name);
  }, mod, mod.exports);
  return mod.exports;
}
const redirect = load('src/lib/auth/redirect.ts');
const invitation = load('src/lib/auth/invitation.ts', {'./redirect': redirect});
const ownership = load('src/lib/photos/ownership.ts');
const save = load('src/lib/photos/save.ts');
const nodes = value => Array.isArray(value) ? value.flatMap(nodes) : value && typeof value === 'object' ? [value, ...nodes(value.props?.children)] : [];
const text = value => Array.isArray(value) ? value.map(text).join('') : value && typeof value === 'object' ? text(value.props?.children) : value == null || typeof value === 'boolean' ? '' : String(value);
const find = (tree, type, label) => nodes(tree).find(n => n.type === type && text(n).trim() === label);
function runtime() {
  const states = [], effects = [], refs = []; let cursor = 0, queued = [];
  const react = {
    use: value => value,
    useState(initial) { const i = cursor++; if (!(i in states)) states[i] = initial; return [states[i], v => {states[i] = typeof v === 'function' ? v(states[i]) : v;}]; },
    useRef(initial) { const i = cursor++; return refs[i] ||= {current: initial}; },
    useEffect(fn, deps) { const i = cursor++; if (!effects[i] || !deps || deps.some((v, j) => v !== effects[i].deps[j])) queued.push(() => {effects[i]?.cleanup?.(); effects[i] = {deps, cleanup: fn()};}); },
    useCallback: fn => fn,
    createContext: () => ({Provider: 'Provider'}), useContext: () => null,
  };
  return {react, render(fn) {cursor = 0; const tree = fn(); const q = queued; queued = []; q.forEach(f => f()); return tree;}, dispose() {effects.forEach(e => e?.cleanup?.());}};
}
for (const route of ['/', '/dashboard', '/profile', '/invite/abc', '/tree/demo', '/settings/billing']) test(`redirect permits local ${route}`, () => assert.equal(redirect.sanitizeAuthRedirect(route), route));
for (const route of [undefined, '', 'https://evil.example', '//evil.example', '\\\\evil.example', 'javascript:alert(1)', 'data:text/html,evil', '%2F%2Fevil.example', '/%2fevil.example', '/%252fevil.example', '/%25252fevil.example', '/\\evil', '/%5cevil', '/%255cevil', '/\nevil', '/%0aevil', '/%250devil', '/\tevil', '/%zz', '/a/..//evil.example', '/%25252525252fevil']) test(`redirect rejects ${JSON.stringify(route)}`, () => assert.equal(redirect.sanitizeAuthRedirect(route), '/dashboard'));
test('Login and Sign Up links retain the same validated invitation and default safely', () => {
  for (const route of ['/login', '/signup']) {
    assert.equal(new URL(redirect.authContinuation(route, '/invite/abc'), 'https://local.invalid').searchParams.get('redirect'), '/invite/abc');
    assert.equal(new URL(redirect.authContinuation(route, '//evil'), 'https://local.invalid').searchParams.get('redirect'), '/dashboard');
  }
});
const invited = {id: 'abc', treeId: 'demo', treeName: 'Synthetic Tree', inviterName: 'QA Owner', inviteeEmail: 'invited@example.test', role: 'editor', status: 'pending', inviteeUid: 'invitee'};
function inviteUI(initialUser, initialInvite = invited) {
  const hooks = runtime(), routes = [], calls = []; let user = initialUser, callback;
  const page = load('src/app/invite/[inviteId]/page.tsx', {
    react: hooks.react, 'next/navigation': {useRouter: () => ({push: route => routes.push(route)})},
    '@/lib/firebase/clients': {db: {}, functions: {}}, 'firebase/firestore': {doc: (...args) => args, onSnapshot: (_, cb) => {callback = cb; return () => {};}, deleteDoc: async () => calls.push('decline')},
    'firebase/functions': {httpsCallable: (_, name) => async payload => calls.push([name, payload])},
    '@/hooks/useAuth': {useAuth: () => ({user, loading: false, logout: async route => {calls.push(['logout', route]); user = null; routes.push(route);}})},
    '@/lib/auth/invitation': invitation, 'next/link': {default: 'Link', __esModule: true},
  }).default;
  const render = () => hooks.render(() => page({params: {inviteId: 'abc'}}));
  render(); callback({exists: () => true, id: initialInvite.id, data: () => initialInvite});
  return {render, calls, routes, setUser: next => {user = next;}};
}
test('signed out existing invitee sees actual summary and Sign In continuation', () => {
  const f = inviteUI(null), tree = f.render();
  for (const label of ['Synthetic Tree', 'QA Owner', 'editor']) assert.ok(text(tree).includes(label));
  const link = find(tree, 'Link', 'Sign In to Accept');
  assert.equal(new URL(link.props.href, 'https://local.invalid').pathname, '/login');
  assert.equal(new URL(link.props.href, 'https://local.invalid').searchParams.get('redirect'), '/invite/abc');
});
test('brand-new invitee sees Create Account rather than a login dead end', () => {
  const f = inviteUI(null, {...invited, inviteeUid: null}), tree = f.render();
  const link = find(tree, 'Link', 'Create Account to Accept');
  assert.equal(new URL(link.props.href, 'https://local.invalid').pathname, '/signup');
  assert.match(text(tree), /Create an account to join this family tree/);
  assert.equal(find(tree, 'Link', 'Sign In to Accept'), undefined);
});
for (const role of ['viewer', 'editor', 'manager']) test(`correct signed-in ${role} explicitly accepts through callable and routes to tree`, async () => {
  const f = inviteUI({email: 'INVITED@example.test'}, {...invited, role}); const tree = f.render();
  assert.ok(find(tree, 'Button', 'Decline')); await find(tree, 'Button', 'Accept').props.onClick();
  assert.deepEqual(f.calls, [['acceptInvitation', {invitationId: 'abc'}]]); assert.deepEqual(f.routes, ['/tree/demo']);
});
for (const linked of [null, 'invitee']) test(`wrong account has no Accept/Decline; confirmed signout resumes scoped flow (linked=${linked})`, async () => {
  const f = inviteUI({email: 'wrong@example.test'}, {...invited, inviteeUid: linked}); const tree = f.render();
  assert.match(text(tree), /invited@example.test/); assert.match(text(tree), /wrong@example.test/);
  assert.equal(find(tree, 'Button', 'Accept'), undefined); assert.equal(find(tree, 'Button', 'Decline'), undefined); assert.deepEqual(f.calls, []);
  await find(tree, 'Button', 'Sign Out & Continue').props.onClick(); assert.deepEqual(f.calls, []);
  const dialog = nodes(f.render()).find(n => n.type === 'AlertDialog'); assert.equal(dialog.props.open, true);
  await find(dialog, 'AlertDialogAction', 'Sign Out & Continue').props.onClick();
  assert.deepEqual(f.routes, ['/invite/abc']); assert.deepEqual(f.calls, [['logout', '/invite/abc']]);
  assert.ok(find(f.render(), 'Link', linked ? 'Sign In to Accept' : 'Create Account to Accept'));
});
test('new matching account can accept a still-unlinked pending invitation without resend or automatic acceptance', async () => {
  const f = inviteUI(null, {...invited, inviteeUid: null}); f.render(); f.setUser({email: invited.inviteeEmail});
  const tree = f.render(); assert.deepEqual(f.calls, []); assert.ok(find(tree, 'Button', 'Accept'));
  await find(tree, 'Button', 'Accept').props.onClick(); assert.equal(f.calls[0][0], 'acceptInvitation');
});
test('correct account decline uses confirmation then deletion', async () => {
  const f = inviteUI({email: invited.inviteeEmail}); let tree = f.render();
  find(tree, 'Button', 'Decline').props.onClick(); assert.deepEqual(f.calls, []);
  tree = f.render(); await find(tree, 'AlertDialogAction', 'Decline Invitation').props.onClick();
  assert.deepEqual(f.calls, ['decline']); assert.deepEqual(f.routes, ['/dashboard']);
});
function authFixture() {
  const hooks = runtime(), calls = [], routes = [], docs = new Map(); let observe;
  const auth = {currentUser: null};
  const account = (email = invited.inviteeEmail) => ({uid: 'invitee', email, displayName: 'QA', photoURL: null});
  const firebaseAuth = {
    getAuth: () => auth, onAuthStateChanged: (_, callback) => {observe = callback; return () => {};},
    signInWithEmailAndPassword: async (_, email) => {auth.currentUser = account(email); calls.push('login'); return {user: auth.currentUser};},
    createUserWithEmailAndPassword: async (_, email) => {auth.currentUser = account(email); calls.push('signup'); return {user: auth.currentUser};},
    signInWithPopup: async () => {auth.currentUser = account(f.googleEmail || invited.inviteeEmail); calls.push('google'); return {user: auth.currentUser};},
    GoogleAuthProvider: class {}, signOut: async () => {auth.currentUser = null;},
    updateProfile: async (user, fields) => {Object.assign(user, fields); calls.push(['auth', fields]);},
  };
  const firestore = {doc: (_, path) => path, serverTimestamp: () => 'server-time',
    getDoc: async path => ({exists: () => docs.has(path), data: () => docs.get(path)}),
    setDoc: async (path, data) => {calls.push(['document', data]); if (f.failDocument) throw Error('synthetic save failed'); docs.set(path, {...docs.get(path), ...data});},
  };
  firestore.runTransaction = async (_, fn) => {const writes = []; await fn({get: firestore.getDoc, set: (...args) => writes.push(args)}); for (const args of writes) await firestore.setDoc(...args);};
  const f = {hooks, auth, calls, routes, docs, failDocument: false, setObserverUser: async user => observe(user)};
  const module = load('src/hooks/useAuth.tsx', {react: hooks.react, 'next/navigation': {useRouter: () => ({push: route => routes.push(route)})},
    'firebase/auth': firebaseAuth, 'firebase/storage': {getStorage: () => ({}), ref: (_, path) => ({path}), uploadBytes: async object => {calls.push('upload'); return {ref: object};}, getDownloadURL: async () => 'new-url', deleteObject: async () => calls.push('delete-new')},
    'firebase/firestore': firestore, '@/lib/firebase/clients': {app: {}, db: {}}, '@/lib/billing/storage': {prepareStorageUpload: async () => calls.push('prepare')},
    '@/lib/auth/redirect': redirect, '@/lib/photos/save': save, '@/lib/photos/storage': {deleteOwnedPhoto: async url => calls.push(['cleanup', url])}, '@/lib/photos/ownership': ownership,
  });
  f.render = () => hooks.render(() => module.AuthProvider({children: null})).props.value;
  f.render(); return f;
}
for (const method of ['login', 'signup', 'signInWithGoogle']) for (const dest of ['/invite/abc', undefined, '//evil']) test(`actual auth ${method} honors validated continuation ${dest}`, async () => {
  const f = authFixture(); const context = f.render();
  if (method === 'login') await context.login(invited.inviteeEmail, 'synthetic', dest);
  else if (method === 'signup') await context.signup(invited.inviteeEmail, 'synthetic', 'QA Name', dest);
  else await context.signInWithGoogle(dest);
  assert.deepEqual(f.routes, [dest === '/invite/abc' ? dest : '/dashboard']);
  if (method !== 'login') {
    assert.ok(f.docs.has('users/invitee')); const profile = f.docs.get('users/invitee');
    assert.equal(profile.email, invited.inviteeEmail); assert.equal(profile.uid, 'invitee');
    for (const field of ['billing', 'family', 'plan', 'entitlements', 'collaborators']) assert.equal(field in profile, false);
  }
  assert.equal(f.calls.some(c => Array.isArray(c) && c[0] === 'acceptInvitation'), false);
});
for (const mode of ['login', 'signup']) test(`actual ${mode} form keeps invitation context in links, credentials and Google`, async () => {
  const hooks = runtime(), calls = [], values = {email: invited.inviteeEmail, password: 'synthetic', name: 'QA Name'};
  const component = load('src/components/auth/AuthForm.tsx', {react: hooks.react, 'next/navigation': {useSearchParams: () => new URLSearchParams({redirect: '/invite/abc'})},
    '@/lib/auth/redirect': redirect, '@/hooks/useAuth': {useAuth: () => ({login: async (...a) => calls.push(['login', ...a]), signup: async (...a) => calls.push(['signup', ...a]), signInWithGoogle: async (...a) => calls.push(['google', ...a])})},
    'react-hook-form': {useForm: () => ({control: {}, handleSubmit: fn => () => fn(values)})}, 'next/link': {default: 'Link', __esModule: true},
  }).default;
  const tree = hooks.render(() => component({mode})); const link = find(tree, 'Link', mode === 'login' ? 'Sign up' : 'Log in');
  assert.equal(new URL(link.props.href, 'https://local.invalid').searchParams.get('redirect'), '/invite/abc');
  await nodes(tree).find(n => n.type === 'form').props.onSubmit(); assert.equal(calls[0].at(-1), '/invite/abc');
  await find(tree, 'Button', 'Google').props.onClick(); assert.equal(calls[1].at(-1), '/invite/abc');
  if (mode === 'signup') assert.match(text(tree), /return to your family tree invitation/);
});
const bucket = 'qa.appspot.com', accountOwner = {uid: 'qa-user'}, personOwner = {treeId: 'qa-tree', personId: 'qa-person'};
const download = (path, b = bucket) => `https://firebasestorage.googleapis.com/v0/b/${b}/o/${encodeURIComponent(path)}?alt=media&token=synthetic`;
for (const [owner, path] of [[accountOwner, 'users/qa-user/profile/legacy name.png'], [personOwner, 'trees/qa-tree/people/qa-person/legacy_image.jpg']]) test(`owned legacy Firebase URL accepted: ${path}`, () => assert.equal(ownership.ownedPhotoPath(download(path), bucket, owner), path));
const unsafe = [
  [accountOwner, download('users/other/profile/avatar.png')], [accountOwner, 'https://lh3.googleusercontent.com/avatar'], [accountOwner, download('users/qa-user/profile/a.png', 'other.appspot.com')],
  [accountOwner, 'https://firebasestorage.googleapis.com/not-a-download'], [accountOwner, download('users/qa-user/profile/../other/a.png')], [accountOwner, download('users/qa-user/profile/%2Fa.png')],
  [accountOwner, download('users/qa-user/profile/a/b.png')], [accountOwner, download('users/qa-user/profile/a\\b.png')], [accountOwner, download('users/qa-user/profile/..')], [accountOwner, download('users/qa-user/profile/a\nb.png')],
  [personOwner, download('trees/other/people/qa-person/a.png')], [personOwner, download('trees/qa-tree/people/other/a.png')], [personOwner, 'https://evil.example/a.png'],
  [personOwner, download('trees/qa-tree/people/qa-person/a.png', 'other.appspot.com')], [personOwner, 'gs://qa.appspot.com/trees/qa-tree/people/qa-person/a.png'],
  [personOwner, download('trees/qa-tree/people/qa-person/%252Fa.png')], [personOwner, download('trees/qa-tree/people/qa-person/nested/a.png')],
  [accountOwner, download('users/qa-user/profile/a.png').replace('https://', 'https://evil@')], [accountOwner, download('users/qa-user/profile/a.png').replace('googleapis.com', 'googleapis.com.evil.example')],
  [accountOwner, download('users/qa-user/profile/a.png') + '#fragment'], [accountOwner, download('users/qa-user/profile/a.png').replace('%2F', '%252F')],
  [accountOwner, 'https://firebasestorage.googleapis.com/v0/b/qa.appspot.com/o/../o/a.png'],
];
unsafe.forEach(([owner, url], i) => test(`unsafe photo URL ${i} rejected`, () => assert.equal(ownership.ownedPhotoPath(url, bucket, owner), null)));
test('safe deletion sends only validated owned object paths to Storage; skips external and missing safely', async () => {
  const calls = []; const module = load('src/lib/photos/storage.ts', {'@/lib/firebase/clients': {app: {}}, './ownership': ownership,
    'firebase/storage': {getStorage: () => ({}), ref: (_, path) => ({bucket, path}), deleteObject: async object => calls.push(object.path)},
  });
  assert.equal(await module.deleteOwnedPhoto('https://lh3.googleusercontent.com/avatar', accountOwner), false); assert.deepEqual(calls, []);
  await module.deleteOwnedPhoto(download('users/qa-user/profile/legacy.png'), accountOwner); assert.deepEqual(calls, ['users/qa-user/profile/legacy.png']);
});
test('new photo filenames are unique and use an allowlisted MIME extension', () => {
  const a = ownership.uniquePhotoName('image/jpeg'), b = ownership.uniquePhotoName('image/jpeg');
  assert.notEqual(a, b); assert.match(a, /^[a-f0-9-]+\.jpg$/); assert.throws(() => ownership.uniquePhotoName('text/html'));
  assert.throws(() => ownership.validatePhoto(new Blob([new Uint8Array(5 * 1024 * 1024)], {type: 'image/png'})));
});
function accountSave({pending = new File(['photo'], 'photo.png', {type: 'image/png'}), remove = false, fail = false, failAuth = false, failRollback = false, old = 'old-url', cleanupFail = false} = {}) {
  const calls = []; let auth = old, document = old, authCalls = 0;
  const options = {oldUrl: old, oldName: 'Old Name', name: 'New Name', pending, remove,
    upload: async () => {calls.push('upload'); return 'new-url';},
    saveAuth: async (_, url) => {calls.push(['auth', url]); authCalls++; if (failAuth || (failRollback && authCalls > 1)) throw Error('auth save failed'); auth = url;},
    saveDocument: async url => {calls.push(['document', url]); if (fail) throw Error('document save failed'); document = url;},
    cleanup: async url => {calls.push(['delete', url]); if (cleanupFail) return false;},
  };
  return {run: () => save.saveAccountPhoto(options), calls, state: () => ({auth, document})};
}
test('account replacement uploads, persists Auth + Firestore, then deletes old object', async () => {
  const f = accountSave(); await f.run(); assert.deepEqual(f.calls, ['upload', ['auth', 'new-url'], ['document', 'new-url'], ['delete', 'old-url']]); assert.deepEqual(f.state(), {auth: 'new-url', document: 'new-url'});
});
test('account removal clears both references before deleting the old photo', async () => {
  const f = accountSave({pending: null, remove: true}); await f.run(); assert.deepEqual(f.calls, [['auth', null], ['document', null], ['delete', 'old-url']]); assert.deepEqual(f.state(), {auth: null, document: null});
});
test('failed account Firestore save restores Auth and removes newly uploaded object', async () => {
  const f = accountSave({fail: true}); await assert.rejects(f.run()); assert.deepEqual(f.state(), {auth: 'old-url', document: 'old-url'}); assert.deepEqual(f.calls.at(-1), ['delete', 'new-url']); assert.equal(f.calls.some(c => Array.isArray(c) && c[0] === 'delete' && c[1] === 'old-url'), false);
});
test('failed initial Auth save cleans new photo without touching old references', async () => {
  const f = accountSave({failAuth: true}); await assert.rejects(f.run()); assert.deepEqual(f.state(), {auth: 'old-url', document: 'old-url'}); assert.deepEqual(f.calls.at(-1), ['delete', 'new-url']);
});
test('failed Auth compensation retains new object rather than deleting a live Auth reference', async () => {
  const f = accountSave({fail: true, failRollback: true}); await assert.rejects(f.run()); assert.deepEqual(f.state(), {auth: 'new-url', document: 'old-url'}); assert.equal(f.calls.some(c => Array.isArray(c) && c[0] === 'delete'), false);
});
test('old account cleanup failure does not roll back successful state', async () => {
  const f = accountSave({cleanupFail: true}); await f.run(); assert.deepEqual(f.state(), {auth: 'new-url', document: 'new-url'});
});
function personUI({persistSuccess = true, photo = 'old-url'} = {}) {
  const hooks = runtime(), calls = []; const person = {id: 'qa-person', treeId: 'qa-tree', firstName: 'Synthetic', gender: 'male', profilePictureUrl: photo};
  const component = load('src/components/tree/NodeEditorDialog.tsx', {react: hooks.react, 'next/navigation': {useParams: () => ({treeId: 'qa-tree'})},
    '@/hooks/useAuth': {useAuth: () => ({user: {uid: 'qa-user'}, refreshUserProfile: async () => {}})}, '@/hooks/use-toast': {useToast: () => ({toast: n => calls.push(['toast', n.title])})},
    '@/app/actions': {handleGenerateBiography: async () => ({biography: 'synthetic'})}, '@/lib/uploadPersonPhoto': {uploadPersonPhoto: async () => {calls.push('upload'); return 'new-url';}},
    '@/lib/photos/prepare': {preparePersonPhoto: async file => {calls.push('prepare'); return file;}, enhancedPhotoFile: () => new File(['enhanced'], 'photo.jpg', {type: 'image/jpeg'})},
    '@/lib/photos/save': save, '@/lib/photos/storage': {deleteOwnedPhoto: async url => calls.push(['delete', url])}, 'next/image': {default: 'Image', __esModule: true},
  }).default;
  const props = {isOpen: true, person, treeId: 'qa-tree', onClose: () => calls.push('close'), onSave: async data => {calls.push(['persist', {...data}]); return persistSuccess;},
    onDeleteRequest: () => {}, onOpenNameSuggestor: () => {}, retainPhotoForUndo: async url => {calls.push(['retain', url]); return true;}};
  const render = () => hooks.render(() => component(props)); render();
  const select = async () => {const input = nodes(render()).find(n => n.type === 'input' && n.props.type === 'file'); await input.props.onChange({target: {files: [new File(['photo'], 'photo.png', {type: 'image/png'})], value: ''}});};
  return {render, calls, person, select, dispose: () => hooks.dispose()};
}
test('person image selection only prepares a local preview; Cancel never uploads or persists', async () => {
  const f = personUI(); await f.select(); let tree = f.render(); assert.match(nodes(tree).find(n => n.type === 'Image').props.src, /^blob:/);
  assert.equal(f.calls.includes('upload'), false); find(tree, 'Button', 'Cancel').props.onClick(); assert.equal(f.calls.includes('upload'), false); assert.equal(f.calls.some(c => c[0] === 'persist'), false); assert.equal(f.person.profilePictureUrl, 'old-url'); f.dispose();
});
test('person Remove + Cancel keeps persisted original and causes no Storage mutation', () => {
  const f = personUI(); let tree = f.render(); find(tree, 'Button', 'Remove').props.onClick(); tree = f.render();
  find(tree, 'AlertDialogAction', 'Remove').props.onClick(); tree = f.render(); assert.equal(find(tree, 'Button', 'Enhance').props.disabled, true);
  find(tree, 'Button', 'Cancel').props.onClick(); assert.equal(f.person.profilePictureUrl, 'old-url'); assert.deepEqual(f.calls, ['close']); f.dispose();
});
test('person Remove + Save clears reference before owned cleanup and closes on success', async () => {
  const f = personUI(); find(f.render(), 'AlertDialogAction', 'Remove').props.onClick(); await find(f.render(), 'Button', 'Save').props.onClick();
  const persisted = f.calls.find(c => c[0] === 'persist')[1]; assert.equal(persisted.profilePictureUrl, undefined);
  assert.ok(f.calls.findIndex(c => c[0] === 'persist') < f.calls.findIndex(c => c[0] === 'delete')); assert.equal(f.calls.at(-1), 'close'); f.dispose();
});
test('person Replace + Save uploads then persists then retires original and closes', async () => {
  const f = personUI(); await f.select(); await find(f.render(), 'Button', 'Save').props.onClick();
  assert.equal(f.calls.find(c => c[0] === 'persist')[1].profilePictureUrl, 'new-url');
  assert.ok(f.calls.indexOf('upload') < f.calls.findIndex(c => c[0] === 'persist')); assert.ok(f.calls.findIndex(c => c[0] === 'persist') < f.calls.findIndex(c => c[0] === 'delete')); f.dispose();
});
test('person failed save cleans new object, keeps old reference, editor and pending edits', async () => {
  const f = personUI({persistSuccess: false}); await f.select(); await find(f.render(), 'Button', 'Save').props.onClick();
  assert.deepEqual(f.calls.find(c => c[0] === 'delete'), ['delete', 'new-url']); assert.equal(f.person.profilePictureUrl, 'old-url'); assert.equal(f.calls.includes('close'), false);
  assert.ok(find(f.render(), 'Button', 'Save')); assert.match(nodes(f.render()).find(n => n.type === 'Image').props.src, /^blob:/); assert.ok(f.calls.some(c => c[0] === 'toast' && c[1] === 'Save Failed')); f.dispose();
});
test('person without a photo has no Remove and cannot Enhance a placeholder', () => {
  const f = personUI({photo: null}); assert.equal(find(f.render(), 'Button', 'Remove'), undefined); assert.equal(find(f.render(), 'Button', 'Enhance').props.disabled, true); f.dispose();
});
test('person enhanced image is staged as a File and uploads only on Save', async () => {
  const f = personUI(); const enhance = nodes(f.render()).find(n => n.type === '@/components/tree/PhotoEnhanceDialog');
  enhance.props.onPhotoEnhanced('data:image/jpeg;base64,c3ludGhldGlj'); assert.equal(f.calls.includes('upload'), false);
  await find(f.render(), 'Button', 'Save').props.onClick(); assert.equal(f.calls.includes('upload'), true); f.dispose();
});
test('photo undo restores deleted legacy URL from a local copy into a unique new object', async () => {
  const calls = [], url = download('trees/qa-tree/people/qa-person/legacy.png'); let persisted = {profilePictureUrl: 'replacement-url'};
  const history = load('src/lib/photos/history.ts', {'@/lib/firebase/clients': {app: {}}, './ownership': ownership,
    'firebase/storage': {getStorage: () => ({}), ref: (_, path) => ({bucket, path}), getBlob: async () => new Blob(['old-photo'], {type: 'image/png'})},
    '@/lib/uploadPersonPhoto': {uploadPersonPhoto: async () => {calls.push('restore-upload'); return 'restored-url';}}, './storage': {deleteOwnedPhoto: async url => calls.push(['delete', url])},
  }).createPhotoHistory();
  assert.equal(await history.retain(url, personOwner), true);
  await history.restore({profilePictureUrl: url}, 'qa-tree', 'qa-person', async data => {calls.push('persist'); persisted = data;});
  assert.deepEqual(calls, ['restore-upload', 'persist']); assert.equal(persisted.profilePictureUrl, 'restored-url');
  await assert.rejects(history.restore({profilePictureUrl: url}, 'qa-tree', 'qa-person', async () => {throw Error('synthetic persistence failure');}));
  assert.deepEqual(calls.at(-1), ['delete', 'restored-url']);
});

for (const existing of [true, false]) test(`actual Google identity initialization preserves invitation and requires explicit acceptance (existing=${existing})`, async () => {
  const f = authFixture(); if (existing) f.docs.set('users/invitee', {uid: 'invitee', email: invited.inviteeEmail, displayName: 'Existing QA'});
  await f.render().signInWithGoogle('/invite/abc'); assert.deepEqual(f.routes, ['/invite/abc']);
  assert.equal(invitation.invitationState({...invited, inviteeUid: existing ? 'invitee' : null}, f.auth.currentUser).kind, 'accept');
  assert.equal(invited.status, 'pending'); assert.equal(f.docs.get('users/invitee').collaborators, undefined);
});
test('wrong Google identity returns to invitation mismatch without accepting', async () => {
  const f = authFixture(); f.googleEmail = 'wrong@example.test'; await f.render().signInWithGoogle('/invite/abc');
  assert.equal(invitation.invitationState(invited, f.auth.currentUser).kind, 'mismatch'); assert.equal(invited.status, 'pending');
});
test('actual profile update hook clears Auth/Firestore, reflects fallback immediately and cleans old photo after persistence', async () => {
  const f = authFixture(); f.auth.currentUser = {uid: 'invitee', displayName: 'QA', photoURL: 'old-url'}; f.docs.set('users/invitee', {photoURL: 'old-url'});
  await f.render().updateUserProfile('QA', null, true);
  assert.equal(f.auth.currentUser.photoURL, null); assert.equal(f.docs.get('users/invitee').photoURL, ''); assert.equal(f.render().userProfile.photoURL, '');
  assert.ok(f.calls.findIndex(c => c[0] === 'document') < f.calls.findIndex(c => c[0] === 'cleanup'));
});
test('actual profile update hook replacement uses unique new object, saves before cleanup, and compensates failure', async () => {
  const f = authFixture(); const user = {uid: 'invitee', displayName: 'QA', photoURL: 'old-url'}; f.auth.currentUser = user; f.docs.set('users/invitee', {photoURL: 'old-url'});
  await f.render().updateUserProfile('QA', new File(['synthetic'], 'photo.png', {type: 'image/png'}));
  assert.ok(f.calls.indexOf('upload') < f.calls.findIndex(c => c[0] === 'document')); assert.ok(f.calls.findIndex(c => c[0] === 'document') < f.calls.findIndex(c => c[0] === 'cleanup')); assert.equal(f.render().userProfile.photoURL, 'new-url');
  f.calls.length = 0; f.failDocument = true; await assert.rejects(f.render().updateUserProfile('Edited', new File(['synthetic'], 'photo.png', {type: 'image/png'})));
  assert.equal(user.photoURL, 'new-url'); assert.equal(f.docs.get('users/invitee').photoURL, 'new-url');
});
function profileUI(photo) {
  const hooks = runtime(), calls = []; const user = {uid: 'qa-user', displayName: 'QA', email: 'qa@example.test', photoURL: photo};
  const component = load('src/app/profile/page.tsx', {react: hooks.react, 'next/navigation': {useRouter: () => ({push: route => calls.push(['route', route])})},
    '@/hooks/useAuth': {useAuth: () => ({user, userProfile: {photoURL: photo}, loading: false, updateUserProfile: async (...args) => calls.push(['save', ...args])})},
    '@/hooks/use-toast': {useToast: () => ({toast() {}})}, '@/lib/photos/ownership': ownership,
  }).default;
  const render = () => hooks.render(component); render(); return {render, calls, dispose: () => hooks.dispose()};
}
test('actual Profile Remove Photo is conditional, confirmed and staged until Apply Changes', async () => {
  const f = profileUI('old-url'); let tree = f.render(); find(tree, 'Button', 'Remove Photo').props.onClick(); assert.deepEqual(f.calls, []);
  tree = f.render(); find(tree, 'AlertDialogAction', 'Remove Photo').props.onClick(); tree = f.render();
  assert.equal(find(tree, 'Button', 'Remove Photo'), undefined); assert.equal(nodes(tree).find(n => n.type === 'AvatarImage').props.src, undefined);
  await find(tree, 'Button', 'Apply Changes').props.onClick(); assert.deepEqual(f.calls, [['save', 'QA', null, true]]); f.dispose();
  const empty = profileUI(null); assert.equal(find(empty.render(), 'Button', 'Remove Photo'), undefined); empty.dispose();
});
test('cleanup errors preserve successful account save and original persistence error on failure', async () => {
  const f = accountSave(); const opts = {oldUrl: 'old', oldName: 'QA', name: 'QA', pending: null, remove: true,
    upload: async () => 'new', saveAuth: async () => {}, saveDocument: async () => {}, cleanup: async () => {throw Error('cleanup transport');}};
  assert.equal(await save.saveAccountPhoto(opts), null);
  opts.pending = new File(['photo'], 'photo.png', {type: 'image/png'}); opts.remove = false; opts.saveDocument = async () => {throw Error('original persistence error');};
  await assert.rejects(save.saveAccountPhoto(opts), /original persistence error/);
});
test('local image preparation compresses without Storage calls and always revokes its source preview', async () => {
  const originalDocument = global.document, originalCreate = URL.createObjectURL, originalRevoke = URL.revokeObjectURL; const events = [];
  URL.createObjectURL = () => {events.push('preview'); return 'blob:synthetic';}; URL.revokeObjectURL = () => events.push('revoke');
  global.document = {createElement: tag => tag === 'img' ? {width: 800, height: 400, set src(value) {queueMicrotask(() => this.onload());}} : {getContext: () => ({drawImage() {events.push('compress');}}), toBlob: callback => callback(new Blob(['compressed'], {type: 'image/jpeg'}))}};
  try {
    const {preparePersonPhoto, enhancedPhotoFile} = load('src/lib/photos/prepare.ts', {'./ownership': ownership});
    const file = await preparePersonPhoto(new File(['photo'], 'qa.png', {type: 'image/png'})); assert.equal(file.type, 'image/jpeg'); assert.deepEqual(events, ['preview', 'compress', 'revoke']);
    assert.equal(enhancedPhotoFile('data:image/png;base64,c3ludGhldGlj').type, 'image/png'); assert.throws(() => enhancedPhotoFile('https://external.example/photo'));
  } finally {global.document = originalDocument; URL.createObjectURL = originalCreate; URL.revokeObjectURL = originalRevoke;}
});
test('actual undo/redo persists photos restored from retired objects and keeps other person data', async () => {
  const hooks = runtime(), objects = new Map(), old = download('trees/qa-tree/people/qa-person/old.png'), newer = download('trees/qa-tree/people/qa-person/new.png');
  objects.set('trees/qa-tree/people/qa-person/old.png', new Blob(['old'], {type: 'image/png'})); objects.set('trees/qa-tree/people/qa-person/new.png', new Blob(['new'], {type: 'image/png'}));
  let seq = 0, persisted = {id: 'qa-person', firstName: 'Edited', profilePictureUrl: newer, spouseIds: ['synthetic-spouse'], x: 42};
  const cleanup = async url => {const path = ownership.ownedPhotoPath(url, bucket, personOwner); if (path) objects.delete(path);};
  const history = load('src/lib/photos/history.ts', {'@/lib/firebase/clients': {app: {}}, './ownership': ownership,
    'firebase/storage': {getStorage: () => ({}), ref: (_, path) => ({bucket, path}), getBlob: async object => {if (!objects.has(object.path)) throw Error('missing'); return objects.get(object.path);}},
    '@/lib/uploadPersonPhoto': {uploadPersonPhoto: async file => {const path = `trees/qa-tree/people/qa-person/restored-${++seq}.png`; objects.set(path, file); return download(path);}}, './storage': {deleteOwnedPhoto: cleanup},
  });
  const module = load('src/hooks/useUndoRedo.ts', {react: hooks.react, '@/lib/firebase/clients': {db: {}}, '@/lib/photos/history': history,
    'firebase/firestore': {doc: (_, ...path) => path.join('/'), getDoc: async () => ({data: () => persisted}), updateDoc: async (_, data) => {persisted = {...persisted, ...data};}, deleteField: () => null, serverTimestamp: () => 'server-time'},
  });
  const render = () => hooks.render(() => module.useUndoRedo('qa-tree')); render();
  assert.equal(await render().retainPhotoForUndo(old, 'qa-person'), true);
  render().pushCommand({type: 'UPDATE_PERSON', treeId: 'qa-tree', personId: 'qa-person', before: {...persisted, firstName: 'Original', profilePictureUrl: old}, after: {...persisted}});
  await cleanup(old); await render().undo(); render();
  assert.equal(persisted.firstName, 'Original'); assert.ok(objects.has(ownership.ownedPhotoPath(persisted.profilePictureUrl, bucket, personOwner))); assert.deepEqual(persisted.spouseIds, ['synthetic-spouse']); assert.equal(persisted.x, 42);
  await render().redo(); render(); assert.equal(persisted.firstName, 'Edited'); assert.ok(objects.has(ownership.ownedPhotoPath(persisted.profilePictureUrl, bucket, personOwner))); assert.equal(render().canUndo, true);
});

test('wrong-email signup returns to mismatch and never grants invited membership', async () => {
  const f = authFixture(); await f.render().signup('wrong@example.test', 'synthetic', 'Wrong QA', '/invite/abc');
  assert.deepEqual(f.routes, ['/invite/abc']); assert.equal(invitation.invitationState({...invited, inviteeUid: null}, f.auth.currentUser).kind, 'mismatch'); assert.equal(invited.status, 'pending');
  assert.equal(f.docs.get('users/invitee').collaborators, undefined);
});

test('partial position undo preserves the photo and never retires it', async () => {
  const hooks = runtime(); let persisted = {x: 20, profilePictureUrl: 'live-photo'}; const cleanup = [];
  const module = load('src/hooks/useUndoRedo.ts', {react: hooks.react, '@/lib/firebase/clients': {db: {}},
    '@/lib/photos/history': {createPhotoHistory: () => ({clear() {}, prune() {}, retain: async () => true, restore: async (person, treeId, personId, persist, currentUrl) => {if (currentUrl) cleanup.push(currentUrl); await persist(person); return person;}})},
    'firebase/firestore': {doc: () => ({}), getDoc: async () => ({data: () => persisted}), updateDoc: async (_, data) => {persisted = {...persisted, ...data};}, serverTimestamp: () => 'server-time', deleteField: () => null},
  });
  const render = () => hooks.render(() => module.useUndoRedo('qa-tree')); render();
  render().pushCommand({type: 'UPDATE_PERSON', treeId: 'qa-tree', personId: 'qa-person', before: {x: 10}, after: {x: 20}});
  await render().undo(); render(); assert.equal(persisted.x, 10); assert.equal(persisted.profilePictureUrl, 'live-photo'); assert.deepEqual(cleanup, []);
});
