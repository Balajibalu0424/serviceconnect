import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  // In development allow a local fallback; in production this must be set
  if (process.env.NODE_ENV === "production") {
    throw new Error("DATABASE_URL environment variable is required in production");
  }
  console.warn("[drizzle] DATABASE_URL not set — using local fallback");
}

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/serviceconnect";

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: DATABASE_URL,
  },
});
