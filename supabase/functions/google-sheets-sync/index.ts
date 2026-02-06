const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

function isHttpsUrl(urlStr: string) {
  try {
    const u = new URL(urlStr);
    return u.protocol === 'https:';
  } catch {
    return false;
  }
}

function isAllowedHost(urlStr: string, allowed: string[]) {
  try {
    const u = new URL(urlStr);
    return allowed.some((host) => u.hostname === host || u.hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

// Combined whitelist for all Google services
const GOOGLE_HOSTS = [
  'script.google.com',
  'script.googleusercontent.com',
  'docs.google.com',
  'drive.google.com'
];

async function fetchWithTimeout(input: Request | string, init: RequestInit = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders
    });
  }

  try {
    const requestBody = await req.json();
    const { action, data, csvUrl, webAppUrl } = requestBody || {};

    if (action === 'backup') {
      // If no webhook URL, return CSV content only
      if (!webAppUrl) {
        const csvData = convertToCSV(data);
        const csvContent = csvData.map((row) => row.join(',')).join('\n');
        return new Response(JSON.stringify({ success: true, message: 'CSV data generated successfully.', csvData: csvContent }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Validate Apps Script URL
      if (!isHttpsUrl(webAppUrl) || !isAllowedHost(webAppUrl, ['script.google.com', 'script.googleusercontent.com'])) {
        return new Response(JSON.stringify({ error: 'Invalid webAppUrl host. Only Google Apps Script URLs are allowed.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const url = new URL(webAppUrl);
      console.log('Sending to Apps Script host:', url.hostname);

      const response = await fetchWithTimeout(webAppUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'updateSheet', data })
      }, 10000);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Apps Script update failed:', response.status, errorText.slice(0, 200));
        return new Response(JSON.stringify({ error: `Failed to update Google Sheet: ${response.status}` }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      return new Response(JSON.stringify({ success: true, message: 'Data updated in Google Sheet successfully.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'restore') {
      if (!csvUrl) {
        return new Response(JSON.stringify({ error: 'CSV URL is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (!isHttpsUrl(csvUrl) || !isAllowedHost(csvUrl, GOOGLE_HOSTS)) {
        return new Response(JSON.stringify({ error: 'Invalid URL host. Only Google URLs are allowed.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const url = new URL(csvUrl);
      console.log('Fetching data from host:', url.hostname);

      // Check if this is an Apps Script URL (supports JSON response)
      const isAppsScript = url.hostname.includes('script.google') || url.hostname.includes('googleusercontent.com');

      const response = await fetchWithTimeout(csvUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Supabase Edge Function)' },
        redirect: 'follow'
      }, 15000);

      if (!response.ok) {
        console.error('Fetch failed:', response.status, response.statusText);
        return new Response(JSON.stringify({ error: `Failed to fetch data: ${response.status} ${response.statusText}` }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const lenHeader = response.headers.get('content-length');
      if (lenHeader && Number(lenHeader) > 2_000_000) {
        return new Response(JSON.stringify({ error: 'Response too large' }), { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const responseText = await response.text();

      // Try to parse as JSON first (Apps Script response)
      try {
        const jsonData = JSON.parse(responseText);

        // If it's an Apps Script response with success/data structure
        if (jsonData.success && jsonData.data) {
          console.log('Parsed Apps Script JSON response');
          return new Response(JSON.stringify({
            success: true,
            message: 'Data imported from Google Sheet successfully.',
            data: jsonData.data
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // If it's direct data format
        if (jsonData.workHoursData) {
          console.log('Parsed direct JSON data');
          return new Response(JSON.stringify({
            success: true,
            message: 'Data imported successfully.',
            data: jsonData
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      } catch {
        // Not JSON, try CSV parsing
        console.log('Response is not JSON, trying CSV parsing');
      }

      // Fall back to CSV parsing
      const restoredData = parseCSVData(responseText);
      return new Response(JSON.stringify({ success: true, message: 'Data imported from Google Sheet successfully.', data: restoredData }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Action: fetch - Get data from Apps Script URL (alternative to restore)
    if (action === 'fetch') {
      if (!webAppUrl) {
        return new Response(JSON.stringify({ error: 'Web App URL is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (!isHttpsUrl(webAppUrl) || !isAllowedHost(webAppUrl, ['script.google.com', 'script.googleusercontent.com'])) {
        return new Response(JSON.stringify({ error: 'Invalid webAppUrl host. Only Google Apps Script URLs are allowed.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const url = new URL(webAppUrl);
      console.log('Fetching from Apps Script host:', url.hostname);

      const response = await fetchWithTimeout(webAppUrl, {
        method: 'GET',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Supabase Edge Function)' },
        redirect: 'follow'
      }, 15000);

      if (!response.ok) {
        console.error('Apps Script fetch failed:', response.status, response.statusText);
        return new Response(JSON.stringify({ error: `Failed to fetch from Apps Script: ${response.status}` }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const responseText = await response.text();

      try {
        const jsonData = JSON.parse(responseText);

        if (jsonData.success && jsonData.data) {
          return new Response(JSON.stringify({
            success: true,
            message: 'Data fetched from Apps Script successfully.',
            data: jsonData.data
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        if (jsonData.workHoursData) {
          return new Response(JSON.stringify({
            success: true,
            message: 'Data fetched successfully.',
            data: jsonData
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // Return error from Apps Script
        if (jsonData.error) {
          return new Response(JSON.stringify({ error: jsonData.error }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      } catch (parseError) {
        console.error('Failed to parse Apps Script response:', parseError);
        return new Response(JSON.stringify({ error: 'Invalid response from Apps Script' }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      return new Response(JSON.stringify({ error: 'Unexpected response format from Apps Script' }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('Error in google-sheets-sync function:', error?.message || error);
    return new Response(JSON.stringify({ error: error?.message || 'Internal error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

function convertToCSV(data: any) {
  const headers = ['Date', 'Day', 'Start Time', 'End Time', 'Estimated End', 'Hours Worked', 'Earnings', 'Is Day Off', 'Interrupts'];
  const rows = [headers];

  rows.push(['Hourly Rate', data.hourlyRate?.toString() || '', '', '', '', '', '', '', '']);
  rows.push(['Daily Hours Goal', data.dailyHoursGoal?.toString() || '', '', '', '', '', '', '', '']);
  rows.push(['Monthly Goal', data.monthlyGoal?.toString() || '', '', '', '', '', '', '', '']);
  rows.push(['']);

  Object.entries(data.workHoursData || {}).forEach(([date, record]: [string, any]) => {
    const dateObj = new Date(date + 'T00:00:00');
    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
    const interruptsStr = record.interrupts?.map((i: any) => `${i.start}-${i.end}`).join(';') || '';
    rows.push([
      date,
      dayName,
      record.startTime || '',
      record.endTime || '',
      record.estimatedEndTime || '',
      String(record.workedHours ?? ''),
      String(record.earnings ?? ''),
      record.isDayOff ? 'true' : 'false',
      interruptsStr,
    ]);
  });

  return rows;
}

function normalizeDate(raw: string): string | null {
  if (!raw || typeof raw !== 'string') return null;
  // Strip quotes, trim, and remove trailing time component (e.g. " 0:00:00" or " 12:00:00 AM")
  const s = raw.trim().replace(/^["']|["']$/g, '').replace(/\s+\d{1,2}:\d{2}(:\d{2})?\s*(AM|PM)?$/i, '').trim();
  if (!s) return null;

  const pad2 = (n: number) => String(n).padStart(2, '0');

  // yyyy-MM-dd
  const isoMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const y = Number(isoMatch[1]), m = Number(isoMatch[2]), d = Number(isoMatch[3]);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) return `${y}-${pad2(m)}-${pad2(d)}`;
  }

  // Czech/European: d.M.yyyy or dd.MM.yyyy (with optional spaces)
  const dotMatch = s.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})$/);
  if (dotMatch) {
    const d = Number(dotMatch[1]), m = Number(dotMatch[2]), y = Number(dotMatch[3]);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) return `${y}-${pad2(m)}-${pad2(d)}`;
  }

  // Slash format: M/d/yyyy or d/M/yyyy
  const slashMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const a = Number(slashMatch[1]), b = Number(slashMatch[2]), y = Number(slashMatch[3]);
    if (a > 12 && b >= 1 && b <= 12) return `${y}-${pad2(b)}-${pad2(a)}`;
    if (b > 12 && a >= 1 && a <= 12) return `${y}-${pad2(a)}-${pad2(b)}`;
    if (a >= 1 && a <= 12 && b >= 1 && b <= 31) return `${y}-${pad2(a)}-${pad2(b)}`;
  }

  // dd-MM-yyyy or d-M-yyyy (European with dashes)
  const dashEuMatch = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dashEuMatch) {
    const a = Number(dashEuMatch[1]), b = Number(dashEuMatch[2]), y = Number(dashEuMatch[3]);
    if (b >= 1 && b <= 12 && a >= 1 && a <= 31) return `${y}-${pad2(b)}-${pad2(a)}`;
  }

  // Google Sheets serial date number (days since 1899-12-30)
  const num = Number(s);
  if (Number.isFinite(num) && num > 40000 && num < 60000) {
    const dt = new Date(Date.UTC(1899, 11, 30 + num));
    return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
  }

  return null;
}

function parseCSVData(csvText: string) {
  const lines = csvText.trim().split('\n');
  if (lines.length === 0) {
    throw new Error('CSV file is empty');
  }

  const rows = lines.map((line) => {
    const result: string[] = [];
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
    return { workHoursData: {}, hourlyRate: 300, dailyHoursGoal: 8, monthlyGoal: 50000 };
  }

  let hourlyRate = 300;
  let dailyHoursGoal = 8;
  let monthlyGoal = 50000;

  for (let i = 1; i < Math.min(5, rows.length); i++) {
    const row = rows[i];
    if (row[0]?.toLowerCase().includes('hourly')) hourlyRate = parseFloat(row[1]) || 300;
    else if (row[0]?.toLowerCase().includes('daily')) dailyHoursGoal = parseFloat(row[1]) || 8;
    else if (row[0]?.toLowerCase().includes('monthly')) monthlyGoal = parseFloat(row[1]) || 50000;
  }

  const workHoursData: any = {};
  for (let i = 5; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 7 || !row[0] || row[0] === '') continue;

    const date = normalizeDate(row[0]);
    if (!date) continue;

    const interrupts = row[8]
      ? row[8].split(';').map((interrupt: string) => {
          const [start, end] = interrupt.split('-');
          return { start, end, type: 'break' };
        })
      : [];

    workHoursData[date] = {
      date,
      startTime: row[2] || null,
      endTime: row[3] || null,
      estimatedEndTime: row[4] || '17:00',
      isWorking: false,
      workedHours: parseFloat(row[5]) || 0,
      earnings: parseFloat(row[6]) || 0,
      isPaused: false,
      pausedTime: 0,
      interrupts,
      isDayOff: row[7] === 'true',
    };
  }

  return { workHoursData, hourlyRate, dailyHoursGoal, monthlyGoal };
}
