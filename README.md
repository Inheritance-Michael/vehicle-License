# Rivers State Vehicle Document Generator
### Version 6 — Documentation

---

## Overview

This tool runs entirely on your PC with no internet connection required.  
Enter vehicle details **once** in the terminal and the tool fills them into your Word templates, converts each to a PDF, and saves them in a timestamped folder on your Desktop (or custom path).

**Tech stack:** Node.js · docxtemplater · docxtemplater-image-module-free · qrcode · LibreOffice

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

To change where PDFs are saved:
```
node generate.js --setpath
```

---

## Step-by-Step Workflow

### 1 — Select documents

At startup the tool lists all `.docx` files in the `DOC's` folder:
```
  Available templates:
   1.  Nicon commercial.docx
   2.  PROOF FR.docx
   3.  QUICKTELLER PAYMENT.docx
   4.  RIVERS MOT - .docx
   5.  RW FR.docx

  Select documents (e.g. 1,3 or Enter for all):
```
- Type numbers separated by commas to pick specific documents: `1,3,5`
- Press **Enter** with nothing typed to generate **all** documents

---

### 2 — Smart prompting

The tool **scans every selected document** and only asks for the fields those documents actually use.  
If none of your selected documents contain `{{isprice}}`, you will never be asked for the insurance price.

---

### 3 — Enter vehicle details

| Prompt | Description | Example |
|---|---|---|
| Owner's Name | Full name of vehicle owner | `INI ENO MICHEAL` |
| Phone Number | Contact phone number | `09044055271` |
| Number Plate | Vehicle registration plate (auto-uppercased) | `FST270DM` |
| Passengers Number | Number of passengers / previous plate — optional | `5` |
| Vehicle Make | Brand of vehicle | `Toyota` |
| Model | Vehicle model | `Matrix` |
| Vehicle Type / Body Type | Type exactly as needed | `Saloon` |
| Colour | Vehicle colour | `Blue` |
| Chassis Number | VIN / chassis number | `2T1KR32E67C624815` |
| Engine Number | Engine number | `1ZZ8518186` |
| State | State of registration | `Rivers` |
| Address | Owner's address | `62 JETTY ROAD IBENO PHC` |
| Registration Date | Date of registration — see date formats below | `09/05/2026` |
| Insurance Price | Amount for insurance | `20000` |
| Insurance Top Data | Insurance reference code | `PC/2026/05` |
| Proof Reg Date | Registration date for proof document | `MAY 2026` |
| Proof Expiry Date | Expiry date for proof document | `MAY 2027` |
| Category | `Private` or `Commercial` | `Private` |
| Proof Code URL | URL to encode as QR Code 1 — press Enter to skip | `https://example.com` |
| GMR QR Code URL | URL to encode as QR Code 2 — press Enter to skip | `https://example.com` |

---

### 4 — Automatic calculations

**Expiry Date** is calculated automatically from the Registration Date:

| Category | Expiry |
|---|---|
| Private | +1 year from Registration Date |
| Commercial | +6 months from Registration Date |

You do **not** type the expiry date — it fills `{{EXPIRY_DATE}}` automatically.

---

### 5 — PDFs are generated

Each selected template is filled and converted. PDFs are saved to a timestamped folder:
```
Desktop/VehicleOutput/2026-05-10_14-30_FST270DM/
  Nicon commercial.pdf
  PROOF FR.pdf
  ...
```

A summary is printed at the end:
```
  ✔  Successfully generated: 3 document(s)
  ✘  Failed: 0 document(s)
  📁  C:\Users\...\VehicleOutput\2026-05-10_14-30_FST270DM
```

---

## Accepted Date Formats

For **Registration Date**, **Proof Reg Date**, and **Proof Expiry Date**, you can type either:

| Format | Example |
|---|---|
| `DD/MM/YYYY` | `09/05/2026` |
| `MON YYYY` | `MAY 2026` |

Both formats are accepted and converted automatically.

---

## Placeholder Tags

Place these tags in your Word documents exactly as shown. The tag inherits the font, size, and style of the surrounding text.

### Base Tags (no variants)
| Tag | Replaced with |
|---|---|
| `{{CHASSIS_NUMBER}}` | Chassis Number |
| `{{ENGINE_NUMBER}}` | Engine Number |
| `{{PHONE_NUMBER}}` | Phone Number |
| `{{PLATE_NUMBER}}` | Number Plate (always uppercase) |
| `{{PREVIOUS_NUMBER}}` | Passengers Number / Previous Plate |
| `{{isprice}}` | Insurance Price |
| `{{isData}}` | Insurance Top Data |

### Tags with Text Variants
For the following fields, you can use the base tag **or any of its case variants**:

| Base Tag | `_UPPER` | `_LOWER` | `_TITLE` |
|---|---|---|---|
| `{{CATEGORY}}` | `{{CATEGORY_UPPER}}` | `{{CATEGORY_LOWER}}` | `{{CATEGORY_TITLE}}` |
| `{{OWNER_NAME}}` | `{{OWNER_NAME_UPPER}}` | `{{OWNER_NAME_LOWER}}` | `{{OWNER_NAME_TITLE}}` |
| `{{VEHICLE_TYPE}}` | `{{VEHICLE_TYPE_UPPER}}` | `{{VEHICLE_TYPE_LOWER}}` | `{{VEHICLE_TYPE_TITLE}}` |
| `{{VEHICLE_MAKE}}` | `{{VEHICLE_MAKE_UPPER}}` | `{{VEHICLE_MAKE_LOWER}}` | `{{VEHICLE_MAKE_TITLE}}` |
| `{{MODEL}}` | `{{MODEL_UPPER}}` | `{{MODEL_LOWER}}` | `{{MODEL_TITLE}}` |
| `{{COLOUR}}` | `{{COLOUR_UPPER}}` | `{{COLOUR_LOWER}}` | `{{COLOUR_TITLE}}` |
| `{{STATE}}` | `{{STATE_UPPER}}` | `{{STATE_LOWER}}` | `{{STATE_TITLE}}` |
| `{{ADDRESS}}` | `{{ADDRESS_UPPER}}` | `{{ADDRESS_LOWER}}` | `{{ADDRESS_TITLE}}` |

**Example:** If the user types `rivers`, then:
- `{{STATE}}` → `rivers`
- `{{STATE_UPPER}}` → `RIVERS`
- `{{STATE_TITLE}}` → `Rivers`

### Tags with Date Variants
For the following date fields, you can use the base tag **or any date format variant**:

| Base Tag | `_DASHED` | `_SLASH` | `_SHORT` | `_LONG` |
|---|---|---|---|---|
| `{{REG_DATE}}` | `{{REG_DATE_DASHED}}` | `{{REG_DATE_SLASH}}` | `{{REG_DATE_SHORT}}` | `{{REG_DATE_LONG}}` |
| `{{EXPIRY_DATE}}` | `{{EXPIRY_DATE_DASHED}}` | `{{EXPIRY_DATE_SLASH}}` | `{{EXPIRY_DATE_SHORT}}` | `{{EXPIRY_DATE_LONG}}` |
| `{{pfRegData}}` | `{{pfRegData_DASHED}}` | `{{pfRegData_SLASH}}` | `{{pfRegData_SHORT}}` | `{{pfRegData_LONG}}` |
| `{{pfEXData}}` | `{{pfEXData_DASHED}}` | `{{pfEXData_SLASH}}` | `{{pfEXData_SHORT}}` | `{{pfEXData_LONG}}` |

**Example:** If Registration Date is `09/05/2026`, then:
- `{{REG_DATE}}` → `09/05/2026`
- `{{REG_DATE_DASHED}}` → `09-05-2026`
- `{{REG_DATE_SHORT}}` → `MAY 2026`
- `{{REG_DATE_LONG}}` → `MAY 2026`

> **Rule:** You only need to add the variant tags you actually want in your document. Unused variants are silently ignored. The user is **never asked for the same field twice**.

### QR Code Tags (Image)
| Tag | Description |
|---|---|
| `{{%QR_CODE_1}}` | QR code image for Proof document URL |
| `{{%QR_CODE_2}}` | QR code image for GMR document URL |

> **Important for QR codes:** Use `{{%TAG}}` (with the `%` symbol), not `{{TAG}}`. The image is inserted at **2.1cm × 2.1cm**.  
> Place the tag inside a **borderless 1×1 floating table** (Table Properties → Text Wrapping: Around). Do **not** use a Text Box.

---

## Adding New Templates

1. Create or edit a `.docx` file with any of the placeholder tags above
2. Drop it into the `DOC's` folder
3. Run the tool — it appears in the list automatically

No code changes needed. The tool auto-detects which fields each document uses.

---

## Project Structure

```
MRS QUEEN JOB/
├── generate.js          ← Main tool — run this
├── DOC's/               ← Word templates (.docx files with {{tags}})
├── package.json         ← Project config
├── config.json          ← Saved output path (auto-created on first run)
├── README.md            ← This documentation
└── node_modules/        ← Installed packages
```

---

## Troubleshooting

| Problem | Solution |
|---|---|
| `LibreOffice not found` | Install LibreOffice from https://www.libreoffice.org/download/ |
| `Cannot parse date` | Use format `09/05/2026` or `MAY 2026` |
| `No .docx files found` | Check that Word files are in the `DOC's` folder |
| PDF is blank or tag not replaced | Ensure the tag is typed exactly as shown — double curly braces, correct spelling |
| QR code area is blank in PDF | The `{{%QR_CODE_1}}` tag must be inside a floating table, not a text box |
| `~$filename.docx` appears in list | Close the Word document before running (temp file from Word being open) |
| `npm install` fails | Make sure Node.js is installed: run `node --version` to confirm |
| LibreOffice conversion fails | The tool auto-retries once. If it still fails, re-save the template from Word: File → Save As → Word Document |

---

## Quick Reference

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
