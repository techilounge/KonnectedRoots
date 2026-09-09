const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(file, mocks = {}, globals = {}) {
  const mod = {exports: {}};
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020},
  }).outputText;
  const localRequire = name => {
    if (name in mocks) return mocks[name];
    if (name === 'server-only') return {};
    if (name.startsWith('@/') || name.startsWith('.')) {
      const target = name.startsWith('@/') ? path.join('src', name.slice(2)) : path.join(path.dirname(file), name);
      return load(target + (fs.existsSync(target) ? '' : '.ts'), mocks, globals);
    }
    return require(name);
  };
  new Function('require', 'exports', 'module', ...Object.keys(globals), source)(localRequire, mod.exports, mod, ...Object.values(globals));
  return mod.exports;
}

function metadataRoute(direct, slugResults = [], fail = false) {
  const filters = [];
  const query = {
    where(field, operator, value) { filters.push([field, operator, value]); return this; },
    limit() { return this; },
    async get() { return {size: slugResults.length, docs: slugResults.map(data => ({id: data.id, data: () => data}))}; },
    doc() { return {get: async () => {if (fail) throw new Error('private-provider-detail'); return {exists: !!direct, id: 'actual-id', data: () => direct};}}; },
  };
  const warnings = [];
  const route = load('src/app/tree/[treeId]/layout.tsx', {
    react: {cache: fn => fn}, '@/lib/firebase/admin': {adminDb: {collection: () => query}},
  }, {console: {warn: (...args) => warnings.push(args)}, process: {env: {}}});
  return {run: () => route.generateMetadata({params: Promise.resolve({treeId: 'synthetic-slug'})}), filters, warnings};
}

test('existing authorized slug gets a neutral SSR title and authenticated title without another read', async () => {
  const route = metadataRoute(null);
  const meta = await route.run();
  assert.equal(meta.title, 'Family Tree | KonnectedRoots');
  assert.deepEqual(route.filters, [['slug', '==', 'synthetic-slug'], ['visibility', '==', 'public']]);
  const {authenticatedTreeTitle} = load('src/lib/trees/metadata.ts');
  assert.equal(authenticatedTreeTitle({title: 'Synthetic Private'}), 'Synthetic Private - Family Tree | KonnectedRoots');
  assert.equal(authenticatedTreeTitle(null), 'Family Tree | KonnectedRoots');
});

test('missing and unauthorized private trees have indistinguishable non-indexable metadata', async () => {
  const missing = await metadataRoute(null).run();
  const hidden = await metadataRoute({title: 'DO NOT DISCLOSE', visibility: 'private', memberCount: 123}).run();
  assert.deepEqual(hidden, missing);
  assert.deepEqual(hidden.robots, {index: false, follow: false});
  assert.ok(!JSON.stringify(hidden).includes('DO NOT DISCLOSE'));
});

test('public slug metadata uses canonical document ID and ambiguous slugs stay generic', async () => {
  const publicTree = {id: 'public-id', visibility: 'public', title: 'Synthetic Public', memberCount: 2};
  const meta = await metadataRoute(null, [publicTree]).run();
  assert.equal(meta.title, 'Synthetic Public - Family Tree | KonnectedRoots');
  assert.equal(meta.alternates.canonical, 'https://konnectedroots.app/tree/public-id');
  assert.equal((await metadataRoute(null, [publicTree, publicTree]).run()).robots.index, false);
});

test('transient metadata lookup failure is neutral and does not log provider contents', async () => {
  const route = metadataRoute(null, [], true);
  assert.equal((await route.run()).title, 'Family Tree | KonnectedRoots');
  assert.ok(route.warnings.length > 0);
  assert.ok(!JSON.stringify(route.warnings).includes('private-provider-detail'));
});

test('sitemap is deterministic, database-free and excludes authenticated tree URLs', async () => {
  const sitemap = load('src/app/sitemap.ts', {'@/lib/firebase/admin': new Proxy({}, {get() {throw Error('Admin must not be used');}})}, {process: {env: {}}}).default;
  const result = await sitemap();
  assert.deepEqual(await sitemap(), result);
  assert.equal(result.length, 8);
  assert.ok(result.every(item => !/\/(tree|admin|dashboard|profile|settings)(\/|$)/.test(new URL(item.url).pathname)));
});

test('public config barrel has no server secrets and missing browser setup fails without values', () => {
  const env = {NEXT_PUBLIC_FIREBASE_API_KEY: 'public-fixture', FIREBASE_SERVICE_ACCOUNT: 'private-fixture'};
  const config = load('src/lib/config/env.client.ts', {}, {process: {env}, window: {}});
  assert.throws(() => config.firebaseBrowserOptions(), /Missing public Firebase configuration/);
  assert.ok(!JSON.stringify(config.clientEnv).includes('private-fixture'));
  assert.ok(!fs.readFileSync('src/lib/config/index.ts', 'utf8').includes("from './env.server'"));
});

test('server log redacts provider message and arbitrary error codes', () => {
  const logs = [];
  const {logServerFailure} = load('src/lib/server-log.ts', {}, {console: {error: (...args) => logs.push(args)}});
  logServerFailure('synthetic_operation', {code: 'private-fixture', message: 'private-fixture', token: 'private-fixture'});
  assert.ok(!JSON.stringify(logs).includes('private-fixture'));
  assert.equal(logs[0][1].code, 'internal');
});

test('GEDCOM round trip preserves synthetic relationships without printing genealogy data', () => {
  const logs = [];
  const globals = {console: {log: (...args) => logs.push(args), warn: (...args) => logs.push(args)}};
  const {generateGedcom} = load('src/lib/gedcom-generator.ts', {}, globals);
  const {parseGedcom, convertToPeople} = load('src/lib/gedcom-parser.ts', {}, globals);
  const people = [{id:'parent', firstName:'Synthetic Parent', gender:'female', childrenIds:['child']},
    {id:'child', firstName:'Synthetic Child', gender:'unknown', parentId1:'parent'}];
  const parsed = convertToPeople(parseGedcom(generateGedcom(people, 'Synthetic Fixture')), 'owner', 'tree');
  assert.equal(parsed.length, 2);
  const parent = parsed.find(person => person.firstName === 'Synthetic Parent');
  const child = parsed.find(person => person.firstName === 'Synthetic Child');
  assert.equal(child.parentId1 || child.parentId2, parent.id);
  assert.deepEqual(logs, []);
});
