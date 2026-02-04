# Google Apps Script - Obousměrná synchronizace

Tento návod ti pomůže nastavit **obousměrnou synchronizaci** mezi Time Tracker aplikací a Google Sheets.

## Co budeš potřebovat

1. Google účet
2. Nový Google Sheet

---

## Krok 1: Vytvoř nový Google Sheet

1. Jdi na [sheets.google.com](https://sheets.google.com)
2. Klikni na **+ Blank** pro vytvoření nového sheetu
3. Pojmenuj ho např. "Work Hours Tracker"
4. Z URL zkopíruj **Sheet ID** - je to dlouhý řetězec mezi `/d/` a `/edit`
   - Příklad: `https://docs.google.com/spreadsheets/d/`**1ABC123xyz**`/edit`

---

## Krok 2: Vytvoř Apps Script projekt

1. V Google Sheetu klikni na **Extensions** → **Apps Script**
2. Smaž vše v `Code.gs` a vlož následující kód:

```javascript
/**
 * Bidirectional Sync - Work Hours Tracker
 * Podporuje export I import dat
 */

// ============================================
// KONFIGURACE - UPRAV TYTO HODNOTY
// ============================================
const SPREADSHEET_ID = 'VLOZ_SHEET_ID_ZDE';  // Tvoje Sheet ID
const WORKSHEET_NAME = 'Work Hours';          // Název listu

// ============================================
// HLAVNÍ FUNKCE
// ============================================

/**
 * GET request - vrací data ze sheetu (pro import do aplikace)
 */
function doGet(e) {
  try {
    const data = readDataFromSheet();
    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        data: data
      }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * POST request - zapisuje data do sheetu (export z aplikace)
 */
function doPost(e) {
  try {
    const requestData = JSON.parse(e.postData.contents);

    // Podpora pro různé formáty požadavků
    let data = requestData.data || requestData;

    if (!data || !data.workHoursData) {
      return ContentService
        .createTextOutput(JSON.stringify({
          success: false,
          error: 'Invalid data format - missing workHoursData'
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const result = writeDataToSheet(data);

    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        message: 'Data synchronized successfully',
        recordsProcessed: result.recordsProcessed,
        lastSync: new Date().toISOString()
      }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    console.error('doPost error:', error);
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================
// ZÁPIS DO SHEETU
// ============================================

function writeDataToSheet(data) {
  const { workHoursData, hourlyRate, dailyHoursGoal, dailyGoal, monthlyGoal } = data;

  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let worksheet = spreadsheet.getSheetByName(WORKSHEET_NAME);

  // Vytvoř list pokud neexistuje
  if (!worksheet) {
    worksheet = spreadsheet.insertSheet(WORKSHEET_NAME);
  }

  // Vymaž stará data
  worksheet.clear();

  // Hlavičky
  const headers = [
    'Date',
    'Day',
    'Start Time',
    'End Time',
    'Estimated End',
    'Hours Worked',
    'Earnings',
    'Is Day Off',
    'Interrupts'
  ];

  // Metadata řádky
  const metaRows = [
    ['Hourly Rate', hourlyRate || 300, '', '', '', '', '', '', ''],
    ['Daily Hours Goal', dailyHoursGoal || dailyGoal || 8, '', '', '', '', '', '', ''],
    ['Monthly Goal', monthlyGoal || 50000, '', '', '', '', '', '', ''],
    ['Last Sync', new Date().toISOString(), '', '', '', '', '', '', ''],
    [] // Prázdný řádek
  ];

  // Zapiš hlavičky
  worksheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // Formátuj hlavičky
  const headerRange = worksheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#4285f4');
  headerRange.setFontColor('white');

  // Zapiš metadata
  worksheet.getRange(2, 1, metaRows.length, headers.length).setValues(metaRows);

  // Připrav data řádky
  const dataRows = [];
  let recordsProcessed = 0;

  for (const [date, record] of Object.entries(workHoursData)) {
    const dateObj = new Date(date + 'T00:00:00');
    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();

    // Zpracuj interrupts
    let interruptsStr = '';
    if (record.interrupts && Array.isArray(record.interrupts)) {
      interruptsStr = record.interrupts
        .map(i => `${i.start || ''}-${i.end || ''}`)
        .filter(s => s !== '-')
        .join(';');
    }

    dataRows.push([
      date,
      dayName,
      record.startTime || record.start_time || '',
      record.endTime || record.end_time || '',
      record.estimatedEndTime || record.estimated_end_time || '',
      record.workedHours || record.worked_hours || 0,
      record.earnings || 0,
      record.isDayOff || record.is_day_off ? 'true' : 'false',
      interruptsStr
    ]);
    recordsProcessed++;
  }

  // Seřaď podle data (nejnovější nahoře)
  dataRows.sort((a, b) => new Date(b[0]) - new Date(a[0]));

  // Zapiš data
  if (dataRows.length > 0) {
    const startRow = 7; // Po hlavičce a metadatech
    worksheet.getRange(startRow, 1, dataRows.length, headers.length).setValues(dataRows);

    // Formátování
    worksheet.getRange(startRow, 6, dataRows.length, 1).setNumberFormat('0.00');  // Hours
    worksheet.getRange(startRow, 7, dataRows.length, 1).setNumberFormat('#,##0'); // Earnings
  }

  // Automatická šířka sloupců
  worksheet.autoResizeColumns(1, headers.length);

  return { recordsProcessed };
}

// ============================================
// ČTENÍ ZE SHEETU
// ============================================

function readDataFromSheet() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const worksheet = spreadsheet.getSheetByName(WORKSHEET_NAME);

  if (!worksheet) {
    return {
      workHoursData: {},
      hourlyRate: 300,
      dailyHoursGoal: 8,
      monthlyGoal: 50000
    };
  }

  const allData = worksheet.getDataRange().getValues();

  if (allData.length < 6) {
    return {
      workHoursData: {},
      hourlyRate: 300,
      dailyHoursGoal: 8,
      monthlyGoal: 50000
    };
  }

  // Načti metadata
  let hourlyRate = 300;
  let dailyHoursGoal = 8;
  let monthlyGoal = 50000;

  for (let i = 1; i < Math.min(5, allData.length); i++) {
    const row = allData[i];
    const label = String(row[0]).toLowerCase();
    const value = parseFloat(row[1]);

    if (label.includes('hourly')) hourlyRate = value || 300;
    else if (label.includes('daily')) dailyHoursGoal = value || 8;
    else if (label.includes('monthly') && label.includes('goal')) monthlyGoal = value || 50000;
  }

  // Načti pracovní záznamy
  const workHoursData = {};

  for (let i = 6; i < allData.length; i++) {
    const row = allData[i];
    const date = String(row[0]);

    // Přeskoč prázdné řádky a neplatná data
    if (!date || !date.match(/\d{4}-\d{2}-\d{2}/)) continue;

    // Zpracuj interrupts
    const interruptsStr = String(row[8] || '');
    const interrupts = interruptsStr
      ? interruptsStr.split(';').filter(s => s).map(interrupt => {
          const parts = interrupt.split('-');
          return {
            start: parts[0] || '',
            end: parts[1] || '',
            type: 'break'
          };
        })
      : [];

    workHoursData[date] = {
      date: date,
      startTime: row[2] || null,
      endTime: row[3] || null,
      estimatedEndTime: row[4] || '17:00',
      workedHours: parseFloat(row[5]) || 0,
      earnings: parseFloat(row[6]) || 0,
      isDayOff: String(row[7]).toLowerCase() === 'true',
      interrupts: interrupts,
      isWorking: false,
      isPaused: false,
      pausedTime: 0
    };
  }

  return {
    workHoursData,
    hourlyRate,
    dailyHoursGoal,
    monthlyGoal
  };
}

// ============================================
// TESTOVACÍ FUNKCE
// ============================================

function testWrite() {
  const testData = {
    workHoursData: {
      '2024-01-15': {
        startTime: '09:00',
        endTime: '17:30',
        estimatedEndTime: '17:00',
        workedHours: 8.0,
        earnings: 2400,
        isDayOff: false,
        interrupts: [{ start: '12:00', end: '12:30' }]
      },
      '2024-01-16': {
        startTime: '08:30',
        endTime: '16:00',
        workedHours: 7.0,
        earnings: 2100,
        isDayOff: false,
        interrupts: []
      }
    },
    hourlyRate: 300,
    dailyHoursGoal: 8,
    monthlyGoal: 50000
  };

  const result = writeDataToSheet(testData);
  console.log('Write test result:', result);
}

function testRead() {
  const data = readDataFromSheet();
  console.log('Read test result:', JSON.stringify(data, null, 2));
}
```

---

## Krok 3: Nastav Sheet ID

V kódu najdi tento řádek a nahraď `VLOZ_SHEET_ID_ZDE` svým Sheet ID:

```javascript
const SPREADSHEET_ID = 'VLOZ_SHEET_ID_ZDE';
```

---

## Krok 4: Otestuj skript

1. Klikni na funkci `testWrite` v dropdown menu
2. Klikni na **Run**
3. Pokud to vyžaduje oprávnění, povol je
4. Zkontroluj, že se ve tvém sheetu vytvořil list "Work Hours" s testovacími daty

---

## Krok 5: Nasaď jako Web App

1. Klikni na **Deploy** → **New deployment**
2. Klikni na ozubené kolečko vedle "Select type" a vyber **Web app**
3. Nastav:
   - **Description**: Work Hours Sync v1
   - **Execute as**: Me
   - **Who has access**: Anyone
4. Klikni **Deploy**
5. **ZKOPÍRUJ URL** která se zobrazí - budeš ji potřebovat!

---

## Krok 6: Nastav v aplikaci

1. V Time Tracker aplikaci jdi na **Data Manager**
2. Klikni na **Sync Settings** (ozubené kolečko)
3. Do pole **"Export URL"** vlož zkopírovanou URL z Apps Script
4. Do pole **"Import CSV URL"** vlož stejnou URL (aplikace ji použije pro import)
5. Ulož nastavení

---

## Jak to funguje

### Export (aplikace → Google Sheets)
- Klikneš na **"Export to Sheets"**
- Aplikace pošle data do Apps Script
- Apps Script je zapíše do Google Sheetu

### Import (Google Sheets → aplikace)
- Klikneš na **"Import from CSV"**
- Aplikace zavolá Apps Script
- Apps Script vrátí data z Google Sheetu
- Aplikace je naimportuje

### Ruční editace v Google Sheets
- Můžeš data upravovat přímo v Google Sheetu
- Pak klikneš **"Import from CSV"** v aplikaci pro načtení změn

---

## Řešení problémů

### "Permission denied"
- Ujisti se, že jsi povolil oprávnění při prvním spuštění
- Zkus znovu nasadit Web App

### "Spreadsheet not found"
- Zkontroluj, že Sheet ID je správné
- Zkontroluj, že máš k sheetu přístup

### Data se nezobrazují
1. Otevři Apps Script projekt
2. Jdi na **Executions** v levém menu
3. Podívej se na chyby v posledních spuštěních

### Nová verze skriptu
Pokud upravíš skript, musíš ho znovu nasadit:
1. **Deploy** → **Manage deployments**
2. Klikni na tužku u aktuálního deploymentu
3. Změň **Version** na "New version"
4. Klikni **Deploy**

---

## Tipy

- Pro automatickou synchronizaci zapni "Auto-import" v nastavení
- Doporučený interval je 15-30 minut
- Data v Google Sheetu můžeš sdílet s ostatními pro přehled
