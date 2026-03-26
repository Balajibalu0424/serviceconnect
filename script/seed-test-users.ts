import { db } from "../server/db";
import { users } from "@shared/schema";
import { hashPassword } from "../server/auth";
import { eq } from "drizzle-orm";

async function seedTestUsers() {
  console.log("Seeding test users...");
  const passwordHash = await hashPassword("password123");

  const testUsers = [
    { email: "alice@test.com", firstName: "Alice", lastName: "Customer", role: "CUSTOMER" },
    { email: "bob@test.com", firstName: "Bob", lastName: "Customer", role: "CUSTOMER" },
    { email: "pro1@test.com", firstName: "Pro", lastName: "One", role: "PROFESSIONAL", creditBalance: 50 },
    { email: "pro2@test.com", firstName: "Pro", lastName: "Two", role: "PROFESSIONAL", creditBalance: 50 },
    { email: "admin@test.com", firstName: "Admin", lastName: "User", role: "ADMIN" },
  ];

  for (const tu of testUsers) {
    const existing = await db.select().from(users).where(eq(users.email, tu.email));
    
    if (existing.length > 0) {
      console.log(`Updating existing user: ${tu.email}`);
      await db.update(users).set({
        passwordHash,
        role: tu.role as any,
        creditBalance: tu.creditBalance || 0,
        emailVerified: true,
        onboardingCompleted: true,
        status: "ACTIVE"
      }).where(eq(users.id, existing[0].id));
    } else {
      console.log(`Creating new user: ${tu.email}`);
      await db.insert(users).values({
        email: tu.email,
        passwordHash,
        firstName: tu.firstName,
        lastName: tu.lastName,
        role: tu.role as any,
        status: "ACTIVE",
        emailVerified: true,
        onboardingCompleted: true,
        creditBalance: tu.creditBalance || 0
      });
    }
  }

  console.log("Successfully seeded test users!");
}

seedTestUsers().catch(console.error).finally(() => process.exit(0));
