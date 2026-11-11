// One-time helper: run `npm run google:auth`, sign in with the Google account whose calendar you want to use,
// and it prints the GOOGLE_REFRESH_TOKEN to paste into .env.
import http from "node:http";
import { readFileSync } from "node:fs";
import { google } from "googleapis";

try {
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*"?(.*?)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {}

const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env;
if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  console.error("Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env first (see SETUP.md).");
  process.exit(1);
}
const redirect = "http://localhost:5555/callback";
const auth = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, redirect);
const url = auth.generateAuthUrl({ access_type: "offline", prompt: "consent", scope: ["https://www.googleapis.com/auth/calendar"] });

http.createServer(async (req, res) => {
  const code = new URL(req.url, redirect).searchParams.get("code");
  if (!code) return res.end("Missing code");
  const { tokens } = await auth.getToken(code);
  res.end("Done. You can close this tab and go back to the terminal.");
  console.log(`\nAdd this line to your .env:\n\nGOOGLE_REFRESH_TOKEN="${tokens.refresh_token}"\n`);
  process.exit(0);
}).listen(5555, () => console.log(`Open this link and sign in:\n\n${url}\n`));
