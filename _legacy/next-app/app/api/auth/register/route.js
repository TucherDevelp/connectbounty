import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import db from "@/lib/db";

function generateReferralCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  const existing = db.prepare("SELECT id FROM users WHERE referral_code = ?").get(code);
  return existing ? generateReferralCode() : code;
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { username, email, password, referralCode } = body;

    if (!username || !email || !password) {
      return NextResponse.json({ error: "Benutzername, E-Mail und Passwort sind erforderlich" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Passwort muss mindestens 6 Zeichen haben" }, { status: 400 });
    }

    const existingEmail = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (existingEmail) return NextResponse.json({ error: "E-Mail bereits registriert" }, { status: 409 });

    const existingUser = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
    if (existingUser) return NextResponse.json({ error: "Benutzername bereits vergeben" }, { status: 409 });

    const passwordHash = await bcrypt.hash(password, 12);
    const id = uuidv4();
    const myReferralCode = generateReferralCode();

    db.prepare(`
      INSERT INTO users (id, username, email, password_hash, referral_code)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, username, email, passwordHash, myReferralCode);

    if (referralCode) {
      const referrer = db.prepare("SELECT id FROM users WHERE referral_code = ?").get(referralCode.toUpperCase());
      if (referrer) {
        db.prepare(`
          INSERT INTO referral_events (id, referrer_id, referred_user_id)
          VALUES (?, ?, ?)
        `).run(uuidv4(), referrer.id, id);
        
        db.prepare(`
          UPDATE users SET referral_points = referral_points + 2 WHERE id = ?
        `).run(referrer.id);
      }
    }

    return NextResponse.json({ message: "Benutzer erfolgreich registriert (Status: pending)", id }, { status: 201 });
  } catch (error) {
    console.error("Register Error:", error);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
