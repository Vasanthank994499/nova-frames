import { pgTable, text, integer, bigint } from 'drizzle-orm/pg-core';
export const workers = pgTable('workers', {
 id: text('id').primaryKey(), name: text('name').notNull(), email: text('email').notNull().unique(),
 specialty: text('specialty').notNull(), permissions: text('permissions').notNull(), active: integer('active').notNull().default(1),
 branchId:text('branch_id'), startDate:text('start_date'), removed:integer('removed').notNull().default(0), endDate:text('end_date'), passwordHash: text('password_hash'), role: text('role').notNull().default('editor')
});
export const jobs = pgTable('jobs', { id: text('id').primaryKey(), assignee: text('assignee').notNull().default(''), payload: text('payload').notNull(), updated: text('updated').notNull() });
export const brands = pgTable('brands', { id: text('id').primaryKey(), name:text('name').notNull(), payload:text('payload').notNull() });
export const sessions = pgTable('sessions', { tokenHash:text('token_hash').primaryKey(), accountId:text('account_id').notNull(), expires:bigint('expires',{mode:'number'}).notNull() });
export const loginAttempts = pgTable('login_attempts', { key:text('key').primaryKey(), attempts:integer('attempts').notNull(), expires:bigint('expires',{mode:'number'}).notNull() });
export const branches = pgTable('branches', {id:text('id').primaryKey(),name:text('name').notNull(),payload:text('payload').notNull()});
export const attendance = pgTable('attendance', {id:text('id').primaryKey(),workerId:text('worker_id').notNull(),day:text('day').notNull(),payload:text('payload').notNull(),updated:text('updated').notNull()});
export const workEvents = pgTable('work_events', {id:text('id').primaryKey(),at:text('at').notNull(),actorId:text('actor_id').notNull(),jobId:text('job_id').notNull(),payload:text('payload').notNull()});
export const extraTasks = pgTable('extra_tasks',{id:text('id').primaryKey(),workerId:text('worker_id').notNull(),payload:text('payload').notNull(),updated:text('updated').notNull()});
export const staffRequests = pgTable('staff_requests',{id:text('id').primaryKey(),workerId:text('worker_id').notNull(),status:text('status').notNull(),payload:text('payload').notNull(),updated:text('updated').notNull()});
export const expenses = pgTable('expenses',{id:text('id').primaryKey(),workerId:text('worker_id').notNull(),managerId:text('manager_id').notNull(),day:text('day').notNull(),amountCents:bigint('amount_cents',{mode:'number'}).notNull(),payload:text('payload').notNull(),updated:text('updated').notNull()});
export const accessEvents = pgTable('access_events',{id:text('id').primaryKey(),workerId:text('worker_id').notNull(),day:text('day').notNull(),payload:text('payload').notNull()});
