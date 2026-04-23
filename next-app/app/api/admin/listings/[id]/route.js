import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getAdminFromReq } from "@/lib/auth-server";

export async function PUT(req, { params }) {
  if (!getAdminFromReq(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
  const id = params.id;
  try {
    const { title, company, category, bonus, status } = await req.json();

    if (!title || !company || !category || bonus == null) {
      return NextResponse.json({ error: "Bitte alle Pflichtfelder ausfüllen" }, { status: 400 });
    }

    const result = db.prepare(`
      UPDATE listings 
      SET title = ?, company = ?, category = ?, bonus = ?, status = ?
      WHERE id = ?
    `).run(title, company, category, bonus, status, id);

    if (result.changes === 0) return NextResponse.json({ error: "Inserat nicht gefunden" }, { status: 404 });
    return NextResponse.json({ message: "Inserat erfolgreich aktualisiert" });
  } catch (e) {
    return NextResponse.json({ error: "Serverfehler" }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  if (!getAdminFromReq(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
  const id = params.id;
  const result = db.prepare("DELETE FROM listings WHERE id = ?").run(id);
  if (result.changes === 0) return NextResponse.json({ error: "Inserat nicht gefunden" }, { status: 404 });
  return NextResponse.json({ message: "Inserat erfolgreich gelöscht" });
}
