import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getAdminFromReq } from "@/lib/auth-server";

export async function PUT(req, { params }) {
  if (!getAdminFromReq(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
  const id = params.id;
  const result = db.prepare("UPDATE listings SET status = 'active' WHERE id = ?").run(id);
  if (result.changes === 0) return NextResponse.json({ error: "Inserat nicht gefunden" }, { status: 404 });
  
  return NextResponse.json({ message: "Inserat freigegeben" });
}
