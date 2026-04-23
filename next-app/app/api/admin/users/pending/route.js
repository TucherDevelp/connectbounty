import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getAdminFromReq } from "@/lib/auth-server";
import { decryptData } from "@/lib/crypto";

export async function GET(req) {
  if (!getAdminFromReq(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const users = db.prepare("SELECT * FROM users WHERE account_status = 'pending' ORDER BY created_at DESC").all();
  
  const decryptedUsers = users.map(u => ({
    id: u.id,
    username: u.username,
    email: u.email,
    realName: decryptData(u.real_name) || "Nicht angegeben",
    dateOfBirth: decryptData(u.date_of_birth) || "Nicht angegeben",
    createdAt: u.created_at,
    kycStatus: u.kyc_status
  }));

  return NextResponse.json(decryptedUsers);
}
