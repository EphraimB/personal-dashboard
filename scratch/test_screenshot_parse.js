const https = require('https');

function geocode(query) {
  return new Promise((resolve, reject) => {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
    const req = https.get(url, { headers: { 'User-Agent': 'PersonalDashboard/2.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve([]); }
      });
    });
    req.on('error', reject);
  });
}

function parseLocationString(rawStr) {
  let text = rawStr;
  // Convert word ordinal numbers to digits
  const ordinals = {
    first: '1st', second: '2nd', third: '3rd', fourth: '4th', fifth: '5th',
    sixth: '6th', seventh: '7th', eighth: '8th', ninth: '9th', tenth: '10th'
  };
  for (const [word, digit] of Object.entries(ordinals)) {
    const re = new RegExp(`\\b${word}\\b`, 'gi');
    text = text.replace(re, digit);
  }

  // Strip Unit/Suite/Apt/Floor info
  text = text.replace(/,?\s*(?:Unit|Ste|Suite|Apt|Apartment|Fl|Floor)\s*#?\s*\w+/gi, '');

  const candidates = [rawStr, text];

  // Match street starting at house number
  const match = text.match(/(?:\b\d+[-\d]*\s+[A-Za-z0-9\s.,'-]+(?:St|Street|Ave|Avenue|Blvd|Boulevard|Rd|Road|Dr|Drive|Way|Ln|Lane|Pl|Place|Pkwy|Parkway|Ct|Court)\b[^\n]*)/i);
  if (match) {
    let cleanAddress = match[0].trim();
    if (!cleanAddress.toLowerCase().includes('ny') && !cleanAddress.toLowerCase().includes('york')) {
      cleanAddress += ', NY';
    }
    candidates.push(cleanAddress);
  }

  return Array.from(new Set(candidates));
}

async function run() {
  const raw = "Ohel Regional Family Center 156 Beach Ninth St, Unit 2, Far Rockaway, NY";
  console.log("Raw String:", raw);
  const candidates = parseLocationString(raw);
  console.log("Generated Candidates:", candidates);

  for (const c of candidates) {
    const res = await geocode(c);
    console.log(`Query "${c}" =>`, res.length > 0 ? { lat: res[0].lat, lon: res[0].lon, name: res[0].display_name } : "[]");
  }
}

run();
