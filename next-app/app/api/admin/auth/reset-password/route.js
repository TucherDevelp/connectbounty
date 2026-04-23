import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import db from "@/lib/db";

export async function POST(req) {
  try {
    const { email, code, newPassword } = await req.json();

    if (!email || !code || !newPassword || newPassword.length < 8) {
      return NextResponse.json({ error: "Bitte alle Felder korrekt ausfüllen (Passwort min. 8 Zeichen)" }, { status: 400 });
    }

    const admin = db.prepare("SELECT * FROM admins WHERE email = ? AND reset_code = ?").get(email, code);

    if (!admin) {
      return NextResponse.json({ error: "Ungültiger Code oder E-Mail" }, { status: 400 });
    }

    if (new Date() > new Date(admin.reset_expires)) {
      return NextResponse.json({ error: "Dieser Code ist abgelaufen. Bitte fordere einen neuen an." }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    db.prepare("UPDATE admins SET password_hash = ?, reset_code = NULL, reset_expires = NULL WHERE email = ?")
      .run(passwordHash, email);

    return NextResponse.json({ message: "Passwort erfolgreich geändert" });
  } catch (error) {
    console.error("Admin Reset Password Error:", error);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
