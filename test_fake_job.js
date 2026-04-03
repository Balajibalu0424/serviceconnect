import fetch from 'node-fetch';

async function testRoute() {
  try {
    // 1. Create a user to get tokens
    const catRes = await fetch('http://localhost:5000/api/categories');
    const cats = await catRes.json();
    const categoryId = cats[0].id;
    
    // Create random user payload
    const payload = {
      email: `fake_${Date.now()}@example.com`,
      password: "password123",
      firstName: "Test",
      lastName: "User",
      phone: "1234567890",
      title: "Real valid title so we get past onboarding fake check",
      description: "Real valid description containing enough words to pass the quality gate and look like a real job. My house is in need of plumbing fixes, please come soon.",
      categoryId: categoryId,
      budgetMin: "100",
      budgetMax: "200",
      urgency: "HIGH",
      locationText: "Dublin"
    };

    const res = await fetch('http://localhost:5000/api/onboarding/customer', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const onboardingResult = await res.json();
    const token = onboardingResult.accessToken;
    
    console.log("Got token:", !!token);
    
    // 2. Post a FAKE job using the token to trigger fakeResult.isFake
    const fakeJobPayload = {
      title: "test asdasd",
      description: "test test asdasdasdasd",
      categoryId: categoryId,
      locationText: "Dublin"
    };

    const jobRes = await fetch('http://localhost:5000/api/jobs', {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}` 
      },
      body: JSON.stringify(fakeJobPayload)
    });
    
    const text = await jobRes.text();
    console.log("Job status:", jobRes.status);
    console.log("Job Response:", text);
    
  } catch (error) {
    console.error("Fetch Error:", error);
  }
}

testRoute();
