const path = require('path');

async function testCalendar() {
  const route = require(path.join(process.cwd(), 'app', 'api', 'calendar', 'route.js'));
  const dummyReq = { url: 'http://localhost:3000/api/calendar' };
  
  try {
    const res = await route.GET(dummyReq);
    const json = await res.json();
    console.log('=== CALENDAR RESPONSE SUMMARY ===');
    console.log('Is Connected:', json.isConnected);
    console.log('Source:', json.source);
    console.log('UP NEXT:', json.upNext ? `${json.upNext.dateStr} - ${json.upNext.startTime} - ${json.upNext.title}` : 'None');
    console.log('TODAY EVENTS:', json.todayEvents?.length || 0);
    json.todayEvents?.forEach(e => console.log(`  [TODAY] ${e.startTime} - ${e.title} (${e.locationMain})`));
    console.log('WEEK DAYS:', json.weekDays?.length || 0);
    json.weekDays?.forEach(d => {
      console.log(` Day: ${d.dayName} (${d.formattedDate})`);
      d.events?.forEach(e => console.log(`   -> ${e.startTime} - ${e.title} (${e.locationMain})`));
    });
  } catch (err) {
    console.error('Error running route test:', err);
  }
}

testCalendar();
