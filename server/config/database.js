const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const DB_DIR = path.resolve(__dirname, "../data");
const DB_PATH = path.join(DB_DIR, "connectbounty.db");

// Sicherstellen dass data/ Ordner existiert
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const db = new Database(DB_PATH);

// WAL-Mode für bessere Performance
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ──────────────────────────────────────────
// Schema-Erstellung
// ──────────────────────────────────────────
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
    status TEXT DEFAULT 'active',
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

// Migration for existing admins table
try {
  db.exec(`
    ALTER TABLE admins ADD COLUMN reset_code TEXT;
    ALTER TABLE admins ADD COLUMN reset_expires TEXT;
  `);
} catch (e) {
  // Columns already exist or error, ignore
}

// Migration for users and listings tables (from older versions)
try {
  db.exec(`
    ALTER TABLE users ADD COLUMN account_status TEXT DEFAULT 'pending';
  `);
} catch (e) {}

try {
  db.exec(`
    ALTER TABLE listings ADD COLUMN status TEXT DEFAULT 'pending';
  `);
} catch (e) {}

// Demo-Listings einfügen falls DB leer
const count = db.prepare("SELECT COUNT(*) as c FROM listings").get();
if (count.c === 0) {
  const { v4: uuidv4 } = require("uuid");
  const demoUserId = uuidv4();
  const demoReferral = "DEMO01";

  db.prepare(`
    INSERT OR IGNORE INTO users (id, username, email, password_hash, real_name, referral_code)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(demoUserId, "@demo_admin", "demo@connectbounty.de", "demo_hash", "Demo Admin", demoReferral);

  const demoListings = [
    { id: uuidv4(), category: "student-programs", company: "PwC", title: "Tax Assistant Praktikum", location: "Frankfurt, DE", bonus: 1500, description: "Steuer-Praktikum mit attraktivem Einstellungsbonus nach Übernahme." },
    { id: uuidv4(), category: "student-programs", company: "Deloitte", title: "Data Analyst Werkstudent", location: "München, DE", bonus: 2000, description: "Datenanalyse-Position mit Übernahmegarantie und Bonus." },
    { id: uuidv4(), category: "sign-on-bonuses", company: "SAP", title: "Software Engineer", location: "Walldorf, DE", bonus: 5000, description: "Direkte Anstellung mit Sign-On-Bonus für Festangestellte." },
    { id: uuidv4(), category: "sign-on-bonuses", company: "BMW Group", title: "Product Manager", location: "München, DE", bonus: 8000, description: "Produktmanager mit Erfahrung in agilen Projekten gesucht." },
    { id: uuidv4(), category: "contractor-roles", company: "Siemens", title: "IT-Berater (Freelance)", location: "Berlin, DE", bonus: 3000, description: "6-Monats-Projekt, Verlängerungsoption. Vermittlungsbonus bei Vertragsabschluss." },
    { id: uuidv4(), category: "sales-incentives", company: "HubSpot", title: "Sales Representative DACH", location: "Remote, DE", bonus: 4500, description: "Sales-Position mit leistungsbasiertem Bonus-Programm." },
  ];

  const insert = db.prepare(`
    INSERT INTO listings (id, category, company, title, location, bonus, currency, description, is_anonymous, created_by)
    VALUES (?, ?, ?, ?, ?, ?, 'EUR', ?, 1, ?)
  `);
  for (const l of demoListings) {
    insert.run(l.id, l.category, l.company, l.title, l.location, l.bonus, l.description, demoUserId);
  }
}

module.exports = db;
