# Návod: Jak napojit nový Google Sheet

## Krok 1: Získej ID Google Sheetu

1. Otevři svůj Google Sheet "new"
2. Podívej se na URL v prohlížeči:
   ```
   https://docs.google.com/spreadsheets/d/TADY_JE_ID_SHEETU/edit
   ```
3. Zkopíruj si dlouhou část mezi `/d/` a `/edit` - to je **SPREADSHEET_ID**

## Krok 2: Nastav Google Apps Script (pro Export)

1. V Google Sheetu klikni na **Extensions** (Rozšíření) → **Apps Script**
2. Otevře se editor skriptu
3. Smaž veškerý výchozí kód
4. Zkopíruj celý kód ze souboru `GOOGLE_APPS_SCRIPT_CODE.gs` v projektu
5. **DŮLEŽITÉ:** Na řádku 8 změň:
   ```javascript
   const SPREADSHEET_ID = 'YOUR_GOOGLE_SHEET_ID';
   ```
   Na:
   ```javascript
   const SPREADSHEET_ID = 'tvoje_ID_které_jsi_zkopíroval';
   ```
6. Na řádku 9 zkontroluj název listu (worksheet):
   ```javascript
   const WORKSHEET_NAME = 'Work Hours';
   ```
   Pokud chceš jiný název, změň ho (např. 'new' nebo 'Data')

7. Ulož skript (Ctrl+S nebo File → Save)
8. Pojmenuj projekt (např. "Work Hours Sync")

## Krok 3: Nasaď Apps Script jako Web App

1. V editoru Apps Script klikni na **Deploy** (Nasadit) → **New deployment** (Nové nasazení)
2. Klikni na ikonu ozubeného kola a vyber **Web app**
3. Nastav:
   - **Description:** "Work Hours Tracker Sync"
   - **Execute as:** Me (tvůj email)
   - **Who has access:** Anyone (Kdokoliv)
4. Klikni **Deploy** (Nasadit)
5. Autorizuj přístup (budete muset povolit přístup ke svému Google účtu)
6. **ZKOPÍRUJ SI WEB APP URL** - vypadá takto:
   ```
   https://script.google.com/macros/s/NĚJAKÝ_DLOUHÝ_KÓD/exec
   ```
   **Toto je tvoje EXPORT URL!**

## Krok 4: Publikuj Sheet jako CSV (pro Import)

1. V Google Sheetu klikni na **File** → **Share** → **Publish to web**
2. V dialogu nastav:
   - První dropdown: Vyber list, který chceš publikovat (např. "Work Hours" nebo "new")
   - Druhý dropdown: Vyber **Comma-separated values (.csv)**
3. Klikni **Publish** (Publikovat)
4. **ZKOPÍRUJ SI CSV URL** - vypadá takto:
   ```
   https://docs.google.com/spreadsheets/d/TVOJE_ID/pub?gid=0&single=true&output=csv
   ```
   **Toto je tvoje IMPORT CSV URL!**

## Krok 5: Zadej URL do aplikace

1. Otevři aplikaci Work Hours Tracker
2. Jdi do **Data Manager**
3. Klikni na **Sync Settings** (ikona ozubeného kola)
4. Zadej:
   - **Import CSV URL:** Vlož CSV URL ze kroku 4
   - **Export URL:** Vlož Web App URL ze kroku 3
5. (Volitelně) Zapni **auto-import** a nastav interval
6. Klikni **Save Settings**

## Testování

1. Zkus kliknout na **"Import from CSV"** - mělo by načíst data ze sheetu
2. Zkus kliknout na **"Export to Sheets"** - mělo by zapsat data do sheetu
3. Otevři Google Sheet a zkontroluj, že se data objevila

## Možné problémy

### "Failed to export data to Google Sheets"
- Zkontroluj, že jsi správně nasadil Apps Script jako Web App
- Zkontroluj, že přístup je nastaven na "Anyone"
- Zkontroluj, že SPREADSHEET_ID v Apps Script je správné

### "Failed to sync data from CSV"
- Zkontroluj, že jsi publikoval správný list jako CSV
- Zkontroluj, že CSV URL končí na `output=csv`
- Zkus CSV URL otevřít v prohlížeči - měla by se stáhnout CSV data

### Data se neukládají správně
- Zkontroluj, že název listu (WORKSHEET_NAME) v Apps Script odpovídá názvu listu v Google Sheetu
- Pokud list neexistuje, skript ho automaticky vytvoří

## Formát dat v Google Sheetu

Apps Script automaticky vytvoří tabulku s těmito sloupci:
- Date (Datum)
- Day of Week (Den v týdnu)
- Start Time (Čas začátku)
- End Time (Čas konce)
- Hours Worked (Odpracované hodiny)
- Earnings (CZK) (Výdělek)
- Last Updated (Poslední aktualizace)
