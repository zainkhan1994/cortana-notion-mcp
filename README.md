# Cortana — WhatsApp → Notion AI Command Center

**A real-time AI assistant that classifies WhatsApp messages and searches your Notion workspace.**

Send a message to WhatsApp, get instant results from your Notion database. Built for the MLH Notion MCP Challenge (March 2026).

## 🎯 What It Does

1. **You send a WhatsApp message** (e.g., "lab results January")
2. **Cortana classifies it** against 6 life domains (Personal, Health, Work, Projects, Growth, Data)
3. **Searches your Notion workspace** for matching pages
4. **Replies via WhatsApp** with the domain + matched pages

**Live example:**
- Message: `"Tell me about R-Cubed"`
- Response: `🟦 Work` — Found 4 results (R.C Sales Review, Event in R-Cubed, etc.)

## 🏗️ Architecture

```
WhatsApp Message
    ↓
Twilio Sandbox Webhook
    ↓
Cloudflare Worker (CF Adapter)
    ├─ Parse Twilio form data
    ├─ Classify message (6 domains)
    └─ Search Notion API
    ↓
Blueprint Classification + Notion Search Results
    ↓
Twilio WhatsApp Reply
    ↓
Message Delivered to You
```

### Components

| Component | Role | Tech Stack |
|-----------|------|-----------|
| **Notion Worker "Zeta"** | Tool definitions & execution | Notion Workers SDK (`@notionhq/workers`) |
| **CF Adapter** | HTTP gateway, classification logic | Cloudflare Workers, TypeScript |
| **Twilio Integration** | WhatsApp message routing | Twilio WhatsApp Sandbox API |
| **Notion Search** | Page lookup | Notion API (`@notionhq/client`) |

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Cloudflare account (free tier works)
- Twilio account (free trial)
- Notion integration token

### 1. Clone & Install
```bash
git clone https://github.com/zainkhan1994/cortana-notion-mcp.git
cd cortana-worker-full
npm install
cd cf-adapter && npm install && cd ..
```

### 2. Deploy Notion Worker (Zeta)
```bash
# Set env vars from Keychain (macOS)
export NOTION_API_TOKEN=$(security find-generic-password -s "notion-cli" -a "YOUR_WORKSPACE_ID" -w)
export NOTION_WORKSPACE_ID="YOUR_WORKSPACE_ID"

# Login & deploy
ntn login
ntn workers deploy --name Zeta

# Set worker env vars
ntn workers env set NOTION_API_TOKEN="ntn_YOUR_TOKEN_HERE"
```

### 3. Deploy CF Adapter
```bash
cd cf-adapter
npm install
npx wrangler login
npx wrangler deploy

# Set CF secrets
npx wrangler secret put NOTION_API_TOKEN
npx wrangler secret put TWILIO_ACCOUNT_SID
npx wrangler secret put TWILIO_AUTH_TOKEN
```

### 4. Wire Twilio Webhook
In Twilio Console → Messaging → Try it out → WhatsApp Sandbox → Sandbox settings:
- **When a message comes in:** `https://cortana-twilio-adapter.cortana-khanstruct.workers.dev/whatsapp`
- **Method:** POST
- Click **Save**

### 5. Test
Send a message to `+14155238886` from WhatsApp (after joining sandbox with code `join powerful-torn`).

## 📦 Project Structure

```
cortana-worker-full/
├── src/
│   ├── index.ts          # Notion Worker tools (classifyAndRespond, triageBacklog, dispatchBlueprint)
│   └── webhook.ts        # Webhook handler (reference)
├── cf-adapter/
│   ├── index.ts          # CF Worker: Twilio gateway + classification
│   ├── package.json
│   ├── tsconfig.json
│   └── wrangler.toml     # Cloudflare config
├── package.json
├── tsconfig.json
└── README.md
```

## 🧠 How Classification Works

The CF adapter uses keyword-based classification:

| Domain | Keywords | Emoji |
|--------|----------|-------|
| **Health** | health, medical, lab, results, fitness, supplement, bloodwork | 🟨 |
| **Work** | work, job, consulting, client, R-Cubed | 🟦 |
| **Projects** | project, build, code, cortana, hackathon, github | 🟪 |
| **Growth** | learning, study, course, certification, AI, ML | ⬛ |
| **Personal** | personal, family, account, finance, home | 🟥 |
| **Data** | archive, import, database, notion, system | 🗄️ |

Example:
- Query: `"lab results January"` → Keywords matched: `["lab", "results"]` → Domain: **Health**

## 🛠️ Tech Stack

- **Notion Workers:** TypeScript, `@notionhq/workers` SDK
- **Cloudflare Workers:** TypeScript, Wrangler CLI
- **APIs:** Notion Search API, Twilio WhatsApp API
- **DevOps:** GitHub, wrangler secrets

## 📋 Tools (Notion Worker)

### ✅ Live
- **`classifyAndRespond`** — Classify message + search Notion + return results

### 🚧 Planned
- **`triageBacklog`** — Read backlog database, return priority-sorted items
- **`dispatchBlueprint`** — Lightweight classifier (domain + confidence score)

## 🔐 Environment Variables

### Notion Worker (set via `ntn workers env set`)
```
NOTION_API_TOKEN=ntn_YOUR_TOKEN
```

### CF Adapter (set via `npx wrangler secret put`)
```
NOTION_API_TOKEN=ntn_YOUR_TOKEN
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
```

## 🧪 Testing

### Local test (classify + search)
```bash
cd cortana-worker-full
export NOTION_API_TOKEN=$(security find-generic-password -s "notion-cli" -a "YOUR_WORKSPACE_ID" -w)
ntn workers exec classifyAndRespond -d '{"message":"lab results January"}'
```

### Test CF adapter
```bash
curl -X POST https://cortana-twilio-adapter.cortana-khanstruct.workers.dev/health
# Should return: {"status":"ok"}
```

## 🐛 Known Issues & Fixes

### Issue: `ntn workers deploy` returns `unauthorized`
**Root cause:** macOS Keychain not returning auth token to CLI.
**Fix:** Export env vars manually:
```bash
export NOTION_API_TOKEN=$(security find-generic-password -s "notion-cli" -a "YOUR_WORKSPACE_ID" -w)
export NOTION_WORKSPACE_ID="YOUR_WORKSPACE_ID"
```

### Issue: Twilio replies fail with error 21910 (Invalid 'To')
**Root cause:** Missing `whatsapp:` prefix on phone numbers.
**Fix:** Ensure CF adapter uses `whatsapp:+1234567890` format.

## 📸 Demo

WhatsApp conversation:
```
You: "Tell me about R-Cubed"
Cortana: "🟦 Work
Found 4 result(s):
• R.C Sales Review- Mar 22
• Eventn R-Cubed — WordPress
• HubSpot and R-Cubed Consulting"
```

## 🎓 The Story

Built in one intense night session for the MLH Notion MCP Challenge. Hit a brutal `unauthorized` bug on `ntn workers deploy` for hours — turned out to be a macOS Keychain issue where the CLI couldn't read auth tokens back. Fix was exporting env vars manually. Finally deployed, wired up Twilio, and got end-to-end WhatsApp → Notion working.

## 📚 References

- [Notion Workers Documentation](https://developers.notion.com/docs/create-a-notion-app)
- [Twilio WhatsApp Sandbox](https://www.twilio.com/docs/whatsapp/quickstart/node)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Notion API Reference](https://developers.notion.com/reference/intro)

## 👤 Author

**Zain Khan** (@zainkhan1994)
- Studio: Khanstruct
- Based in: Tulsa, OK

## 📄 License

MIT

---

**Submitted to:** MLH Notion MCP Challenge (March 2026)
**Deadline:** March 29, 2026 11:59 PM PST
