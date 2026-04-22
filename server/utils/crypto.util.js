const crypto = require("crypto");
require("dotenv").config();

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; 
const IV_LENGTH = 12; // Für AES-GCM typisch

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
  throw new Error("ENCRYPTION_KEY ist nicht gesetzt oder ungueltig (muss 64 Hex-Zeichen / 32 Bytes sein).");
}

const keyBuffer = Buffer.from(ENCRYPTION_KEY, "hex");

function encryptData(text) {
  if (!text) return text;
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv("aes-256-gcm", keyBuffer, iv);
    
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    
    const authTag = cipher.getAuthTag().toString("hex");
    
    // Format: iv:authTag:encryptedData
    return `${iv.toString("hex")}:${authTag}:${encrypted}`;
  } catch (error) {
    console.error("Verschluesselungsfehler:", error);
    return null;
  }
}

function decryptData(text) {
  if (!text) return text;
  try {
    const parts = text.split(":");
    if (parts.length !== 3) return text; // Vermutlich unverschluesselter Klartext (Legacy)

    const iv = Buffer.from(parts[0], "hex");
    const authTag = Buffer.from(parts[1], "hex");
    const encryptedText = parts[2];

    const decipher = crypto.createDecipheriv("aes-256-gcm", keyBuffer, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (error) {
    console.error("Entschluesselungsfehler:", error);
    return null;
  }
}

module.exports = { encryptData, decryptData };
