import { pgTable, text, varchar, timestamp, boolean, uuid, integer, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';

// === USERS ===
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  emailVerifiedAt: timestamp('email_verified_at'),
  passwordHash: varchar('password_hash', { length: 255 }),
  namaLengkap: varchar('nama_lengkap', { length: 255 }),
  avatarUrl: text('avatar_url'),
  role: varchar('role', { length: 32 }).notNull().default('bumdes'), // super_admin | karyawan_admin | bumdes
  tenantId: uuid('tenant_id'),
  authProvider: varchar('auth_provider', { length: 32 }).notNull().default('email'), // email | google | both
  googleId: varchar('google_id', { length: 64 }),
  isActive: boolean('is_active').notNull().default(true),
  lastLoginAt: timestamp('last_login_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  emailIdx: uniqueIndex('users_email_idx').on(t.email),
  googleIdIdx: index('users_google_id_idx').on(t.googleId),
  tenantIdx: index('users_tenant_idx').on(t.tenantId),
}));

// === SESSIONS (refresh tokens, rotated) ===
export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  refreshTokenHash: varchar('refresh_token_hash', { length: 255 }).notNull(),
  parentId: uuid('parent_id'), // chain of rotations; null = root
  userAgent: text('user_agent'),
  ipAddress: varchar('ip_address', { length: 64 }),
  revokedAt: timestamp('revoked_at'),
  revokedReason: varchar('revoked_reason', { length: 64 }),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  userIdx: index('sessions_user_idx').on(t.userId),
  tokenIdx: index('sessions_token_idx').on(t.refreshTokenHash),
}));

// === EMAIL VERIFICATION (OTP + magic link) ===
export const verificationTokens = pgTable('verification_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 255 }).notNull(),
  purpose: varchar('purpose', { length: 32 }).notNull(), // email_verify | password_reset
  otpHash: varchar('otp_hash', { length: 255 }),
  magicTokenHash: varchar('magic_token_hash', { length: 255 }),
  consumedAt: timestamp('consumed_at'),
  attempts: integer('attempts').notNull().default(0),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  emailPurposeIdx: index('verification_email_purpose_idx').on(t.email, t.purpose),
  magicIdx: index('verification_magic_idx').on(t.magicTokenHash),
}));

// === AUDIT LOG ===
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  email: varchar('email', { length: 255 }),
  event: varchar('event', { length: 64 }).notNull(), // login_success | login_failed | register | verify_email | password_reset | logout | refresh | google_link
  ipAddress: varchar('ip_address', { length: 64 }),
  userAgent: text('user_agent'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  userIdx: index('audit_user_idx').on(t.userId),
  eventIdx: index('audit_event_idx').on(t.event),
  createdIdx: index('audit_created_idx').on(t.createdAt),
}));

// === SIGNUP THROTTLE (per IP/email) ===
export const signupAttempts = pgTable('signup_attempts', {
  id: uuid('id').primaryKey().defaultRandom(),
  ipAddress: varchar('ip_address', { length: 64 }).notNull(),
  email: varchar('email', { length: 255 }),
  succeeded: boolean('succeeded').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  ipIdx: index('signup_ip_idx').on(t.ipAddress, t.createdAt),
  emailIdx: index('signup_email_idx').on(t.email, t.createdAt),
}));
