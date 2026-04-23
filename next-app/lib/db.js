import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

// Da wir in next-app/ sind, ist die DB in ../data.
// Später, wenn root Next.js ist, wird es process.cwd() + '/data' sein.
const DB_DIR = path.resolve(process.cwd(), "../data");
const DB_PATH = path.join(DB_DIR, "connectbounty.db");

if (!fs.existsSync(DB_DIR)) {
  try { fs.mkdirSync(DB_DIR, { recursive: true }); } catch (e) {}
}

const db = new Database(DB_PATH);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Ensure tables exist
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    real_name TEXT DEFAULT '',
    date_of_birth TEXT DEFAULT '',
    country TEXT DEFAULT 'Deutschland',
    city TEXT DEFAULT '',
    postal_code TEXT DEFAULT '',
    profile_visibility TEXT DEFAULT 'public',
    referral_code TEXT UNIQUE NOT NULL,
    referral_points INTEGER DEFAULT 0,
    payment_type TEXT DEFAULT 'bank',
    payment_iban TEXT DEFAULT '',
    payment_bic TEXT DEFAULT '',
    payment_paypal TEXT DEFAULT '',
    kyc_verified INTEGER DEFAULT 0,
    kyc_status TEXT DEFAULT 'pending',
    account_status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS listings (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    company TEXT NOT NULL,
    title TEXT NOT NULL,
    location TEXT DEFAULT '',
    bonus INTEGER NOT NULL,
    currency TEXT DEFAULT 'EUR',
    description TEXT DEFAULT '',
    is_anonymous INTEGER DEFAULT 1,
    created_by TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (created_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS referral_events (
    id TEXT PRIMARY KEY,
    referrer_id TEXT NOT NULL,
    referred_user_id TEXT NOT NULL,
    points_awarded INTEGER DEFAULT 2,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (referrer_id) REFERENCES users(id),
    FOREIGN KEY (referred_user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    listing_id TEXT NOT NULL,
    applicant_id TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    status TEXT DEFAULT 'open',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (listing_id) REFERENCES listings(id),
    FOREIGN KEY (applicant_id) REFERENCES users(id),
    FOREIGN KEY (owner_id) REFERENCES users(id),
    UNIQUE(listing_id, applicant_id)
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT,
    listing_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    receiver_id TEXT NOT NULL,
    message TEXT NOT NULL,
    ai_flagged INTEGER DEFAULT 0,
    ai_review_note TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id),
    FOREIGN KEY (listing_id) REFERENCES listings(id),
    FOREIGN KEY (sender_id) REFERENCES users(id),
    FOREIGN KEY (receiver_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS payout_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    amount REAL NOT NULL,
    method TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS admins (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    reset_code TEXT,
    reset_expires TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

export default db;
