/**
 * Seed top-up: adds 8 more LIVE jobs across various categories
 * Run with: npx tsx server/seed-topup.ts
 */
import { db } from "./db";
import { users, serviceCategories, jobs } from "@shared/schema";
import { eq, inArray } from "drizzle-orm";

async function topup() {
  console.log("Starting seed top-up...");

  // Get customers
  const customers = await db.select({ id: users.id, email: users.email })
    .from(users)
    .where(inArray(users.email, ["alice@test.com", "bob@test.com", "charlie@test.com"]));

  const alice = customers.find(c => c.email === "alice@test.com")!;
  const bob = customers.find(c => c.email === "bob@test.com")!;
  const charlie = customers.find(c => c.email === "charlie@test.com")!;

  // Get categories
  const cats = await db.select({ id: serviceCategories.id, slug: serviceCategories.slug })
    .from(serviceCategories);

  const cat = (slug: string) => cats.find(c => c.slug === slug)!.id;

  const newJobs = await db.insert(jobs).values([
    {
      customerId: alice.id,
      categoryId: cat("cleaning"),
      title: "Deep clean 3-bed house before viewing",
      description: "Moving out of my 3-bedroom semi-detached in Sandyford. Need a professional deep clean — kitchen, bathrooms, all rooms including windows inside. Property is empty. Need done by Friday.",
      budgetMin: "150", budgetMax: "300", urgency: "HIGH",
      status: "LIVE", creditCost: 1, originalCreditCost: 1,
      locationText: "Sandyford, Dublin 18"
    },
    {
      customerId: bob.id,
      categoryId: cat("gardening"),
      title: "Overgrown back garden clearance",
      description: "Back garden completely overgrown — grass waist high, weeds everywhere, hedges need trimming. Roughly 80m². Need everything cut back and cleared. Happy to supply bags for disposal.",
      budgetMin: "100", budgetMax: "250", urgency: "NORMAL",
      status: "LIVE", creditCost: 1, originalCreditCost: 1,
      locationText: "Glasnevin, Dublin 11"
    },
    {
      customerId: charlie.id,
      categoryId: cat("plumbing"),
      title: "Boiler service + pressure check",
      description: "Annual boiler service overdue by 6 months. Oil boiler, Firebird brand. Also pressure has been dropping — need someone to check for leaks on the system. House is occupied, flexible on timing.",
      budgetMin: "80", budgetMax: "180", urgency: "NORMAL",
      status: "LIVE", creditCost: 2, originalCreditCost: 2,
      locationText: "Lucan, Dublin"
    },
    {
      customerId: alice.id,
      categoryId: cat("handyman"),
      title: "Assemble flat-pack furniture (IKEA)",
      description: "Need help assembling 3 IKEA PAX wardrobes and a HEMNES bed frame. All boxes unopened. Dublin 4 location. Ideally this weekend but flexible.",
      budgetMin: "60", budgetMax: "120", urgency: "LOW",
      status: "LIVE", creditCost: 2, originalCreditCost: 2,
      locationText: "Ballsbridge, Dublin 4"
    },
    {
      customerId: bob.id,
      categoryId: cat("electrical"),
      title: "Replace fuse board / consumer unit",
      description: "Old fuse board needs replacing with modern consumer unit with RCDs. 3-bed house. Want to get it compliant before selling. Need a RECI-registered electrician.",
      budgetMin: "400", budgetMax: "700", urgency: "NORMAL",
      status: "LIVE", creditCost: 3, originalCreditCost: 3,
      locationText: "Rathfarnham, Dublin 14"
    },
    {
      customerId: charlie.id,
      categoryId: cat("painting"),
      title: "Exterior front door and window frames repaint",
      description: "Front door (composite), two bay windows and downstairs window frames need repainting. Old paint is flaking. House is Victorian terrace. Need proper prep and exterior gloss.",
      budgetMin: "200", budgetMax: "450", urgency: "LOW",
      status: "LIVE", creditCost: 2, originalCreditCost: 2,
      locationText: "Phibsborough, Dublin 7"
    },
    {
      customerId: alice.id,
      categoryId: cat("pet-care"),
      title: "Dog walker needed — 5 days per week",
      description: "Looking for a reliable dog walker for our 2-year-old Labrador, Biscuit. Monday to Friday, 1 hour midday walk around Dartry Park. Must be experienced with large breeds.",
      budgetMin: "15", budgetMax: "25", urgency: "NORMAL",
      status: "LIVE", creditCost: 1, originalCreditCost: 1,
      locationText: "Dartry, Dublin 6"
    },
    {
      customerId: bob.id,
      categoryId: cat("web-design"),
      title: "Simple website for my plumbing business",
      description: "Need a 4-5 page website for my plumbing business. Home, About, Services, Gallery, Contact. I have photos and logo. Just need it designed and built. Want to be able to update it myself (WordPress or similar).",
      budgetMin: "500", budgetMax: "1200", urgency: "NORMAL",
      status: "LIVE", creditCost: 3, originalCreditCost: 3,
      locationText: "Dublin (Remote OK)"
    },
  ]).returning();

  console.log(`✅ Added ${newJobs.length} new LIVE jobs`);
  newJobs.forEach(j => console.log(`  - ${j.title} [${j.status}]`));
}

topup().catch(console.error).finally(() => process.exit(0));
