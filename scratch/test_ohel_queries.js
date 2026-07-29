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
  const queries = [
    "Ohel Regional Family Center",
    "Ohel Regional Family Center, Far Rockaway",
    "Ohel Regional Family Center, Far Rockaway, NY",
    "Ohel, Far Rockaway, NY",
    "Ohel Family Center, Far Rockaway",
    "Ohel, Beach 9th St, Far Rockaway",
    "Ohel, Beach 9th St"
  ];

  for (const q of queries) {
    const res = await geocode(q);
    console.log(`Query: "${q}" =>`, res.length > 0 ? { lat: res[0].lat, lon: res[0].lon, name: res[0].display_name } : "[]");
  }
}

test();
