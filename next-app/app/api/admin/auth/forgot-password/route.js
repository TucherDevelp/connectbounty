import { NextResponse } from "next/server";
import db from "@/lib/db";
import crypto from "crypto";

export async function POST(req) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "E-Mail ist erforderlich" }, { status: 400 });
    }

    const admin = db.prepare("SELECT id FROM admins WHERE email = ?").get(email);
    if (!admin) {
      return NextResponse.json({ error: "Kein Admin mit dieser E-Mail gefunden" }, { status: 404 });
    }

    const resetCode = crypto.randomInt(100000, 999999).toString();
    const expires = new Date(Date.now() + 15 * 60000).toISOString(); // 15 Minuten

    db.prepare("UPDATE admins SET reset_code = ?, reset_expires = ? WHERE email = ?")
      .run(resetCode, expires, email);

    console.log(`\n=== PASSWORT RESET ANGEFORDERT ===`);
    console.log(`E-Mail: ${email}`);
    console.log(`Reset Code: ${resetCode}`);
    console.log(`(Dieser Code ist für 15 Minuten gültig)`);
    console.log(`==================================\n`);

    return NextResponse.json({ message: "Reset-Code wurde generiert (siehe Terminal-Logs)." });
  } catch (error) {
    console.error("Admin Forgot Password Error:", error);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
