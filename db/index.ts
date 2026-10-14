import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';
let database: ReturnType<typeof drizzle<typeof schema>> | undefined;
export function getDb() {
 const url=process.env.DATABASE_URL;
 if(!url) throw new Error('Production database is not configured. Connect the Neon database to this Vercel project.');
 return database ??= drizzle(neon(url),{schema});
}
