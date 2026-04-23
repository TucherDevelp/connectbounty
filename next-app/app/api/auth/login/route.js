import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import db from "@/lib/db";
import { signToken } from "@/lib/jwt";

export async function POST(req) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: "E-Mail und Passwort sind erforderlich" }, { status: 400 });
    }

    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    if (!user) {
      return NextResponse.json({ error: "Ungültige Anmeldedaten" }, { status: 401 });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return NextResponse.json({ error: "Ungültige Anmeldedaten" }, { status: 401 });
    }

    if (user.account_status !== 'active') {
      return NextResponse.json({ 
        error: "Dein Account ist noch nicht freigeschaltet oder wurde abgelehnt." 
      }, { status: 403 });
    }

    const token = signToken({ id: user.id, email: user.email });

    return NextResponse.json({
      message: "Login erfolgreich",
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        kycStatus: user.kyc_status,
        referralCode: user.referral_code
      }
    }, { status: 200 });

  } catch (error) {
    console.error("Login Error:", error);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
