import { NextResponse } from "next/server";
import db from "@/lib/db";
import { extractUserId } from "@/lib/jwt";
import { decryptData } from "@/lib/crypto";

export async function GET(req) {
  try {
    const userId = extractUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    if (!user) {
      return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 404 });
    }

    // Aktuelles Guthaben berechnen (Beispiel: Bonussumme aller vermittelten/angenommenen Kandidaten)
    const balanceQuery = db.prepare(`
      SELECT SUM(l.bonus) as total 
      FROM conversations c 
      JOIN listings l ON c.listing_id = l.id 
      WHERE c.applicant_id = ? AND c.status = 'accepted'
    `).get(userId);
    const availableBalance = balanceQuery.total || 0;

    return NextResponse.json({
      id: user.id,
      username: user.username,
      email: user.email,
      realName: decryptData(user.real_name) || "",
      dateOfBirth: decryptData(user.date_of_birth) || "",
      country: user.country,
      city: user.city,
      postalCode: user.postal_code,
      profileVisibility: user.profile_visibility,
      referralCode: user.referral_code,
      referralPoints: user.referral_points,
      kycStatus: user.kyc_status,
      paymentType: user.payment_type,
      paymentIban: decryptData(user.payment_iban) || "",
      paymentBic: decryptData(user.payment_bic) || "",
      paymentPaypal: decryptData(user.payment_paypal) || "",
      availableBalance
    });
  } catch (error) {
    console.error("Auth Me Error:", error);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    const userId = extractUserId(req);
    if (!userId) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

    const body = await req.json();
    const { realName, dateOfBirth, city, postalCode, profileVisibility, paymentType, paymentIban, paymentBic, paymentPaypal } = body;

    const { encryptData } = await import("@/lib/crypto");

    const encName = encryptData(realName || "");
    const encDob = encryptData(dateOfBirth || "");
    const encIban = encryptData(paymentIban || "");
    const encBic = encryptData(paymentBic || "");
    const encPaypal = encryptData(paymentPaypal || "");

    const result = db.prepare(`
      UPDATE users 
      SET real_name = ?, date_of_birth = ?, city = ?, postal_code = ?, profile_visibility = ?, 
          payment_type = ?, payment_iban = ?, payment_bic = ?, payment_paypal = ?
      WHERE id = ?
    `).run(encName, encDob, city || "", postalCode || "", profileVisibility || "public", 
           paymentType || "bank", encIban, encBic, encPaypal, userId);

    if (result.changes === 0) return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 404 });
    
    return NextResponse.json({ message: "Profil erfolgreich aktualisiert" });
  } catch (error) {
    console.error("Profile Update Error:", error);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
