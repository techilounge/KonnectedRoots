// Run with Playwright available externally; no application dependency is required.
// NODE_PATH can point at the installed browser-test tooling.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

(async () => {
  const browser = await chromium.launch({channel: 'chrome', headless: true});
  try {
    const page = await browser.newPage({viewport: {width: 800, height: 600}});
    const source = ts.transpileModule(fs.readFileSync('src/lib/tree-export.ts', 'utf8'), {
      compilerOptions: {module: ts.ModuleKind.CommonJS},
    }).outputText;
    await page.setContent(`<style>body{margin:0}main{width:400px;height:300px;overflow:auto;padding:16px}
      .wrapper{width:100%;height:100%;overflow:auto}svg{min-width:2400px;min-height:1400px}</style>
      <div style="width:500px;height:400px;overflow:hidden"><main><div class="wrapper">
      <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      <g id="camera" transform="translate(-700,400) scale(.5)">
      <rect x="-5000" y="-5000" width="10000" height="10000" fill="#fafafa"/>
      <g data-panning-surface transform="translate(600,300)">
      <line x1="-400" y1="-200" x2="1600" y2="800" stroke="black"/>
      <foreignObject x="-500" y="-250" width="200" height="100"><div xmlns="http://www.w3.org/1999/xhtml" style="width:200px;height:100px;background:rgb(255,0,0)">LEFT PERSON</div></foreignObject>
      <foreignObject x="1500" y="750" width="200" height="100"><div xmlns="http://www.w3.org/1999/xhtml" style="width:200px;height:100px;background:rgb(0,0,255)">RIGHT PERSON</div></foreignObject>
      </g></g></svg></div></main></div>`);
    await page.addScriptTag({path: require.resolve('html2canvas')});
    await page.addScriptTag({path: 'node_modules/jspdf/dist/jspdf.umd.min.js'});
    await page.addScriptTag({content: `var exports = {}; ${source}`});
    const results = [];
    for (const camera of ['translate(-700,400) scale(.5)', 'translate(1200,-900) scale(2)']) {
      results.push(await page.evaluate(async (transform) => {
        const root = document.querySelector('main');
        document.querySelector('#camera').setAttribute('transform', transform);
        const wrapper = root.querySelector('.wrapper');
        wrapper.scrollLeft = 180;
        wrapper.scrollTop = 90;
        const scrollBefore = [wrapper.scrollLeft, wrapper.scrollTop];
        const before = root.outerHTML;
        const options = exports.prepareTreeExport(root);
        const canvas = await html2canvas(root, {...options, logging: false});
        const ctx = canvas.getContext('2d');
        const pixel = (x, y) => Array.from(ctx.getImageData(Math.floor(x * options.scale), Math.floor(y * options.scale), 1, 1).data);
        return {
          width: canvas.width, height: canvas.height,
          left: pixel(132, 82), right: pixel(2132, 1082),
          unchanged: root.outerHTML === before,
          scrollBefore, scrollAfter: [wrapper.scrollLeft, wrapper.scrollTop],
          image: canvas.toDataURL(),
        };
      }, camera));
    }
    for (const result of results) {
      assert.deepEqual(result.left, [255, 0, 0, 255], 'negative-coordinate person must be captured');
      assert.deepEqual(result.right, [0, 0, 255, 255], 'off-screen person must be captured');
      assert.equal(result.unchanged, true, 'live DOM must not change');
      assert.deepEqual(result.scrollAfter, result.scrollBefore, 'live scroll must not change');
      assert.ok(result.scrollBefore[0] > 0 && result.scrollBefore[1] > 0);
    }
    assert.equal(results[0].image, results[1].image, 'pan/zoom must not change exported content');
    const downloadEvent = page.waitForEvent('download');
    await page.evaluate(({image, width, height}) => {
      const pdf = new jspdf.jsPDF({orientation: 'landscape', unit: 'px', format: [width / 2, height / 2]});
      pdf.addImage(image, 'PNG', 0, 0, width / 2, height / 2);
      pdf.save('full-tree-regression.pdf');
    }, results[0]);
    const download = await downloadEvent;
    assert.equal(await download.failure(), null);
    const pdfBytes = fs.readFileSync(await download.path());
    assert.equal(pdfBytes.subarray(0, 5).toString(), '%PDF-');
    assert.match(pdfBytes.toString('latin1'), /\/Subtype \/Image/);
    console.log('PASS: Chrome/html2canvas captures both off-screen people at two pan/zoom settings; live DOM/scroll unchanged; jsPDF download succeeds.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
