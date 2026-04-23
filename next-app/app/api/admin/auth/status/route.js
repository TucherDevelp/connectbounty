import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET() {
  const admin = db.prepare("SELECT id FROM admins LIMIT 1").get();
  return NextResponse.json({ setupRequired: !admin });
}
