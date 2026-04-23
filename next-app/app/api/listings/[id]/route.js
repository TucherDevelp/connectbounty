import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getUserFromReq } from "@/lib/auth-server";

export async function GET(req, { params }) {
  const listingId = params.id;
  try {
    const listing = db.prepare(`
      SELECT l.*, u.username as creator_username 
      FROM listings l 
      JOIN users u ON l.created_by = u.id 
      WHERE l.id = ? AND (l.status = 'active' OR l.status = 'pending')
    `).get(listingId);

    if (!listing) return NextResponse.json({ error: "Inserat nicht gefunden" }, { status: 404 });

    const user = getUserFromReq(req);
    // Hide username if anonymous and not the creator
    if (listing.is_anonymous === 1 && (!user || user.id !== listing.created_by)) {
      listing.creator_username = "Anonym";
    }

    return NextResponse.json(listing);
  } catch (error) {
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
