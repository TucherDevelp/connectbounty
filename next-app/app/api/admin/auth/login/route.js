import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import db from "@/lib/db";
import { signToken } from "@/lib/jwt";

export async function POST(req) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "E-Mail und Passwort erforderlich" }, { status: 400 });
    }

    const admin = db.prepare("SELECT * FROM admins WHERE email = ?").get(email);
    if (!admin) {
      return NextResponse.json({ error: "Ungültige Anmeldedaten" }, { status: 401 });
    }

    const isValid = await bcrypt.compare(password, admin.password_hash);
    if (!isValid) {
      return NextResponse.json({ error: "Ungültige Anmeldedaten" }, { status: 401 });
    }

    // Token ist 12 Stunden gültig für Admin
    const token = signToken({ id: admin.id, role: 'admin' }, '12h');

    return NextResponse.json({
      message: "Login erfolgreich",
      token,
      admin: { id: admin.id, username: admin.username, email: admin.email }
    });
  } catch (error) {
    console.error("Admin Login Error:", error);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
