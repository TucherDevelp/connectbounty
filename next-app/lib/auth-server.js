import { NextResponse } from "next/server";
import { verifyToken } from "./jwt";

export function getAdminFromReq(req) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.split(" ")[1];
  const decoded = verifyToken(token);
  if (decoded && decoded.role === "admin") {
    return decoded;
  }
  return null;
}

export function getUserFromReq(req) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.split(" ")[1];
  const decoded = verifyToken(token);
  return decoded;
}
