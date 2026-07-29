const https = require('https');

function fetchUrl(url, headers = {}) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'PersonalDashboard/2.0', ...headers } }, (res) => {
      let data = [];
      res.on('data', chunk => data.push(chunk));
      res.on('end', () => {
        resolve({ status: res.statusCode, data: Buffer.concat(data).toString('utf8') });
      });
    }).on('error', reject);
  });
}

async function test() {
  console.log('Testing open MTA endpoints...');
  try {
    const r1 = await fetchUrl('https://api-endpoint.mta.info/Access-Control/lirr-gtfs');
    console.log('Official GTFS:', r1.status);
  } catch (e) { console.log('GTFS error:', e.message); }

  try {
    const r2 = await fetchUrl('https://mnr-lirr-gtfs.mta.info/');
    console.log('MNR-LIRR Public:', r2.status, r2.data.substring(0, 100));
  } catch (e) { console.log('Public GTFS error:', e.message); }
}

test();
