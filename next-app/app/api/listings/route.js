import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getUserFromReq } from "@/lib/auth-server";
import { v4 as uuidv4 } from "uuid";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const isMine = searchParams.get("mine");
  
  let query = `
    SELECT l.*, u.username as creator_username 
    FROM listings l 
    JOIN users u ON l.created_by = u.id 
    WHERE l.status = 'active'
  `;
  const params = [];

  const user = getUserFromReq(req);

  if (isMine === "true") {
    if (!user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    query = `
      SELECT l.*, u.username as creator_username 
      FROM listings l 
      JOIN users u ON l.created_by = u.id 
      WHERE l.created_by = ?
    `;
    params.push(user.id);
  } else if (category) {
    query += " AND l.category = ?";
    params.push(category);
  }

  query += " ORDER BY l.created_at DESC";

  try {
    const listings = db.prepare(query).all(...params);
    return NextResponse.json(listings);
  } catch (error) {
    console.error("Listings Get Error:", error);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}

export async function POST(req) {
  const user = getUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  try {
    const { category, company, title, location, bonus, description, isAnonymous } = await req.json();

    if (!category || !company || !title || !bonus) {
      return NextResponse.json({ error: "Pflichtfelder fehlen" }, { status: 400 });
    }

    const id = uuidv4();
    const isAnonInt = isAnonymous ? 1 : 0;
    
    // Inserate sind standardmäßig pending für Zero-Trust Workflow
    db.prepare(`
      INSERT INTO listings (id, category, company, title, location, bonus, description, is_anonymous, created_by, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `).run(id, category, company, title, location, bonus, description || "", isAnonInt, user.id);

    return NextResponse.json({ message: "Inserat erfolgreich erstellt und wartet auf Freigabe", id }, { status: 201 });
  } catch (error) {
    console.error("Listings Create Error:", error);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
