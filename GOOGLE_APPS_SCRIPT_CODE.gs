/**
 * Google Apps Script for Work Hours Tracker
 * Handles individual day exports and batch month exports
 * Checks for duplicates and appends to existing data
 */

// Configuration - UPDATE THESE VALUES
const SPREADSHEET_ID = 'YOUR_GOOGLE_SHEET_ID'; // Replace with your Google Sheet ID
const WORKSHEET_NAME = 'Work Hours'; // Name of the worksheet to update

/**
 * Handle POST requests from the Time Tracker app
 */
function doPost(e) {
  try {
    // Parse the incoming JSON data
    const data = JSON.parse(e.postData.contents);

    console.log('Received data:', JSON.stringify(data).substring(0, 200));

    // Open the spreadsheet
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    let worksheet = spreadsheet.getSheetByName(WORKSHEET_NAME);

    // Create worksheet if it doesn't exist
    if (!worksheet) {
      worksheet = spreadsheet.insertSheet(WORKSHEET_NAME);
      initializeWorksheet(worksheet);
    }

    // Check if worksheet has headers, if not initialize
    if (worksheet.getLastRow() === 0) {
      initializeWorksheet(worksheet);
    }

    let recordsAdded = 0;
    let recordsSkipped = 0;

    // Handle array of records (batch export from month)
    if (Array.isArray(data)) {
      const result = processBatchRecords(worksheet, data);
      recordsAdded = result.added;
      recordsSkipped = result.skipped;
    }
    // Handle single record (individual day export)
    else if (data.date) {
      const result = processSingleRecord(worksheet, data);
      recordsAdded = result.added;
      recordsSkipped = result.skipped;
    }
    // Handle old format with workHoursData object
    else if (data.workHoursData) {
      const result = processWorkHoursData(worksheet, data);
      recordsAdded = result.added;
      recordsSkipped = result.skipped;
    }
    else {
      throw new Error('Invalid data format');
    }

    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        message: 'Data processed successfully',
        recordsAdded: recordsAdded,
        recordsSkipped: recordsSkipped
      }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    console.error('Error processing request:', error);

    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Initialize worksheet with headers
 */
function initializeWorksheet(worksheet) {
  const headers = [
    'Date',
    'Day of Week',
    'Start Time',
    'End Time',
    'Hours Worked',
    'Earnings (CZK)',
    'Last Updated'
  ];

  worksheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // Format header row
  const headerRange = worksheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#4285f4');
  headerRange.setFontColor('white');

  // Auto-resize columns
  worksheet.autoResizeColumns(1, headers.length);
}

/**
 * Get existing dates in the worksheet
 */
function getExistingDates(worksheet) {
  const lastRow = worksheet.getLastRow();
  if (lastRow <= 1) return new Set(); // No data rows

  const dateRange = worksheet.getRange(2, 1, lastRow - 1, 1);
  const dates = dateRange.getValues();

  return new Set(dates.map(row => row[0]).filter(date => date));
}

/**
 * Process batch records (array)
 */
function processBatchRecords(worksheet, records) {
  const existingDates = getExistingDates(worksheet);
  const lastRow = worksheet.getLastRow();

  let added = 0;
  let skipped = 0;
  const newRows = [];

  records.forEach(record => {
    const date = record.date;

    // Skip if date already exists
    if (existingDates.has(date)) {
      console.log('Skipping duplicate date:', date);
      skipped++;
      return;
    }

    // Skip empty records (no hours worked)
    if (!record.startTime && record.workedHours === 0) {
      console.log('Skipping empty record:', date);
      skipped++;
      return;
    }

    const dateObj = new Date(date + 'T00:00:00');
    const dayOfWeek = dateObj.toLocaleDateString('en', { weekday: 'long' });

    newRows.push([
      date,
      dayOfWeek,
      record.startTime || '',
      record.endTime || '',
      record.workedHours || 0,
      record.earnings || 0,
      new Date()
    ]);

    added++;
  });

  // Append new rows
  if (newRows.length > 0) {
    const startRow = lastRow + 1;
    const range = worksheet.getRange(startRow, 1, newRows.length, 7);
    range.setValues(newRows);

    // Format the data
    worksheet.getRange(startRow, 5, newRows.length, 1).setNumberFormat('0.00'); // Hours
    worksheet.getRange(startRow, 6, newRows.length, 1).setNumberFormat('#,##0'); // Earnings
  }

  return { added, skipped };
}

/**
 * Process single record
 */
function processSingleRecord(worksheet, record) {
  const existingDates = getExistingDates(worksheet);
  const date = record.date;

  // Check if date already exists
  if (existingDates.has(date)) {
    // Update existing record
    return updateExistingRecord(worksheet, record);
  }

  // Add new record
  const lastRow = worksheet.getLastRow();
  const dateObj = new Date(date + 'T00:00:00');
  const dayOfWeek = dateObj.toLocaleDateString('en', { weekday: 'long' });

  const newRow = [
    date,
    dayOfWeek,
    record.startTime || '',
    record.endTime || '',
    record.workedHours || 0,
    record.earnings || 0,
    new Date()
  ];

  const startRow = lastRow + 1;
  worksheet.getRange(startRow, 1, 1, 7).setValues([newRow]);

  // Format the data
  worksheet.getRange(startRow, 5).setNumberFormat('0.00'); // Hours
  worksheet.getRange(startRow, 6).setNumberFormat('#,##0'); // Earnings

  return { added: 1, skipped: 0 };
}

/**
 * Update existing record
 */
function updateExistingRecord(worksheet, record) {
  const lastRow = worksheet.getLastRow();
  const dateRange = worksheet.getRange(2, 1, lastRow - 1, 1);
  const dates = dateRange.getValues();

  // Find the row with matching date
  for (let i = 0; i < dates.length; i++) {
    if (dates[i][0] === record.date) {
      const rowNum = i + 2; // +2 because array is 0-indexed and we start from row 2

      // Update the row
      worksheet.getRange(rowNum, 3).setValue(record.startTime || '');
      worksheet.getRange(rowNum, 4).setValue(record.endTime || '');
      worksheet.getRange(rowNum, 5).setValue(record.workedHours || 0);
      worksheet.getRange(rowNum, 6).setValue(record.earnings || 0);
      worksheet.getRange(rowNum, 7).setValue(new Date());

      console.log('Updated existing record for date:', record.date);
      return { added: 0, skipped: 0, updated: 1 };
    }
  }

  return { added: 0, skipped: 1 };
}

/**
 * Process old format with workHoursData object
 */
function processWorkHoursData(worksheet, data) {
  const { workHoursData, hourlyRate } = data;
  const records = [];

  for (const [date, record] of Object.entries(workHoursData)) {
    if (record.workedHours > 0) {
      records.push({
        date: date,
        startTime: record.startTime,
        endTime: record.endTime,
        workedHours: record.workedHours,
        earnings: record.earnings || (record.workedHours * hourlyRate)
      });
    }
  }

  return processBatchRecords(worksheet, records);
}

/**
 * Test function - run this to test your setup
 */
function testFunction() {
  const testData = [
    {
      date: '2026-01-15',
      startTime: '09:00',
      endTime: '17:30',
      workedHours: 8.0,
      earnings: 2400
    },
    {
      date: '2026-01-16',
      startTime: '08:30',
      endTime: '16:30',
      workedHours: 7.5,
      earnings: 2250
    }
  ];

  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let worksheet = spreadsheet.getSheetByName(WORKSHEET_NAME);

  if (!worksheet) {
    worksheet = spreadsheet.insertSheet(WORKSHEET_NAME);
    initializeWorksheet(worksheet);
  }

  const result = processBatchRecords(worksheet, testData);
  console.log('Test completed:', result);
}
