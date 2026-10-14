import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const workers = sqliteTable('workers', {
 id: text('id').primaryKey(), name: text('name').notNull(), email: text('email').notNull().unique(),
 specialty: text('specialty').notNull(), permissions: text('permissions').notNull(), active: integer('active').notNull().default(1),
 branchId:text('branch_id'), startDate:text('start_date'), removed:integer('removed').notNull().default(0), endDate:text('end_date'), passwordHash: text('password_hash'), role: text('role').notNull().default('editor')
});
export const jobs = sqliteTable('jobs', { id: text('id').primaryKey(), assignee: text('assignee').notNull().default(''), payload: text('payload').notNull(), updated: text('updated').notNull() });
export const brands = sqliteTable('brands', { id: text('id').primaryKey(), name:text('name').notNull(), payload:text('payload').notNull() });
export const sessions = sqliteTable('sessions', { tokenHash:text('token_hash').primaryKey(), accountId:text('account_id').notNull(), expires:integer('expires').notNull() });
export const loginAttempts = sqliteTable('login_attempts', { key:text('key').primaryKey(), attempts:integer('attempts').notNull(), expires:integer('expires').notNull() });
export const branches = sqliteTable('branches', {id:text('id').primaryKey(),name:text('name').notNull(),payload:text('payload').notNull()});
export const attendance = sqliteTable('attendance', {id:text('id').primaryKey(),workerId:text('worker_id').notNull(),day:text('day').notNull(),payload:text('payload').notNull(),updated:text('updated').notNull()});
export const workEvents = sqliteTable('work_events', {id:text('id').primaryKey(),at:text('at').notNull(),actorId:text('actor_id').notNull(),jobId:text('job_id').notNull(),payload:text('payload').notNull()});
export const extraTasks = sqliteTable('extra_tasks',{id:text('id').primaryKey(),workerId:text('worker_id').notNull(),payload:text('payload').notNull(),updated:text('updated').notNull()});
