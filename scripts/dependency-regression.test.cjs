const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

test('updated Sharp raster output embeds in a jsPDF export', async () => {
  const sharp = require('sharp');
  const {jsPDF} = require('jspdf');
  const png = await sharp({create:{width:32,height:24,channels:3,background:'#bfa889'}}).resize(64,48).png().toBuffer();
  assert.equal((await sharp(png).metadata()).width,64);
  const pdf = new jsPDF({orientation:'landscape',unit:'px',format:[64,48]});
  pdf.addImage(new Uint8Array(png),'PNG',0,0,64,48);
  const output = Buffer.from(pdf.output('arraybuffer'));
  assert.ok(output.subarray(0,5).equals(Buffer.from('%PDF-')));
  assert.match(output.toString('latin1'),/\/Subtype \/Image/);
  assert.equal(pdf.getNumberOfPages(),1);
});

test('GEDCOM export retains an edited parent-child relationship', () => {
  const code = ts.transpileModule(fs.readFileSync('src/lib/gedcom-generator.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  const mod = {exports:{}};
  new Function('exports','module',code)(mod.exports,mod);
  const people = [
    {id:'parent',firstName:'Parent',lastName:'Fixture',gender:'female',childrenIds:['child']},
    {id:'child',firstName:'Edited',lastName:'Fixture',gender:'unknown',parentId1:'parent'},
  ];
  const text = mod.exports.generateGedcom(people,'Synthetic');
  assert.match(text,/1 NAME Edited \/Fixture\//);
  assert.match(text,/1 CHIL @Ichild@/);
  assert.match(text,/1 WIFE @Iparent@/);
  assert.match(text,/0 TRLR/);
});
