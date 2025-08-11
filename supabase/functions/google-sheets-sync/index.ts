import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Function called with method:', req.method);
    
    const requestBody = await req.json();
    const { action, data, csvUrl } = requestBody;
    console.log('Request data:', { action, hasCsvUrl: !!csvUrl });

    if (action === 'backup') {
      // Direct update to Google Sheets via Apps Script
      const { webAppUrl } = requestBody;
      
      if (!webAppUrl) {
        // Fallback to CSV export if no webhook URL provided
        const csvData = convertToCSV(data);
        const csvContent = csvData.map(row => row.join(',')).join('\n');
        
        return new Response(JSON.stringify({ 
          success: true, 
          message: 'CSV data generated successfully.',
          csvData: csvContent
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('Sending data to Google Apps Script:', webAppUrl);
      
      // Send data directly to Google Sheets via Apps Script webhook
      const response = await fetch(webAppUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'updateSheet',
          data: data
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Apps Script update failed:', response.status, errorText);
        throw new Error(`Failed to update Google Sheet: ${response.status} - ${errorText}`);
      }

      const result = await response.text();
      console.log('Apps Script response:', result);

      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Data updated in Google Sheet successfully.'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (action === 'restore') {
      // Import from published Google Sheet CSV
      console.log('Fetching data from CSV URL:', csvUrl);
      
      if (!csvUrl) {
        throw new Error('CSV URL is required');
      }
      
      const response = await fetch(csvUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Supabase Edge Function)'
        }
      });
      
      if (!response.ok) {
        console.error('Fetch failed:', response.status, response.statusText);
        throw new Error(`Failed to fetch CSV data: ${response.status} ${response.statusText}`);
      }
      
      const csvText = await response.text();
      console.log('CSV data fetched, length:', csvText.length);
      console.log('First 200 chars:', csvText.substring(0, 200));
      
      // Parse CSV data
      const restoredData = parseCSVData(csvText);
      console.log('Parsed data:', Object.keys(restoredData));
      
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Data imported from Google Sheet successfully.',
        data: restoredData
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    }

    throw new Error('Invalid action');

  } catch (error) {
    console.error('Error in google-sheets-sync function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function convertToCSV(data: any) {
  const headers = ['Date', 'Day', 'Start Time', 'End Time', 'Estimated End', 'Hours Worked', 'Earnings', 'Is Day Off', 'Interrupts'];
  const rows = [headers];

  // Add metadata row
  rows.push(['Hourly Rate', data.hourlyRate.toString(), '', '', '', '', '', '', '']);
  rows.push(['Daily Hours Goal', data.dailyHoursGoal.toString(), '', '', '', '', '', '', '']);
  rows.push(['Monthly Goal', data.monthlyGoal.toString(), '', '', '', '', '', '', '']);
  rows.push(['']); // Empty row separator

  // Add work hours data
  Object.entries(data.workHoursData).forEach(([date, record]: [string, any]) => {
    const dateObj = new Date(date + 'T00:00:00');
    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
    const interruptsStr = record.interrupts?.map((i: any) => `${i.start}-${i.end}`).join(';') || '';
    rows.push([
      date,
      dayName,
      record.startTime || '',
      record.endTime || '',
      record.estimatedEndTime || '',
      record.workedHours.toString(),
      record.earnings.toString(),
      record.isDayOff ? 'true' : 'false',
      interruptsStr
    ]);
  });

  return rows;
}

function parseCSVData(csvText: string) {
  console.log('Parsing CSV data, length:', csvText.length);
  const lines = csvText.trim().split('\n');
  console.log('Number of lines:', lines.length);
  
  if (lines.length === 0) {
    throw new Error('CSV file is empty');
  }

  const rows = lines.map(line => {
    // Simple CSV parsing (handles basic cases)
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  });

  console.log('Sample rows:', rows.slice(0, 3));

  // If the CSV doesn't have the expected structure, create default data
  if (rows.length < 5) {
    console.log('CSV has insufficient rows, creating default data');
    return {
      workHoursData: {},
      hourlyRate: 300,
      dailyHoursGoal: 8,
      monthlyGoal: 50000
    };
  }

  // Extract metadata - be more flexible with parsing
  let hourlyRate = 300;
  let dailyHoursGoal = 8;
  let monthlyGoal = 50000;

  // Try to find metadata rows
  for (let i = 1; i < Math.min(5, rows.length); i++) {
    const row = rows[i];
    if (row[0]?.toLowerCase().includes('hourly')) {
      hourlyRate = parseFloat(row[1]) || 300;
    } else if (row[0]?.toLowerCase().includes('daily')) {
      dailyHoursGoal = parseFloat(row[1]) || 8;
    } else if (row[0]?.toLowerCase().includes('monthly')) {
      monthlyGoal = parseFloat(row[1]) || 50000;
    }
  }

  console.log('Extracted metadata:', { hourlyRate, dailyHoursGoal, monthlyGoal });

  // Extract work hours data (skip header and metadata rows)
  const workHoursData: any = {};
  
  for (let i = 5; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 7 || !row[0] || row[0] === '') continue;

    const date = row[0];
    
    // Skip if date doesn't look like a date
    if (!date.match(/\d{4}-\d{2}-\d{2}/)) continue;

    const interrupts = row[8] ? row[8].split(';').map((interrupt: string) => {
      const [start, end] = interrupt.split('-');
      return { start, end, type: 'break' };
    }) : [];

    workHoursData[date] = {
      date,
      startTime: row[2] || null,        // Column 2: Start Time
      endTime: row[3] || null,          // Column 3: End Time  
      estimatedEndTime: row[4] || '17:00', // Column 4: Estimated End
      isWorking: false,
      workedHours: parseFloat(row[5]) || 0,    // Column 5: Hours Worked
      earnings: parseFloat(row[6]) || 0,       // Column 6: Earnings
      isPaused: false,
      pausedTime: 0,
      interrupts,
      isDayOff: row[7] === 'true'              // Column 7: Is Day Off
    };
  }

  console.log('Extracted work hours data:', Object.keys(workHoursData).length, 'records');

  return {
    workHoursData,
    hourlyRate,
    dailyHoursGoal,
    monthlyGoal
  };
}