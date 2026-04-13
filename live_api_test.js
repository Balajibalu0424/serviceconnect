
const fetch = require('node-fetch');

const BASE_URL = 'https://codebasefull.vercel.app';
const AUTH_TOKEN = process.env.AUTH_TOKEN; // Get from browser during live test

async function testApi() {
  if (!AUTH_TOKEN) {
    console.error('Please set AUTH_TOKEN env var');
    process.exit(1);
  }

  const headers = {
    'Authorization': `Bearer ${AUTH_TOKEN}`,
    'Content-Type': 'application/json'
  };

  console.log('--- Area 1: Quote Loading ---');
  const quotesRes = await fetch(`${BASE_URL}/api/quotes`, { headers });
  const quotes = await quotesRes.json();
  console.log(`Total quotes fetched: ${quotes.length}`);
  if (quotes.length > 0) {
    const quote = quotes[0];
    const filteredRes = await fetch(`${BASE_URL}/api/quotes?jobId=${quote.jobId}`, { headers });
    const filteredQuotes = await filteredRes.json();
    console.log(`Filtered quotes for job ${quote.jobId}: ${filteredQuotes.length}`);
    const mismatch = filteredQuotes.some(q => q.jobId !== quote.jobId);
    console.log(`Leak check: ${mismatch ? 'FAIL (Leaked other jobs)' : 'PASS'}`);
  }

  console.log('\n--- Area 4: Notification Preferences ---');
  // First get profile to see preferences
  const profileRes = await fetch(`${BASE_URL}/api/auth/profile`, { headers });
  const profile = await profileRes.json();
  console.log('Current Preferences:', profile.notificationPreferences);

  // Toggle them
  const toggleRes = await fetch(`${BASE_URL}/api/auth/profile`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      notificationPreferences: { email: false, sms: false, push: false }
    })
  });
  const updatedProfile = await toggleRes.json();
  console.log('Updated Preferences:', updatedProfile.notificationPreferences);
  const persistCheck = updatedProfile.notificationPreferences.push === false;
  console.log(`Persistence check: ${persistCheck ? 'PASS' : 'FAIL'}`);

  console.log('\n--- Area 5: Job Feed Radius ---');
  const feedRes = await fetch(`${BASE_URL}/api/jobs/feed?scope=matched`, { headers });
  const feedData = await feedRes.json();
  console.log(`Jobs in feed: ${feedData.jobs?.length || 0}`);
}

testApi().catch(console.error);
