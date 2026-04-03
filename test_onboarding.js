import fetch from 'node-fetch';

async function testRoute() {
  try {
    const catRes = await fetch('https://codebasefull.vercel.app/api/categories');
    const cats = await catRes.json();
    const categoryId = cats[0].id;
    console.log("Using categoryId:", categoryId);

    const payload = {
      email: `test_${Date.now()}@example.com`,
      password: "password123",
      firstName: "Test",
      lastName: "User",
      phone: "1234567890",
      title: "Need a plumber fast",
      description: "My pipe is leaking very badly please help",
      categoryId: categoryId,
      budgetMin: "100",
      budgetMax: "200",
      urgency: "HIGH",
      locationText: "Dublin",
      preferredDate: new Date().toISOString()
    };

    const res = await fetch('https://codebasefull.vercel.app/api/onboarding/customer', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const text = await res.text();
    console.log("Status:", res.status);
    console.log("Response:", text);
  } catch (error) {
    console.error("Fetch Error:", error);
  }
}

testRoute();
