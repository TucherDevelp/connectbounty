import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getAdminFromReq } from "@/lib/auth-server";

export async function GET(req) {
  if (!getAdminFromReq(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const listings = db.prepare(`
    SELECT l.*, u.username as creator_username 
    FROM listings l 
    JOIN users u ON l.created_by = u.id 
    WHERE l.status = 'pending' 
    ORDER BY l.created_at DESC
  `).all();
  
  return NextResponse.json(listings);
}
