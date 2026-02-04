# Google Apps Script Setup for Work Hours Export

> **RECOMMENDED**: For bidirectional sync (export AND import), use the new setup guide:
> **[GOOGLE_APPS_SCRIPT_BIDIRECTIONAL.md](./GOOGLE_APPS_SCRIPT_BIDIRECTIONAL.md)**

This guide is for one-way export only. For full bidirectional sync, see the recommended guide above.

---

This guide will help you set up a Google Apps Script web app to receive and process work hours data from the Time Tracker application.

## Step 1: Create a New Google Apps Script Project

1. Go to [script.google.com](https://script.google.com)
2. Click "New Project"
3. Give your project a meaningful name like "Work Hours Sync"

## Step 2: Add the Script Code

Replace the default `Code.gs` content with the following code:

```javascript
/**
 * Web app to handle work hours data from Time Tracker
 * This script processes POST requests and updates a Google Sheet
 */

// Configuration - UPDATE THESE VALUES
const SPREADSHEET_ID = 'YOUR_GOOGLE_SHEET_ID'; // Replace with your Google Sheet ID
const WORKSHEET_NAME = 'Work Hours'; // Name of the worksheet to update

function doPost(e) {
  try {
    // Parse the incoming JSON data
    const data = JSON.parse(e.postData.contents);
    
    if (!data || !data.workHoursData) {
      return ContentService
        .createTextOutput(JSON.stringify({
          success: false,
          error: 'Invalid data format'
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Process the work hours data
    const result = updateWorkHoursSheet(data);
    
    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        message: 'Data updated successfully',
        recordsProcessed: result.recordsProcessed
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

function updateWorkHoursSheet(data) {
  const { workHoursData, hourlyRate, dailyGoal, monthlyGoal } = data;
  
  // Open the spreadsheet
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let worksheet = spreadsheet.getSheetByName(WORKSHEET_NAME);
  
  // Create worksheet if it doesn't exist
  if (!worksheet) {
    worksheet = spreadsheet.insertSheet(WORKSHEET_NAME);
  }
  
  // Clear existing data (optional - remove this line if you want to append)
  worksheet.clear();
  
  // Set up headers
  const headers = [
    'Date',
    'Day of Week', 
    'Start Time',
    'End Time',
    'Estimated End',
    'Hours Worked',
    'Earnings (CZK)',
    'Day Off',
    'Paused Time (min)',
    'Last Updated'
  ];
  
  worksheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  // Format header row
  const headerRange = worksheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#4285f4');
  headerRange.setFontColor('white');
  
  // Add metadata
  worksheet.getRange(2, 1, 1, 2).setValues([['Hourly Rate:', hourlyRate]]);
  worksheet.getRange(3, 1, 1, 2).setValues([['Daily Goal (hours):', dailyGoal]]);
  worksheet.getRange(4, 1, 1, 2).setValues([['Monthly Goal (CZK):', monthlyGoal]]);
  worksheet.getRange(5, 1, 1, 2).setValues([['Last Sync:', new Date()]]);
  
  // Convert work hours data to array format
  const dataRows = [];
  let recordsProcessed = 0;
  
  for (const [date, record] of Object.entries(workHoursData)) {
    if (record.workedHours > 0) { // Only include days with work
      const dateObj = new Date(date + 'T00:00:00');
      const dayOfWeek = dateObj.toLocaleDateString('en', { weekday: 'long' });
      
      dataRows.push([
        date,
        dayOfWeek,
        record.startTime || '',
        record.endTime || '',
        record.estimatedEndTime || '',
        record.workedHours,
        record.earnings || (record.workedHours * hourlyRate),
        record.isDayOff ? 'Yes' : 'No',
        record.pausedTime || 0,
        new Date()
      ]);
      recordsProcessed++;
    }
  }
  
  // Sort by date (newest first)
  dataRows.sort((a, b) => new Date(b[0]) - new Date(a[0]));
  
  // Write data to sheet (starting from row 7 to leave space for metadata)
  if (dataRows.length > 0) {
    const dataRange = worksheet.getRange(7, 1, dataRows.length, headers.length);
    dataRange.setValues(dataRows);
    
    // Format the data
    worksheet.getRange(7, 6, dataRows.length, 1).setNumberFormat('0.00'); // Hours
    worksheet.getRange(7, 7, dataRows.length, 1).setNumberFormat('#,##0'); // Earnings
  }
  
  // Auto-resize columns
  worksheet.autoResizeColumns(1, headers.length);
  
  return { recordsProcessed };
}

// Test function - you can run this to test your setup
function testFunction() {
  const testData = {
    workHoursData: {
      '2024-01-15': {
        startTime: '09:00',
        endTime: '17:30',
        workedHours: 8.0,
        earnings: 2400,
        isDayOff: false,
        pausedTime: 30
      }
    },
    hourlyRate: 300,
    dailyGoal: 8,
    monthlyGoal: 50000
  };
  
  const result = updateWorkHoursSheet(testData);
  console.log('Test completed:', result);
}
```

## Step 3: Configure Your Google Sheet

1. Create a new Google Sheet or use an existing one
2. Copy the Google Sheet ID from the URL (the long string between `/d/` and `/edit`)
3. Replace `YOUR_GOOGLE_SHEET_ID` in the script with your actual Sheet ID

## Step 4: Deploy as Web App

1. In your Apps Script project, click "Deploy" → "New deployment"
2. Choose "Web app" as the type
3. Set the following configuration:
   - **Execute as**: Me (your email)
   - **Who has access**: Anyone (this allows the Time Tracker app to send data)
4. Click "Deploy"
5. Copy the web app URL that's generated

## Step 5: Configure Time Tracker App

1. In your Time Tracker app, go to the "Data Manager" tab
2. Click the settings icon to open sync settings
3. Paste your Google Apps Script web app URL in the "Export URL" field
4. Save the settings

## Step 6: Test the Integration

1. Go to your "Monthly Stats" tab in the Time Tracker
2. Click "Export to Sheets" button
3. Check your Google Sheet to verify the data was imported correctly

## Security Considerations

- The web app is set to "Anyone" access, but it only accepts POST requests with specific data format
- Consider setting up authentication if you need additional security
- The script only updates the designated worksheet in your Google Sheet

## Troubleshooting

### Common Issues:

1. **"Permission denied" error**: Make sure the script has permission to access your Google Sheets
2. **"Spreadsheet not found"**: Verify the SPREADSHEET_ID is correct
3. **No data appearing**: Check the browser console and Apps Script logs for errors

### Checking Logs:

1. In Apps Script, go to "Executions" to see recent runs and any errors
2. Use `console.log()` statements in the script for debugging

## Customization Options

- **Change worksheet name**: Modify the `WORKSHEET_NAME` constant
- **Append vs Replace**: Remove the `worksheet.clear()` line to append data instead of replacing
- **Add filtering**: Only export certain date ranges or work types
- **Custom formatting**: Modify the formatting sections to match your preferences

## Support

If you encounter issues:
1. Check the Apps Script execution logs
2. Verify the JSON data format being sent from the Time Tracker
3. Test the `testFunction()` in Apps Script to isolate issues