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

async function test() {
  const fullString = "Ohel Regional Family Center, 156 Beach 9th St, Far Rockaway, NY 11691";
  console.log("Full string:", await geocode(fullString));

  // Extract address after comma
  const parts = fullString.split(',').map(s => s.trim());
  const addressOnly = parts.slice(1).join(', ');
  console.log("Address only:", addressOnly);
  console.log("Result:", await geocode(addressOnly));
}

test();
