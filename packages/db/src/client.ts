import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env["DATABASE_URL"];

// Allow build-time module import without DATABASE_URL.
// Queries will fail at runtime if the env var is truly missing.
const client = postgres(connectionString ?? "postgres://localhost:5432/placeholder", {
  max: 10,
  idle_timeout: 30,
  connect_timeout: 10,
});

export const db = drizzle(client, { schema });
