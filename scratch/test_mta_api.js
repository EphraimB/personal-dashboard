const https = require('https');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function test() {
  console.log('Testing MTA APIs...');
  try {
    const data = await fetchUrl('https://traintime.mta.info/api/v2/stations/135'); // Cedarhurst station ID in MTA LIRR
    console.log('MTA TrainTime API response snippet:', data.substring(0, 300));
  } catch (e) {
    console.log('TrainTime API failed:', e.message);
  }

  try {
    const data = await fetchUrl('https://map.mta.info/api/stations');
    console.log('MTA Map API response length:', data.length);
  } catch (e) {
    console.log('MTA Map API failed:', e.message);
  }
}

test();
