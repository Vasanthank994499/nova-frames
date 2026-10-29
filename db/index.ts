import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';
let database: ReturnType<typeof drizzle<typeof schema>> | undefined;
export function getDb() {
 // Preserve DATABASE_URL overrides and support the pooled URL added by Vercel's Neon integration.
 const url=process.env.DATABASE_URL || process.env.POSTGRES_URL;
 if(!url) throw new Error('Production database is not configured. Set DATABASE_URL or connect a Neon database to this Vercel project.');
 return database ??= drizzle(neon(url),{schema});
}
