import { defineConfig } from "drizzle-kit";

// `npx drizzle-kit generate` writes a new SQL migration into drizzle/ after lib/db/schema.ts changes.
export default defineConfig({ dialect: "postgresql", schema: "./lib/db/schema.ts", out: "./drizzle" });
