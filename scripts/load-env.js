/**
 * Load .env FIRST before any other application code runs.
 * Use: node -r ./scripts/load-env.js scripts/your-script.js
 * Or: require('./scripts/load-env.js') as the first line in any script.
 *
 * Load order: .env (base) then .env.local (overrides). Matches Next.js behavior.
 */
const path = require("path");
const fs = require("fs");

const root = path.resolve(__dirname, "..");

// 1) .env (base)
const envPath = path.join(root, ".env");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf8");
  parseAndSet(content);
}

// 2) .env.local (overrides)
const envLocalPath = path.join(root, ".env.local");
if (fs.existsSync(envLocalPath)) {
  const content = fs.readFileSync(envLocalPath, "utf8");
  parseAndSet(content);
}

function parseAndSet(content) {
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const m = trimmed.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m) {
      const key = m[1];
      let val = m[2].trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1).replace(/\\"/g, '"');
      if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1).replace(/\\'/g, "'");
      process.env[key] = val;
    }
  }
}

module.exports = {};
