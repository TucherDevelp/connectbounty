// Lädt .env Variablen manuell (kein dotenv-Paket nötig)
const fs = require("fs");
const path = require("path");

function loadEnv() {
  const envPath = path.resolve(__dirname, "../../.env");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const [key, ...valueParts] = trimmed.split("=");
    if (key && valueParts.length) {
      process.env[key.trim()] = valueParts.join("=").trim();
    }
  }
}

loadEnv();

module.exports = {
  PORT: process.env.PORT || 8000,
  JWT_SECRET: process.env.JWT_SECRET || "changeme_secret",
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
};
