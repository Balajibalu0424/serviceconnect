import { db } from "./db";
import { users, serviceCategories } from "@shared/schema";
import { count } from "drizzle-orm";

async function check() {
  const [u] = await db.select({ c: count() }).from(users);
  const [s] = await db.select({ c: count() }).from(serviceCategories);
  console.log(`users: ${u.c}, service_categories: ${s.c}`);
  process.exit(0);
}
check().catch(e => { console.error(e.message); process.exit(1); });
