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
      // Convert data to CSV format
      const csvData = convertToCSV(data);
      console.log('CSV data prepared, rows:', csvData.length);
      
      // Convert to CSV string
      const csvContent = csvData.map(row => row.join(',')).join('\n');
      
      // Return the CSV data for download
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'CSV data generated successfully.',
        csvData: csvContent
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
  const headers = ['Date', 'Start Time', 'End Time', 'Estimated End', 'Hours Worked', 'Earnings', 'Is Day Off', 'Interrupts'];
  const rows = [headers];

  // Add metadata row
  rows.push(['Hourly Rate', data.hourlyRate.toString(), '', '', '', '', '', '']);
  rows.push(['Daily Hours Goal', data.dailyHoursGoal.toString(), '', '', '', '', '', '']);
  rows.push(['Monthly Goal', data.monthlyGoal.toString(), '', '', '', '', '', '']);
  rows.push(['']); // Empty row separator

  // Add work hours data
  Object.entries(data.workHoursData).forEach(([date, record]: [string, any]) => {
    const interruptsStr = record.interrupts?.map((i: any) => `${i.start}-${i.end}`).join(';') || '';
    rows.push([
      date,
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
  const lines = csvText.trim().split('\n');
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

  if (rows.length < 5) {
    throw new Error('Invalid CSV data structure');
  }

  // Extract metadata
  const hourlyRate = parseFloat(rows[1][1]) || 0;
  const dailyHoursGoal = parseFloat(rows[2][1]) || 8;
  const monthlyGoal = parseFloat(rows[3][1]) || 50000;

  // Extract work hours data (skip header and metadata rows)
  const workHoursData: any = {};
  
  for (let i = 5; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 7 || !row[0]) continue;

    const date = row[0];
    const interrupts = row[7] ? row[7].split(';').map((interrupt: string) => {
      const [start, end] = interrupt.split('-');
      return { start, end, type: 'break' };
    }) : [];

    workHoursData[date] = {
      date,
      startTime: row[1] || null,
      endTime: row[2] || null,
      estimatedEndTime: row[3] || '17:00',
      isWorking: false,
      workedHours: parseFloat(row[4]) || 0,
      earnings: parseFloat(row[5]) || 0,
      isPaused: false,
      pausedTime: 0,
      interrupts,
      isDayOff: row[6] === 'true'
    };
  }

  return {
    workHoursData,
    hourlyRate,
    dailyHoursGoal,
    monthlyGoal
  };
}