import { db } from "./db";
import { hashPassword } from "./auth";
import {
  users, professionalProfiles, serviceCategories, jobs,
  jobMatchbooks, jobUnlocks, jobAftercares, quotes, bookings, reviews,
  conversations, conversationParticipants, messages,
  creditPackages, creditTransactions, featureFlags, notifications
} from "@shared/schema";
import { eq } from "drizzle-orm";

async function seed() {
  console.log("Seeding database...");

  // Service Categories
  const categories = await db.insert(serviceCategories).values([
    { name: "Plumbing", slug: "plumbing", icon: "Wrench", description: "All plumbing services", baseCreditCost: 2, sortOrder: 1 },
    { name: "Electrical", slug: "electrical", icon: "Zap", description: "Electrical work and installations", baseCreditCost: 3, sortOrder: 2 },
    { name: "Cleaning", slug: "cleaning", icon: "Sparkles", description: "Home and office cleaning", baseCreditCost: 1, sortOrder: 3 },
    { name: "Painting", slug: "painting", icon: "Paintbrush", description: "Interior and exterior painting", baseCreditCost: 2, sortOrder: 4 },
    { name: "Gardening", slug: "gardening", icon: "Leaf", description: "Gardening and landscaping", baseCreditCost: 1, sortOrder: 5 },
    { name: "Removals", slug: "removals", icon: "Truck", description: "Moving and removals", baseCreditCost: 2, sortOrder: 6 },
    { name: "Handyman", slug: "handyman", icon: "Hammer", description: "General handyman services", baseCreditCost: 2, sortOrder: 7 },
    { name: "Tutoring", slug: "tutoring", icon: "BookOpen", description: "Academic tutoring and coaching", baseCreditCost: 1, sortOrder: 8 },
    { name: "Photography", slug: "photography", icon: "Camera", description: "Photography and videography", baseCreditCost: 2, sortOrder: 9 },
    { name: "Catering", slug: "catering", icon: "ChefHat", description: "Catering for events", baseCreditCost: 2, sortOrder: 10 },
    { name: "Web Design", slug: "web-design", icon: "Globe", description: "Website design and development", baseCreditCost: 3, sortOrder: 11 },
    { name: "Personal Training", slug: "personal-training", icon: "Dumbbell", description: "Fitness and personal training", baseCreditCost: 1, sortOrder: 12 },
    { name: "Pet Care", slug: "pet-care", icon: "Heart", description: "Dog walking and pet care", baseCreditCost: 1, sortOrder: 13 },
    { name: "Auto Repair", slug: "auto-repair", icon: "Car", description: "Car repairs and servicing", baseCreditCost: 3, sortOrder: 14 },
    { name: "Legal", slug: "legal", icon: "Scale", description: "Legal services and advice", baseCreditCost: 3, sortOrder: 15 },
    { name: "Accounting", slug: "accounting", icon: "Calculator", description: "Bookkeeping and accounting", baseCreditCost: 3, sortOrder: 16 },
  ]).returning();

  console.log(`Created ${categories.length} service categories`);

  // Credit Packages
  await db.insert(creditPackages).values([
    { name: "Starter", credits: 10, price: "9.99", bonusCredits: 0 },
    { name: "Popular", credits: 25, price: "19.99", bonusCredits: 5 },
    { name: "Professional", credits: 50, price: "34.99", bonusCredits: 15 },
    { name: "Enterprise", credits: 100, price: "59.99", bonusCredits: 40 },
  ]);

  // Feature Flags
  await db.insert(featureFlags).values([
    { key: "chat_enabled", description: "Enable in-app chat", isEnabled: true, rolloutPercentage: 100 },
    { key: "aftercare_enabled", description: "Enable aftercare system", isEnabled: true, rolloutPercentage: 100 },
    { key: "spin_wheel_enabled", description: "Enable spin the wheel for pros", isEnabled: true, rolloutPercentage: 100 },
    { key: "profanity_filter_enabled", description: "Enable profanity and contact filtering", isEnabled: true, rolloutPercentage: 100 },
    { key: "stripe_live_mode", description: "Use Stripe live keys (vs test)", isEnabled: false, rolloutPercentage: 0 },
  ]);

  // Admin user
  const adminHash = await hashPassword("admin123456");
  const [admin] = await db.insert(users).values({
    email: "admin@serviceconnect.ie",
    passwordHash: adminHash,
    firstName: "Admin",
    lastName: "User",
    role: "ADMIN",
    status: "ACTIVE",
    emailVerified: true,
    onboardingCompleted: true,
    creditBalance: 0
  }).returning();

  // Customer users
  const custHash = await hashPassword("password123");
  const [alice, bob, charlie] = await db.insert(users).values([
    { email: "alice@test.com", passwordHash: custHash, firstName: "Alice", lastName: "Murphy", role: "CUSTOMER", status: "ACTIVE", emailVerified: true, onboardingCompleted: true, creditBalance: 0 },
    { email: "bob@test.com", passwordHash: custHash, firstName: "Bob", lastName: "Kelly", role: "CUSTOMER", status: "ACTIVE", emailVerified: true, onboardingCompleted: true, creditBalance: 0 },
    { email: "charlie@test.com", passwordHash: custHash, firstName: "Charlie", lastName: "O'Brien", role: "CUSTOMER", status: "ACTIVE", emailVerified: true, onboardingCompleted: true, creditBalance: 0 },
  ]).returning();

  // Professional users
  const proHash = await hashPassword("password123");
  const [pro1, pro2, pro3] = await db.insert(users).values([
    { email: "pro1@test.com", passwordHash: proHash, firstName: "Dermot", lastName: "Walsh", role: "PROFESSIONAL", status: "ACTIVE", emailVerified: true, onboardingCompleted: true, creditBalance: 20, phone: "+353871234567" },
    { email: "pro2@test.com", passwordHash: proHash, firstName: "Siobhan", lastName: "Brennan", role: "PROFESSIONAL", status: "ACTIVE", emailVerified: true, onboardingCompleted: true, creditBalance: 20, phone: "+353872345678" },
    { email: "pro3@test.com", passwordHash: proHash, firstName: "Padraig", lastName: "Connolly", role: "PROFESSIONAL", status: "ACTIVE", emailVerified: true, onboardingCompleted: true, creditBalance: 20, phone: "+353873456789" },
  ]).returning();

  // Professional profiles
  const plumbingCat = categories.find(c => c.slug === "plumbing")!;
  const electricalCat = categories.find(c => c.slug === "electrical")!;
  const paintingCat = categories.find(c => c.slug === "painting")!;

  await db.insert(professionalProfiles).values([
    {
      userId: pro1.id,
      businessName: "Walsh Plumbing Services",
      yearsExperience: 12,
      hourlyRate: "65",
      ratingAvg: "4.8",
      totalReviews: 24,
      isVerified: true,
      serviceCategories: [plumbingCat.id],
      serviceAreas: ["Dublin", "Dublin 1", "Dublin 2", "Dublin 4"],
      lat: "53.3498", lng: "-6.2603", radiusKm: 15,
      availability: { mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false }
    },
    {
      userId: pro2.id,
      businessName: "Brennan Electrical",
      yearsExperience: 8,
      hourlyRate: "75",
      ratingAvg: "4.6",
      totalReviews: 18,
      isVerified: true,
      serviceCategories: [electricalCat.id],
      serviceAreas: ["Dublin", "Dublin 3", "Dublin 5", "Dublin 7"],
      lat: "53.3618", lng: "-6.2489", radiusKm: 20,
      availability: { mon: true, tue: true, wed: true, thu: true, fri: true, sat: true, sun: false }
    },
    {
      userId: pro3.id,
      businessName: "Connolly Painting & Decorating",
      yearsExperience: 15,
      hourlyRate: "55",
      ratingAvg: "4.9",
      totalReviews: 31,
      isVerified: true,
      serviceCategories: [paintingCat.id],
      serviceAreas: ["Dublin", "Dublin 6", "Dublin 8", "Dublin 12"],
      lat: "53.3337", lng: "-6.2783", radiusKm: 25,
      availability: { mon: true, tue: true, wed: true, thu: true, fri: true, sat: true, sun: false }
    }
  ]);

  // Add credit transactions for pros
  for (const pro of [pro1, pro2, pro3]) {
    await db.insert(creditTransactions).values({
      userId: pro.id, type: "BONUS", amount: 20, balanceAfter: 20,
      description: "Welcome bonus — 20 starter credits"
    });
  }

  // Sample Jobs
  const [job1, job2, job3, job4, job5] = await db.insert(jobs).values([
    {
      customerId: alice.id, categoryId: plumbingCat.id,
      title: "Leaking pipe under kitchen sink",
      description: "The pipe under my kitchen sink has developed a slow leak over the past week. The trap seems to be dripping. Need someone to inspect and fix it.",
      budgetMin: "50", budgetMax: "150", urgency: "HIGH",
      status: "LIVE", creditCost: 2, originalCreditCost: 2,
      locationText: "Ranelagh, Dublin 6"
    },
    {
      customerId: bob.id, categoryId: electricalCat.id,
      title: "Install new outdoor security light",
      description: "Need an outdoor security light fitted above my front door. I have the light already, just need a qualified electrician to install it and connect to existing circuit.",
      budgetMin: "80", budgetMax: "200", urgency: "NORMAL",
      status: "IN_DISCUSSION", creditCost: 3, originalCreditCost: 3,
      hasTokenPurchases: true, locationText: "Clontarf, Dublin 3"
    },
    {
      customerId: charlie.id, categoryId: paintingCat.id,
      title: "Paint living room and hallway",
      description: "Looking to get my living room (approx 20m²) and hallway painted. Walls and ceiling. I'll supply the paint but need everything prepped and painted to a high standard.",
      budgetMin: "300", budgetMax: "600", urgency: "NORMAL",
      status: "AFTERCARE_2D", creditCost: 2, originalCreditCost: 2,
      aftercareBranch: "TWO_DAY", locationText: "Dun Laoghaire, Dublin"
    },
    {
      customerId: alice.id, categoryId: plumbingCat.id,
      title: "New bathroom tap installation",
      description: "Replace old bathroom mixer tap with new one. Tap purchased already. Just need plumber to fit it.",
      budgetMin: "60", budgetMax: "120", urgency: "LOW",
      status: "COMPLETED", creditCost: 2, originalCreditCost: 2,
      hasTokenPurchases: true, locationText: "Ranelagh, Dublin 6"
    },
    {
      customerId: bob.id, categoryId: electricalCat.id,
      title: "Fix faulty kitchen light",
      description: "Kitchen ceiling light keeps flickering and occasionally cuts out. Need an electrician to diagnose and fix.",
      budgetMin: "50", budgetMax: "100", urgency: "HIGH",
      status: "CLOSED", creditCost: 3, originalCreditCost: 3,
      locationText: "Clontarf, Dublin 3"
    },
  ]).returning();

  // Matchbooks
  await db.insert(jobMatchbooks).values([
    { jobId: job1.id, professionalId: pro1.id },
    { jobId: job2.id, professionalId: pro2.id },
    { jobId: job1.id, professionalId: pro3.id },
  ]);

  // Unlocks for job2 (IN_DISCUSSION)
  await db.insert(jobUnlocks).values({
    jobId: job2.id, professionalId: pro2.id, tier: "STANDARD",
    creditsSpent: 3, phoneUnlocked: true
  });

  // Unlock for job4 (COMPLETED)
  await db.insert(jobUnlocks).values({
    jobId: job4.id, professionalId: pro1.id, tier: "STANDARD",
    creditsSpent: 2, phoneUnlocked: true
  });

  // Quote for job2
  const [q1] = await db.insert(quotes).values({
    jobId: job2.id, professionalId: pro2.id, customerId: bob.id,
    amount: "150", message: "I can fit your security light in about 2 hours. I carry all necessary cabling and fittings.",
    estimatedDuration: "2-3 hours", status: "ACCEPTED",
    validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  }).returning();

  // Booking for job4 (COMPLETED)
  const [q2] = await db.insert(quotes).values({
    jobId: job4.id, professionalId: pro1.id, customerId: alice.id,
    amount: "90", message: "Happy to replace your tap. Standard tap swap — about an hour's work.",
    estimatedDuration: "1 hour", status: "ACCEPTED"
  }).returning();

  const [booking1] = await db.insert(bookings).values({
    quoteId: q2.id, jobId: job4.id, customerId: alice.id, professionalId: pro1.id,
    totalAmount: "90", status: "COMPLETED",
    completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
  }).returning();

  // Review for booking1
  await db.insert(reviews).values({
    bookingId: booking1.id, reviewerId: alice.id, revieweeId: pro1.id,
    rating: 5, title: "Excellent service", comment: "Dermot arrived on time and fixed everything quickly. Very professional. Would highly recommend."
  });

  // Conversations for job2
  const [conv1] = await db.insert(conversations).values({
    type: "DIRECT", jobId: job2.id, status: "ACTIVE", createdBy: pro2.id,
    lastMessageAt: new Date(Date.now() - 30 * 60 * 1000)
  }).returning();

  await db.insert(conversationParticipants).values([
    { conversationId: conv1.id, userId: pro2.id, role: "MEMBER" },
    { conversationId: conv1.id, userId: bob.id, role: "MEMBER" },
  ]);

  await db.insert(messages).values([
    {
      conversationId: conv1.id, senderId: pro2.id, type: "SYSTEM",
      content: "A professional has unlocked your job with full access.", isFiltered: false
    },
    {
      conversationId: conv1.id, senderId: pro2.id, type: "TEXT",
      content: "Hi Bob, I saw your job for a security light installation. I'm fully RECI-registered and can come out this week. When suits you?",
      isFiltered: false
    },
    {
      conversationId: conv1.id, senderId: bob.id, type: "TEXT",
      content: "Hi Siobhan! Great, Thursday evening after 6pm works for me.",
      isFiltered: false
    },
    {
      conversationId: conv1.id, senderId: pro2.id, type: "TEXT",
      content: "Thursday 6:30pm works perfectly. I'll have everything with me. See you then!",
      isFiltered: false
    },
  ]);

  // Aftercare for job3
  await db.insert(jobAftercares).values({
    jobId: job3.id, branch: "TWO_DAY", triggeredAt: new Date(Date.now() - 2 * 60 * 60 * 1000)
  });

  // Notifications
  await db.insert(notifications).values([
    { userId: alice.id, type: "JOB_LIVE", title: "Your job is live!", message: "Your plumbing job is now visible to professionals.", isRead: true },
    { userId: alice.id, type: "AFTERCARE_2D", title: "Did you get sorted?", message: "How did your painting job go? Did someone get it sorted?", isRead: false, data: { jobId: job3.id } },
    { userId: bob.id, type: "QUOTE_ACCEPTED", title: "Quote accepted!", message: "Bob has accepted your quote for the security light job.", isRead: false, data: { quoteId: q1.id } },
    { userId: pro1.id, type: "NEW_JOB", title: "New plumbing job nearby", message: "A new plumbing job has been posted in your service area.", isRead: false },
    { userId: pro2.id, type: "QUOTE_ACCEPTED", title: "Your quote was accepted!", message: "Your quote for the security light installation was accepted.", isRead: false },
  ]);

  console.log("Seed complete!");
  console.log("\nTest accounts:");
  console.log("  Admin:    admin@serviceconnect.ie / admin123456");
  console.log("  Customer: alice@test.com / password123");
  console.log("  Customer: bob@test.com / password123");
  console.log("  Customer: charlie@test.com / password123");
  console.log("  Pro:      pro1@test.com / password123 (Plumber, 20 credits)");
  console.log("  Pro:      pro2@test.com / password123 (Electrician, 20 credits)");
  console.log("  Pro:      pro3@test.com / password123 (Painter, 20 credits)");
}

seed().catch(console.error).finally(() => process.exit(0));
