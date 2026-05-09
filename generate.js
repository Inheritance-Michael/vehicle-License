'use strict';
const readline = require('readline');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { execSync, spawnSync } = require('child_process');

const DOCS_DIR    = path.join(__dirname, "DOC's");
const TEMP_DIR    = path.join(__dirname, '.tmp_filled');
const CONFIG_PATH = path.join(__dirname, 'config.json');


// ── Config (output path) ─────────────────────────────────────────────────────
function loadConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); } catch { return null; }
}
function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}
function defaultOutputBase() {
  return path.join(os.homedir(), 'Desktop');
}
function getJobFolder(outputBase, safePlate) {
  const now = new Date();
  const p2  = n => String(n).padStart(2,'0');
  const stamp = `${now.getFullYear()}-${p2(now.getMonth()+1)}-${p2(now.getDate())}_${p2(now.getHours())}-${p2(now.getMinutes())}`;
  const folder = path.join(outputBase, 'VehicleOutput', `${stamp}_${safePlate}`);
  fs.mkdirSync(folder, { recursive: true });
  return folder;
}
async function handleSetPath() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log('\n  Enter a new output folder path.');
  console.log(`  Press Enter to use Desktop (${defaultOutputBase()}):\n`);
  const input = await new Promise(r => rl.question('  New path: ', a => r(a.trim())));
  rl.close();
  const chosen = input || defaultOutputBase();
  saveConfig({ outputBase: chosen });
  console.log(`\n  ✔  Output location updated to:\n     ${chosen}\n`);
}

// ── LibreOffice ───────────────────────────────────────────────────────────────
function findLibreOffice() {
  const candidates = [
    'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
    'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
    'C:\\Program Files\\LibreOffice 7\\program\\soffice.exe',
    'C:\\Program Files\\LibreOffice 6\\program\\soffice.exe',
  ];
  for (const p of candidates) if (fs.existsSync(p)) return p;
  try {
    const r = spawnSync('where', ['soffice'], { encoding: 'utf8' });
    const line = (r.stdout || '').trim().split('\n')[0].trim();
    if (line && fs.existsSync(line)) return line;
  } catch {}
  return null;
}

// ── Date helpers ──────────────────────────────────────────────────────────────
const MON_IDX   = {JAN:0,FEB:1,MAR:2,APR:3,MAY:4,JUN:5,JUL:6,AUG:7,SEP:8,OCT:9,NOV:10,DEC:11};
const MON_NAMES = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
function parseMonYear(s) {
  const str = s.trim();
  // Accept DD/MM/YYYY  e.g. 09/05/2026
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
    const [dd, mm, yyyy] = str.split('/');
    return new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd));
  }
  // Accept MON YYYY  e.g. JUN 2026
  const [mon, yr] = str.toUpperCase().split(/[\s\-]+/);
  const m = MON_IDX[mon], y = parseInt(yr);
  if (isNaN(m) || isNaN(y))
    throw new Error(`Cannot parse "${s}". Use: JUN 2026  or  09/05/2026`);
  return new Date(y, m, 1);
}
function fmtMonYear(d) { return `${MON_NAMES[d.getMonth()]} ${d.getFullYear()}`; }
function calcExpiry(reg, cat) {
  const d = parseMonYear(reg);
  cat.toLowerCase() === 'commercial' ? d.setMonth(d.getMonth()+6) : d.setFullYear(d.getFullYear()+1);
  return fmtMonYear(d);
}

// ── Prompt helper ─────────────────────────────────────────────────────────────
const ask = (rl, q) => new Promise(r => rl.question(q, a => r(a.trim())));

// ── NEW PROOF F layout fix ────────────────────────────────────────────────────
const isNewProofF = f => /new proof f/i.test(f);

function applyNewProofFix(buffer, vehicleType, colour) {
  if (!vehicleType || vehicleType.trim().length <= 29) return buffer;
  const zip = new PizZip(buffer);
  const xmlFile = zip.file('word/document.xml');
  if (!xmlFile) return buffer;
  const xmlEsc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const vtEsc = xmlEsc(vehicleType.trim());
  const clEsc = xmlEsc(colour.trim());
  let xml = xmlFile.asText();
  xml = xml.replace(/(<w:p[ >][\s\S]*?<\/w:p>)/g, para => {
    if (!para.includes(vtEsc) || !para.includes(clEsc)) return para;
    const vtPos = para.indexOf(vtEsc);
    const clPos = para.indexOf(clEsc);
    if (vtPos < 0 || clPos <= vtPos) return para;
    const before  = para.slice(0, vtPos + vtEsc.length);
    const between = para.slice(vtPos + vtEsc.length, clPos);
    const after   = para.slice(clPos);
    return before + between.replace(/<w:tab\s*\/>/, '') + after;
  });
  zip.file('word/document.xml', xml);
  return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
}

// ── Fill .docx ────────────────────────────────────────────────────────────────
function fillDocx(templatePath, data, filename) {
  const zip = new PizZip(fs.readFileSync(templatePath, 'binary'));
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true, linebreaks: true,
    delimiters: { start: '{{', end: '}}' },
    nullGetter: () => '',
  });
  doc.render(data);
  let buf = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
  if (isNewProofF(filename)) buf = applyNewProofFix(buf, data.VEHICLE_TYPE, data.COLOUR);
  return buf;
}

// ── Convert .docx → PDF ───────────────────────────────────────────────────────
function toPDF(soffice, docxPath, outDir) {
  execSync(`"${soffice}" --headless --convert-to pdf --outdir "${outDir}" "${docxPath}"`,
    { timeout: 60000, stdio: 'pipe' });
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.clear();
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║    RIVERS STATE VEHICLE DOCUMENT GENERATOR  v4       ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');

  // 1. LibreOffice check
  const soffice = findLibreOffice();
  if (!soffice) {
    console.error('  ✖  LibreOffice not found. Download (free):\n');
    console.error('     https://www.libreoffice.org/download/\n');
    process.exit(1);
  }
  console.log(`  ✔  LibreOffice: ${soffice}\n`);

  // 2. Scan DOC's folder
  if (!fs.existsSync(DOCS_DIR)) { console.error(`  ✖  Folder missing: ${DOCS_DIR}`); process.exit(1); }
  const allTemplates = fs.readdirSync(DOCS_DIR).filter(f => /\.docx$/i.test(f)).sort();
  if (!allTemplates.length) { console.error('  ✖  No .docx files found in DOC\'s folder.'); process.exit(1); }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  // 3. Document selection
  console.log('  Available templates:');
  allTemplates.forEach((f, i) =>
    console.log(`    ${String(i+1).padStart(2)}.  ${f}${isNewProofF(f) ? '  *' : ''}`)
  );
  console.log('      (* = layout-fix applied automatically)\n');

  const selRaw = await ask(rl, '  Select documents (e.g. 1,3 or Enter for all): ');
  let selected;
  if (!selRaw.trim()) {
    selected = allTemplates;
    console.log(`  → All ${allTemplates.length} templates selected.\n`);
  } else {
    const nums = [...new Set(selRaw.split(',').map(n => parseInt(n.trim())).filter(n => n>=1 && n<=allTemplates.length))].sort((a,b)=>a-b);
    if (!nums.length) { console.error('  ✖  Invalid selection.'); rl.close(); process.exit(1); }
    selected = nums.map(n => allTemplates[n-1]);
    console.log(`  → ${selected.length} template(s) selected.\n`);
  }

  // 4. Input fields
  console.log('  ─────────────────────────────────────────────────────\n');
  const OWNER_NAME      = await ask(rl, "  Owner's Name                              : ");
  const PHONE_NUMBER    = await ask(rl, "  Phone Number                              : ");
  const PLATE_NUMBER    = (await ask(rl, "  Number Plate                              : ")).toUpperCase();
  const PREVIOUS_NUMBER = await ask(rl, "  Passengers Number  [Enter to skip]        : ");
  const VEHICLE_MAKE    = await ask(rl, "  Vehicle Make  (e.g. Toyota)               : ");
  const MODEL           = await ask(rl, "  Model  (e.g. Camry)                       : ");
  const VEHICLE_TYPE    = await ask(rl, "  Vehicle Type / Body Type  (e.g. Saloon)   : ");
  const COLOUR          = await ask(rl, "  Colour                                    : ");
  const CHASSIS_NUMBER  = await ask(rl, "  Chassis Number                            : ");
  const ENGINE_NUMBER   = await ask(rl, "  Engine Number                             : ");
  const STATE           = await ask(rl, "  State                                     : ");
  const ADDRESS         = await ask(rl, "  Address                                   : ");
  const REG_DATE        = await ask(rl, "  Registration Date  (DD/MM/YYYY)            : ");
  const isprice         = await ask(rl, "  Insurance Price                           : ");
  const isData          = await ask(rl, "  Insurance Top Data                        : ");
  const pfRegData       = await ask(rl, "  Proof Reg Date  (DD/MM/YYYY)              : ");
  const pfEXData        = await ask(rl, "  Proof Expiry Date (DD/MM/YYYY)             : ");

  let CATEGORY = '';
  while (!['private','commercial'].includes(CATEGORY.toLowerCase())) {
    CATEGORY = await ask(rl, "  Category (Private / Commercial)           : ");
    if (!['private','commercial'].includes(CATEGORY.toLowerCase()))
      console.log('  ⚠  Please type  Private  or  Commercial.\n');
  }
  rl.close();

  // 5. Auto-calculate expiry
  let EXPIRY_DATE;
  try { EXPIRY_DATE = calcExpiry(REG_DATE, CATEGORY); }
  catch(e) { console.error('\n  ✖ ', e.message); process.exit(1); }

  const catLabel = CATEGORY.charAt(0).toUpperCase() + CATEGORY.slice(1).toLowerCase();
  const DATA = {
    OWNER_NAME, PHONE_NUMBER, PLATE_NUMBER,
    PREVIOUS_NUMBER: PREVIOUS_NUMBER || '',
    VEHICLE_MAKE, MODEL, VEHICLE_TYPE, COLOUR,
    CHASSIS_NUMBER, ENGINE_NUMBER, STATE, ADDRESS,
    REG_DATE, EXPIRY_DATE, CATEGORY: catLabel,
    isprice, isData, pfRegData, pfEXData,
  };

  console.log(`\n  ✔  Expiry auto-set: ${EXPIRY_DATE}  (${catLabel})\n`);
  console.log(`  Generating ${selected.length} document(s)...\n`);

  // 6. Output path setup
  let cfg = loadConfig();
  if (!cfg) {
    // First run — ask where to save PDFs
    console.log('  ┌────────────────────────────────────────────────────────┐');
    console.log('  │  Welcome! This is your first time running this tool.   │');
    console.log('  │  Where would you like to save your generated PDFs?     │');
    console.log('  └────────────────────────────────────────────────────────┘');
    console.log(`  Press Enter to save to your Desktop (${defaultOutputBase()}):\n`);
    const rl2 = readline.createInterface({ input: process.stdin, output: process.stdout });
    const input = await new Promise(r => rl2.question('  Output folder path: ', a => r(a.trim())));
    rl2.close();
    const chosen = input || defaultOutputBase();
    cfg = { outputBase: chosen };
    saveConfig(cfg);
    console.log(`\n  ✔  Saved! Future PDFs will go to: ${chosen}\n`);
  }

  const safePlate = PLATE_NUMBER.replace(/[^A-Z0-9]/gi,'');
  const jobFolder = getJobFolder(cfg.outputBase, safePlate);
  fs.mkdirSync(TEMP_DIR, { recursive: true });
  let ok = 0, fail = 0;

  for (const tmplFile of selected) {
    const origIdx = allTemplates.indexOf(tmplFile) + 1;
    const outBase = `${safePlate}_doc${String(origIdx).padStart(2,'0')}`;
    const tmpDocx = path.join(TEMP_DIR, `${outBase}.docx`);
    process.stdout.write(`  ${tmplFile.padEnd(42)}`);
    try {
      fs.writeFileSync(tmpDocx, fillDocx(path.join(DOCS_DIR, tmplFile), DATA, tmplFile));
      toPDF(soffice, tmpDocx, jobFolder);
      console.log(`✔  ${outBase}.pdf`);
      ok++;
    } catch(err) {
      console.log(`✖  ${err.message.split('\n')[0].slice(0,55)}`);
      fail++;
    }
  }

  // 7. Cleanup
  try { fs.rmSync(TEMP_DIR, { recursive: true, force: true }); } catch {}

  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`  ✔  ${ok} generated    ✖  ${fail} failed`);
  console.log(`  📁  ${jobFolder}`);
  console.log('═══════════════════════════════════════════════════════\n');
}

// ── Entry point ───────────────────────────────────────────────────────────────
if (process.argv.includes('--setpath')) {
  handleSetPath().catch(e => { console.error('Error:', e.message); process.exit(1); });
} else {
  main().catch(e => { console.error('\n  ✖ Fatal:', e.message); process.exit(1); });
}
