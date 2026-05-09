# Rivers State Vehicle Document Generator
### Version 4 — Documentation

---

## Overview

This tool runs entirely on your PC with no internet connection.  
You enter vehicle registration details **once** in the terminal, and the tool fills them into your Word document templates and converts each one to a PDF automatically.

**Tech stack:** Node.js · docxtemplater · LibreOffice

---

## One-Time Setup

### Step 1 — Install Node.js *(skip if already installed)*
Download from: https://nodejs.org  
Choose the **LTS** version. Install with all defaults.

### Step 2 — Install LibreOffice *(skip if already installed)*
Download from: https://www.libreoffice.org/download/  
Install with all defaults. ~340 MB. Free and open-source.

### Step 3 — Install project dependencies
Open a terminal in this folder and run once:
```
npm install
```

---

## How to Run

Open **PowerShell or Command Prompt** in the project folder and type:
```
node generate.js
```

---

## Step-by-Step Workflow

### 1 — Select documents

At startup the tool lists all `.docx` files found in the `DOC's` folder:
```
  Available templates:
   1.  NEW PROOF FR (AutoRecovered).docx  *
   2.  Nicon commercial.docx
   3.  QUICKTELLER PAYMENT.docx
   4.  RIVERS MOT - .docx
   5.  RW FR.docx

  Select documents (e.g. 1,3 or Enter for all):
```
- Type numbers separated by commas to pick specific documents: `1,3,5`
- Press **Enter** with nothing typed to generate **all** documents

> `*` means this document has an automatic layout fix applied (see below).

---

### 2 — Enter vehicle details

You will be asked for each field one at a time:

| Prompt | Description | Example |
|---|---|---|
| Owner's Name | Full name of vehicle owner | `INI ENO MICHEAL` |
| Phone Number | Contact phone number | `09044055271` |
| Number Plate | Vehicle registration plate (auto-uppercased) | `FST270DM` |
| Passengers Number | Number of passengers / previous plate — optional, press Enter to skip | `5` |
| Vehicle Make | Brand of vehicle | `Toyota` |
| Model | Vehicle model | `Matrix` |
| Vehicle Type / Body Type | Free text — type exactly as needed | `Saloon` |
| Colour | Vehicle colour | `Blue` |
| Chassis Number | VIN / chassis number | `2T1KR32E67C624815` |
| Engine Number | Engine number | `1ZZ8518186` |
| State | State of registration | `Rivers` |
| Address | Owner's address | `62 JETTY ROAD IBENO PHC` |
| Registration Date | Date of registration — **see date formats below** | `09/05/2026` |
| Insurance Price | Amount for insurance | `20000` |
| Insurance Top Data | Insurance reference code | `PC/2026/05` |
| Proof Reg Date | Registration date for proof document | `MAY 2026` |
| Proof Expiry Date | Expiry date for proof document | `MAY 2027` |
| Category | `Private` or `Commercial` | `Private` |

---

### 3 — Automatic calculations

**Expiry Date** is calculated automatically from the Registration Date:

| Category | Expiry |
|---|---|
| Private | +1 year from Registration Date |
| Commercial | +6 months from Registration Date |

You do **not** type the expiry date — it is filled into `{{EXPIRY_DATE}}` automatically.

---

### 4 — PDFs are generated

The tool fills all selected templates and saves the PDFs to the `output/` folder:
```
output/
  FST270DM_doc01.pdf
  FST270DM_doc02.pdf
  ...
```
Each PDF is named: `{PLATE NUMBER}_doc{NUMBER}.pdf`

---

## Accepted Date Formats

For **Registration Date**, **Proof Reg Date**, and **Proof Expiry Date**, you can type either:

| Format | Example |
|---|---|
| `DD/MM/YYYY` | `09/05/2026` |
| `MON YYYY` | `MAY 2026` |

Both are accepted and converted automatically.

---

## Placeholder Tags

Add these tags to your Word documents exactly as shown. When the tool runs, each tag is replaced with the value you typed. The tag inherits the font, size, and style of the surrounding text — so type each tag in the same style as the rest of that line.

| Tag | Replaced with |
|---|---|
| `{{OWNER_NAME}}` | Owner's Name |
| `{{PHONE_NUMBER}}` | Phone Number |
| `{{PLATE_NUMBER}}` | Number Plate |
| `{{PREVIOUS_NUMBER}}` | Passengers Number |
| `{{VEHICLE_MAKE}}` | Vehicle Make |
| `{{MODEL}}` | Model |
| `{{VEHICLE_TYPE}}` | Vehicle Type / Body Type |
| `{{COLOUR}}` | Colour |
| `{{CHASSIS_NUMBER}}` | Chassis Number |
| `{{ENGINE_NUMBER}}` | Engine Number |
| `{{STATE}}` | State |
| `{{ADDRESS}}` | Address |
| `{{REG_DATE}}` | Registration Date (as entered) |
| `{{EXPIRY_DATE}}` | **Auto-calculated** expiry date |
| `{{CATEGORY}}` | Private or Commercial |
| `{{isprice}}` | Insurance Price |
| `{{isData}}` | Insurance Top Data |
| `{{pfRegData}}` | Proof Reg Date |
| `{{pfEXData}}` | Proof Expiry Date |

---

## Adding New Templates

1. Create or edit a `.docx` file with the placeholder tags above
2. Drop it into the `DOC's` folder
3. Run the tool — it appears in the list automatically

No code changes needed.

---

## Layout Fix — NEW PROOF F Document

The document named `NEW PROOF FR` has a specific line where `{{VEHICLE_TYPE}}` and `{{COLOUR}}` sit on the same line separated by tab characters:
```
[Vehicle Type]    [TAB TAB TAB TAB]    [Colour]
```
If the vehicle type text is longer than **29 characters**, the tabs are pushed forward and the colour value shifts out of position. The tool fixes this automatically:
- Vehicle type ≤ 29 characters → line untouched
- Vehicle type > 29 characters → one tab removed from between the two values

This fix is applied **only** to the NEW PROOF F document. All other documents are untouched.

---

## Project Structure

```
MRS QUEEN JOB/
├── generate.js          ← Main tool — run this
├── DOC's/               ← Word templates (.docx files with {{tags}})
├── output/              ← Generated PDFs appear here
├── package.json         ← Project config
├── README.md            ← This documentation
└── node_modules/        ← Installed packages (docxtemplater, pizzip)
```

---

## Troubleshooting

| Problem | Solution |
|---|---|
| `LibreOffice not found` | Install LibreOffice from https://www.libreoffice.org/download/ |
| `Cannot parse date` | Use format `09/05/2026` or `MAY 2026` |
| `No .docx files found` | Check that Word files are in the `DOC's` folder |
| A PDF is blank or wrong | Check that the `{{tag}}` placeholders are typed exactly as shown in the table above |
| `~$filename.docx` appears in list | Close the Word document before running the tool (temp file from Word being open) |
| `npm install` fails | Make sure Node.js is installed. Run `node --version` to confirm |

---

## Quick Reference Card

```
# Normal run:
node generate.js

# Change where PDFs are saved:
node generate.js --setpath

# Workflow:
1. Run the tool
2. Choose which documents (or press Enter for all)
3. Fill in each field when prompted
4. Find your PDFs in the timestamped job folder shown at the end
```
