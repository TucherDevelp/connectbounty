import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import db from "@/lib/db";

export async function POST(req) {
  try {
    const adminExists = db.prepare("SELECT id FROM admins LIMIT 1").get();
    if (adminExists) {
      return NextResponse.json({ error: "Admin-Account existiert bereits. Setup nicht mehr möglich." }, { status: 403 });
    }

    const { username, email, password } = await req.json();

    if (!username || !email || !password || password.length < 8) {
      return NextResponse.json({ error: "Bitte alle Felder ausfüllen. Passwort mind. 8 Zeichen." }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    db.prepare(`
      INSERT INTO admins (id, username, email, password_hash)
      VALUES (?, ?, ?, ?)
    `).run(uuidv4(), username, email, passwordHash);

    return NextResponse.json({ message: "Admin-Account erfolgreich erstellt!" });
  } catch (error) {
    console.error("Admin Register Error:", error);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
