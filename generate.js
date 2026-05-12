'use strict';
const readline    = require('readline');
const PizZip      = require('pizzip');
const Docxtemplater = require('docxtemplater');
const ImageModule = require('docxtemplater-image-module-free');
const QRCode      = require('qrcode');
const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { execSync, spawnSync } = require('child_process');

const DOCS_DIR    = path.join(__dirname, "DOC's");
const TEMP_DIR    = path.join(__dirname, '.tmp_filled');
const CONFIG_PATH = path.join(__dirname, 'config.json');

// ── Config ────────────────────────────────────────────────────────────────────
function loadConfig()      { try { return JSON.parse(fs.readFileSync(CONFIG_PATH,'utf8')); } catch { return null; } }
function saveConfig(c)     { fs.writeFileSync(CONFIG_PATH, JSON.stringify(c,null,2)); }
function defaultBase()     { return path.join(os.homedir(),'Desktop'); }
function getJobFolder(base, plate) {
  const n=new Date(), p2=n=>String(n).padStart(2,'0');
  const s=`${n.getFullYear()}-${p2(n.getMonth()+1)}-${p2(n.getDate())}_${p2(n.getHours())}-${p2(n.getMinutes())}`;
  const f=path.join(base,'VehicleOutput',`${s}_${plate}`);
  fs.mkdirSync(f,{recursive:true}); return f;
}
async function handleSetPath() {
  const rl=readline.createInterface({input:process.stdin,output:process.stdout});
  console.log(`\n  Press Enter to use Desktop (${defaultBase()}):\n`);
  const v=await new Promise(r=>rl.question('  New path: ',a=>r(a.trim()))); rl.close();
  const chosen=v||defaultBase(); saveConfig({outputBase:chosen});
  console.log(`\n  ✔  Updated to: ${chosen}\n`);
}

// ── LibreOffice ───────────────────────────────────────────────────────────────
function findLibreOffice() {
  for (const p of [
    'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
    'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
    'C:\\Program Files\\LibreOffice 7\\program\\soffice.exe',
  ]) if (fs.existsSync(p)) return p;
  try { const r=spawnSync('where',['soffice'],{encoding:'utf8'}); const l=(r.stdout||'').trim().split('\n')[0].trim(); if(l&&fs.existsSync(l)) return l; } catch {}
  return null;
}

// ── Date helpers ──────────────────────────────────────────────────────────────
const MON_IDX  ={JAN:0,FEB:1,MAR:2,APR:3,MAY:4,JUN:5,JUL:6,AUG:7,SEP:8,OCT:9,NOV:10,DEC:11};
const MON_NAME =['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
function parseMonYear(s) {
  const str=s.trim();
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) { const[dd,mm,yy]=str.split('/'); return new Date(+yy,+mm-1,+dd); }
  const[mon,yr]=str.toUpperCase().split(/[\s\-]+/); const m=MON_IDX[mon],y=+yr;
  if(isNaN(m)||isNaN(y)) throw new Error(`Cannot parse "${s}". Use: JUN 2026 or 09/05/2026`);
  return new Date(y,m,1);
}
function fmtDD(d)  { const p=n=>String(n).padStart(2,'0'); return `${p(d.getDate())}/${p(d.getMonth()+1)}/${d.getFullYear()}`; }
function fmtMY(d)  { return `${MON_NAME[d.getMonth()]} ${d.getFullYear()}`; }
function calcExpiry(reg,cat) {
  const d=parseMonYear(reg);
  cat.toLowerCase()==='commercial' ? d.setMonth(d.getMonth()+6) : d.setFullYear(d.getFullYear()+1);
  return fmtDD(d);
}

// ── Variants ──────────────────────────────────────────────────────────────────
const VARIANT_SUFFIXES = ['_UPPER', '_LOWER', '_TITLE', '_DASHED', '_SLASH', '_SHORT', '_LONG'];
function getBaseField(tag) {
  for (const suf of VARIANT_SUFFIXES) {
    if (tag.endsWith(suf)) return tag.slice(0, -suf.length);
  }
  return tag;
}
function toTitleCase(str) {
  if (!str) return '';
  return str.toLowerCase().replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1));
}

// ── Prompt helpers ────────────────────────────────────────────────────────────
const ask = (rl,q) => new Promise(r=>rl.question(q,a=>r(a.trim())));

const FIELD_PROMPTS = {
  OWNER_NAME:      "  Owner's Name                                : ",
  PHONE_NUMBER:    "  Phone Number                                : ",
  PLATE_NUMBER:    "  Number Plate                                : ",
  PREVIOUS_NUMBER: "  Passengers Number  [Enter to skip]          : ",
  VEHICLE_MAKE:    "  Vehicle Make  (e.g. Toyota)                 : ",
  MODEL:           "  Model  (e.g. Camry)                         : ",
  VEHICLE_TYPE:    "  Vehicle Type / Body Type  (e.g. Saloon)     : ",
  COLOUR:          "  Colour                                      : ",
  CHASSIS_NUMBER:  "  Chassis Number                              : ",
  ENGINE_NUMBER:   "  Engine Number                               : ",
  STATE:           "  State                                       : ",
  ADDRESS:         "  Address                                     : ",
  REG_DATE:        "  Registration Date  (DD/MM/YYYY)             : ",
  isprice:         "  Insurance Price                             : ",
  isData:          "  Insurance Top Data                          : ",
  pfRegData:       "  Proof Reg Date  (DD/MM/YYYY or JUN 2026)    : ",
  pfEXData:        "  Proof Expiry Date (DD/MM/YYYY or JUN 2027)  : ",
  QR_CODE_1:       "  Proof Code URL        [Enter to skip]       : ",
  QR_CODE_2:       "  GMR QR Code URL       [Enter to skip]       : ",
};
// Canonical display order
const PROMPT_ORDER = ['OWNER_NAME','PHONE_NUMBER','PLATE_NUMBER','PREVIOUS_NUMBER',
  'VEHICLE_MAKE','MODEL','VEHICLE_TYPE','COLOUR','CHASSIS_NUMBER','ENGINE_NUMBER',
  'STATE','ADDRESS','REG_DATE','isprice','isData','pfRegData','pfEXData'];

// ── Placeholder detection ─────────────────────────────────────────────────────
function detectPlaceholders(templatePath) {
  try {
    const zip = new PizZip(fs.readFileSync(templatePath,'binary'));
    const tags = new Set();
    zip.file(/^word\/(document|header|footer).*\.xml$/).forEach(f => {
      try {
        const xml = f.asText();
        const texts = []; xml.replace(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g,(_,t)=>texts.push(t));
        const joined = texts.join('');
        for (const m of joined.matchAll(/\{\{([A-Za-z_][A-Za-z0-9_]*)\}\}/g)) tags.add(m[1]);
        for (const m of joined.matchAll(/\{%([A-Za-z_][A-Za-z0-9_]*)\}/g))    tags.add(m[1]);
      } catch {}
    });
    return tags;
  } catch { return new Set(); }
}

// ── QR codes ──────────────────────────────────────────────────────────────────
const EMPTY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64'
);
async function makeQR(url) {
  if (!url) return EMPTY_PNG;
  return QRCode.toBuffer(url,{type:'png',width:400,margin:1});
}

// ── Fill .docx ────────────────────────────────────────────────────────────────
// Image placeholders in Word: {%QR_CODE_1}  {%QR_CODE_2}  (single brace + %)
async function fillDocx(templatePath, data) {
  const zip = new PizZip(fs.readFileSync(templatePath,'binary'));
  const imgMod = new ImageModule({
    centered: false,
    getImage: v => (typeof v === 'string' && v.length > 0 ? Buffer.from(v, 'base64') : EMPTY_PNG),
    getSize:  ()=> [79,79],   // 2.1cm × 2.1cm at 96 dpi
  });
  const doc = new Docxtemplater(zip,{
    modules:[imgMod], paragraphLoop:true, linebreaks:true,
    delimiters:{start:'{{',end:'}}'},
    nullGetter:()=>'',
  });
  doc.render(data);
  return doc.getZip().generate({type:'nodebuffer',compression:'DEFLATE'});
}

// ── Convert .docx → PDF ───────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function toPDF(soffice, docxPath, outDir) {
  const cmd = `"${soffice}" --headless --norestore --convert-to pdf --outdir "${outDir}" "${docxPath}"`;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      execSync(cmd, {timeout:60000, stdio:'pipe'});
    } catch(e) {
      const detail = (e.stderr && e.stderr.toString().trim()) || (e.stdout && e.stdout.toString().trim()) || e.message;
      if (attempt === 1) { await sleep(2000); continue; }
      throw new Error(detail || 'LibreOffice conversion failed');
    }
    // Verify the PDF was actually produced (LibreOffice can exit 0 with no output)
    const expectedPDF = path.join(outDir, path.basename(docxPath, '.docx') + '.pdf');
    if (fs.existsSync(expectedPDF)) return; // success
    if (attempt === 1) { await sleep(2000); continue; }
    throw new Error(
      'LibreOffice opened the file but produced no PDF.\n' +
      '  FIX: Open this template in Microsoft Word → File → Save As → Word Document (.docx)\n' +
      '  This re-saves it cleanly so LibreOffice can process it.'
    );
  }
}

// ── err helper ────────────────────────────────────────────────────────────────
function logErr(doc, step, err) {
  console.log(`\n  [ERROR] Document: ${doc} | Step: ${step} | Reason: ${err.message.split('\n')[0]}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.clear();
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║    RIVERS STATE VEHICLE DOCUMENT GENERATOR  v5       ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');

  // 1. LibreOffice
  const soffice = findLibreOffice();
  if (!soffice) { console.error('  ✖  LibreOffice not found.\n  ▶  https://www.libreoffice.org/download/\n'); process.exit(1); }
  console.log(`  ✔  LibreOffice: ${soffice}\n`);

  // 2. Scan templates
  if (!fs.existsSync(DOCS_DIR)) { console.error(`  ✖  Folder missing: ${DOCS_DIR}`); process.exit(1); }
  let allTemplates;
  try { allTemplates = fs.readdirSync(DOCS_DIR).filter(f=>/\.docx$/i.test(f)).sort(); }
  catch(e) { console.error('[ERROR] Step: scan templates | Reason: '+e.message); process.exit(1); }
  if (!allTemplates.length) { console.error("  ✖  No .docx files in DOC's folder."); process.exit(1); }

  const rl = readline.createInterface({input:process.stdin,output:process.stdout});

  // 3. Document selection
  console.log('  Available templates:');
  allTemplates.forEach((f,i)=>console.log(`    ${String(i+1).padStart(2)}.  ${f}`));

  const selRaw = await ask(rl,'  \nSelect documents (e.g. 1,3 or Enter for all): ');
  let selected;
  if (!selRaw.trim()) {
    selected=allTemplates; console.log(`  → All ${allTemplates.length} selected.\n`);
  } else {
    const nums=[...new Set(selRaw.split(',').map(n=>parseInt(n.trim())).filter(n=>n>=1&&n<=allTemplates.length))].sort((a,b)=>a-b);
    if (!nums.length) { console.error('  ✖  Invalid selection.'); rl.close(); process.exit(1); }
    selected=nums.map(n=>allTemplates[n-1]);
    console.log(`  → ${selected.length} template(s) selected.\n`);
  }

  // 4. Detect required placeholders
  console.log('  Scanning selected documents for required fields...');
  const required = new Set(['PLATE_NUMBER']); // always need plate for file naming
  for (const f of selected) {
    try {
      const tags = detectPlaceholders(path.join(DOCS_DIR,f));
      for (const t of tags) required.add(getBaseField(t));
    } catch(e) { logErr(f,'scan placeholders',e); }
  }
  const needsRegDate  = required.has('REG_DATE');
  const needsExpiry   = required.has('EXPIRY_DATE');
  const needsCategory = needsRegDate || needsExpiry;
  required.delete('EXPIRY_DATE'); // auto-calculated
  console.log(`  Found ${required.size} field(s) to collect.\n`);
  console.log('  ─────────────────────────────────────────────────────\n');

  // 5. Collect inputs (canonical order, only detected fields)
  const inp = {};
  for (const field of PROMPT_ORDER) {
    if (!required.has(field)) continue;
    let val = await ask(rl, FIELD_PROMPTS[field] || `  ${field}: `);
    if (field==='PLATE_NUMBER') val=val.toUpperCase();
    inp[field]=val;
  }

  // Category (if needed for expiry)
  if (needsCategory) {
    let cat='';
    while (!['private','commercial'].includes(cat.toLowerCase())) {
      cat=await ask(rl,"  Category (Private / Commercial)              : ");
      if (!['private','commercial'].includes(cat.toLowerCase())) console.log('  ⚠  Type Private or Commercial.\n');
    }
    inp.CATEGORY=cat;
  }

  // QR URLs
  const wantsQR1=required.has('QR_CODE_1'), wantsQR2=required.has('QR_CODE_2');
  if (wantsQR1) inp.QR_CODE_1_URL=await ask(rl,FIELD_PROMPTS.QR_CODE_1);
  if (wantsQR2) inp.QR_CODE_2_URL=await ask(rl,FIELD_PROMPTS.QR_CODE_2);
  rl.close();

  // 6. Calculate expiry
  let EXPIRY_DATE='';
  if (needsCategory && inp.REG_DATE) {
    try { EXPIRY_DATE=calcExpiry(inp.REG_DATE,inp.CATEGORY); console.log(`\n  ✔  Expiry: ${EXPIRY_DATE}  (${inp.CATEGORY})`); }
    catch(e) { console.error('  ✖ ',e.message); process.exit(1); }
  }

  // 7. Build DATA
  const catLabel=inp.CATEGORY ? inp.CATEGORY.charAt(0).toUpperCase()+inp.CATEGORY.slice(1).toLowerCase() : '';
  const DATA={};
  for (const [k,v] of Object.entries(inp)) {
    if (['CATEGORY','QR_CODE_1_URL','QR_CODE_2_URL'].includes(k)) continue;
    DATA[k]=v;
  }
  if (needsCategory)    DATA.CATEGORY=catLabel;
  if (needsExpiry||needsRegDate) DATA.EXPIRY_DATE=EXPIRY_DATE;
  
  // Parse and format base dates
  const dateObjs = {};
  if (DATA.REG_DATE)    { try { dateObjs.REG_DATE    = parseMonYear(DATA.REG_DATE);    DATA.REG_DATE    = fmtDD(dateObjs.REG_DATE);    } catch {} }
  if (DATA.EXPIRY_DATE) { try { dateObjs.EXPIRY_DATE = parseMonYear(DATA.EXPIRY_DATE); DATA.EXPIRY_DATE = fmtDD(dateObjs.EXPIRY_DATE); } catch {} }
  if (DATA.pfRegData)   { try { dateObjs.pfRegData   = parseMonYear(DATA.pfRegData);   DATA.pfRegData   = fmtMY(dateObjs.pfRegData);   } catch {} }
  if (DATA.pfEXData)    { try { dateObjs.pfEXData    = parseMonYear(DATA.pfEXData);    DATA.pfEXData    = fmtMY(dateObjs.pfEXData);    } catch {} }
  if (!DATA.PREVIOUS_NUMBER) DATA.PREVIOUS_NUMBER='';

  // Generate Variants
  const TEXT_FIELDS = ['CATEGORY','OWNER_NAME','VEHICLE_TYPE','VEHICLE_MAKE','MODEL','COLOUR','STATE','ADDRESS'];
  for (const f of TEXT_FIELDS) {
    if (DATA[f] !== undefined) {
      const val = String(DATA[f] || '');
      DATA[`${f}_UPPER`] = val.toUpperCase();
      DATA[`${f}_LOWER`] = val.toLowerCase();
      DATA[`${f}_TITLE`] = toTitleCase(val);
    }
  }

  const DATE_FIELDS = ['REG_DATE','EXPIRY_DATE','pfRegData','pfEXData'];
  const MON_FULL = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
  for (const f of DATE_FIELDS) {
    const dObj = dateObjs[f];
    if (dObj) {
      const p=n=>String(n).padStart(2,'0');
      DATA[`${f}_DASHED`] = `${p(dObj.getDate())}-${p(dObj.getMonth()+1)}-${dObj.getFullYear()}`;
      DATA[`${f}_SLASH`]  = `${p(dObj.getDate())}/${p(dObj.getMonth()+1)}/${dObj.getFullYear()}`;
      DATA[`${f}_SHORT`]  = `${MON_NAME[dObj.getMonth()]} ${dObj.getFullYear()}`;
      DATA[`${f}_LONG`]   = `${MON_FULL[dObj.getMonth()]} ${dObj.getFullYear()}`;
    } else if (DATA[f] !== undefined) {
      DATA[`${f}_DASHED`] = DATA[f];
      DATA[`${f}_SLASH`]  = DATA[f];
      DATA[`${f}_SHORT`]  = DATA[f];
      DATA[`${f}_LONG`]   = DATA[f];
    }
  }

  // QR buffers
  if (wantsQR1||wantsQR2) {
    process.stdout.write('\n  Generating QR codes...');
    if (wantsQR1) { try { DATA.QR_CODE_1=(await makeQR(inp.QR_CODE_1_URL)).toString('base64'); } catch(e) { DATA.QR_CODE_1=EMPTY_PNG.toString('base64'); logErr('QR_CODE_1','generate QR',e); } }
    if (wantsQR2) { try { DATA.QR_CODE_2=(await makeQR(inp.QR_CODE_2_URL)).toString('base64'); } catch(e) { DATA.QR_CODE_2=EMPTY_PNG.toString('base64'); logErr('QR_CODE_2','generate QR',e); } }
    console.log(' ✔');
  }

  console.log(`\n  Generating ${selected.length} document(s)...\n`);

  // 8. Output path
  let cfg=loadConfig();
  if (!cfg) {
    console.log('  ┌──────────────────────────────────────────────────────┐');
    console.log('  │  First run — where should PDFs be saved?             │');
    console.log('  └──────────────────────────────────────────────────────┘');
    console.log(`  Press Enter for Desktop (${defaultBase()}):\n`);
    const rl2=readline.createInterface({input:process.stdin,output:process.stdout});
    const v=await new Promise(r=>rl2.question('  Output folder: ',a=>r(a.trim()))); rl2.close();
    const chosen=v||defaultBase(); cfg={outputBase:chosen}; saveConfig(cfg);
    console.log(`  ✔  Saved: ${chosen}\n`);
  }

  const safePlate=(inp.PLATE_NUMBER||'UNKNOWN').replace(/[^A-Z0-9]/gi,'');
  let jobFolder;
  try { jobFolder=getJobFolder(cfg.outputBase,safePlate); }
  catch(e) { console.error('[ERROR] Step: create output folder | Reason: '+e.message); process.exit(1); }
  try { fs.mkdirSync(TEMP_DIR,{recursive:true}); }
  catch(e) { console.error('[ERROR] Step: create temp folder | Reason: '+e.message); process.exit(1); }

  // 9. Process
  // Kill any lingering LibreOffice instances before batch starts
  try { execSync('taskkill /f /im soffice.exe', {stdio:'pipe'}); await sleep(1000); } catch {}

  let ok=0, fail=0;
  for (const tmplFile of selected) {
    const origIdx=allTemplates.indexOf(tmplFile)+1;
    // Sanitize temp name — strip parenthetical words e.g. (AutoRecovered), (1)
    const cleanName=tmplFile.replace(/\s*\([^)]*\)/g,'').replace(/\s+/g,'_').replace(/\.docx$/i,'');
    const outBase=`${safePlate}_doc${String(origIdx).padStart(2,'0')}_${cleanName}`;
    const tmpDocx=path.join(TEMP_DIR,`${safePlate}_doc${String(origIdx).padStart(2,'0')}.docx`);
    process.stdout.write(`  ${tmplFile.padEnd(44)}`);
    let step='fill template';
    try {
      const buf=await fillDocx(path.join(DOCS_DIR,tmplFile),DATA);
      step='write temp file';
      fs.writeFileSync(tmpDocx,buf);
      step='convert to PDF';
      await toPDF(soffice,tmpDocx,jobFolder);
      console.log(`✔  ${outBase}.pdf`);
      ok++;
    } catch(err) {
      console.log('✖');
      logErr(tmplFile,step,err);
      // Keep the failed .docx for inspection
      try { fs.copyFileSync(tmpDocx, path.join(jobFolder, `FAILED_${outBase}.docx`)); } catch {}
      fail++;
    }
  }

  // 10. Cleanup
  try { fs.rmSync(TEMP_DIR,{recursive:true,force:true}); } catch {}

  // 11. Summary
  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`  ✔  Successfully generated: ${ok} document(s)`);
  if (fail) console.log(`  ✘  Failed: ${fail} document(s)  (see errors above)`);
  console.log(`  📁  ${jobFolder}`);
  console.log('═══════════════════════════════════════════════════════\n');
}

// ── Entry point ───────────────────────────────────────────────────────────────
if (process.argv.includes('--setpath')) {
  handleSetPath().catch(e=>{console.error('Error:',e.message);process.exit(1);});
} else {
  main().catch(e=>{console.error('\n  ✖ Fatal:',e.message);process.exit(1);});
}
