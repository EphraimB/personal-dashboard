const https = require('https');

function fetchMtaFeed() {
  return new Promise((resolve, reject) => {
    // Official MTA GTFS-RT feed URL for LIRR
    const url = 'https://api-endpoint.mta.info/Access-Control/lirr-gtfs';
    https.get(url, (res) => {
      let data = [];
      res.on('data', chunk => data.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(data);
        resolve({ status: res.statusCode, length: buffer.length });
      });
    }).on('error', reject);
  });
}

async function run() {
  try {
    const res = await fetchMtaFeed();
    console.log('MTA Feed Status:', res);
  } catch (e) {
    console.log('Fetch error:', e.message);
  }
}

run();
