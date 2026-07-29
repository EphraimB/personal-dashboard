const https = require('https');

function geocode(query) {
  return new Promise((resolve, reject) => {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=3`;
    const req = https.get(url, { headers: { 'User-Agent': 'PersonalDashboard/2.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) { resolve([]); }
      });
    });
    req.on('error', reject);
  });
}

async function run() {
  console.log('=== NOMINATIM GEOCODE RESULTS ===');
  const r1 = await geocode('156 Beach 9th St, Far Rockaway, NY 11691');
  console.log('156 Beach 9th St:', r1[0] ? { lat: r1[0].lat, lon: r1[0].lon, display_name: r1[0].display_name } : 'None');

  const r2 = await geocode('Beach 9th St and Seagirt Blvd, Far Rockaway, NY');
  console.log('Beach 9th & Seagirt:', r2[0] ? { lat: r2[0].lat, lon: r2[0].lon, display_name: r2[0].display_name } : 'None');
}

run();
