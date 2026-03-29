# Cortana: From Keychain Hell to Shipping an AI Command Center in One Night

> **TL;DR:** Built a WhatsApp-to-Notion AI command center using Notion Workers + Cloudflare in 6 hours. Hit three show-stopping bugs (macOS Keychain auth, API architecture mismatch, Twilio phone formatting). Shipped an MVP that classifies messages across 6 Blueprint domains and returns instant Notion search results. Code: https://github.com/zainkhan1994/cortana-notion-mcp

---

## The Setup

It's March 28, 2026. MLH's Notion MCP Challenge deadline is tomorrow night. I have a vision: **Cortana** — a WhatsApp chatbot that understands what you're trying to do and searches your Notion workspace for relevant context.

Think about it: You're at a coffee shop and you say "I need info on lab results from January." Instead of diving into Notion, opening 5 tabs, scrolling through databases — you text WhatsApp and get instant results back.

The tech stack:
- **Notion Workers** (Alpha) — Custom agent tools for classification and search
- **Cloudflare Workers** — HTTP gateway for Twilio webhooks
- **Twilio WhatsApp Sandbox** — Mobile input/output
- **Notion API** — Search across workspace
- **Blueprint** — 6 semantic domains (Personal 🟥, Health 🟨, Projects 🟪, Work 🟦, Growth ⬛, Data 🗄️)

I have all the credentials. It should take 2 hours max.

It took 6 hours. Here's why.

---

## Bug #1: The Keychain Nightmare (1.5 hours lost)

### The Problem
```bash
$ ntn workers deploy
error: unauthorized
```

I'd done `ntn login` successfully. The CLI had my credentials. But every deploy attempt returned `unauthorized`. No helpful error messages. Just rejection.

### The Investigation
I dug deeper:
```bash
$ ntn workers list
# ... same authorization error

$ ntn login
# Login dialog → Enter credentials → Success message
# But deploy still fails
```

**It's the Keychain.** macOS stores credentials in Keychain, and the Notion CLI was *trying* to pull them out. But something was broken in that handshake.

### The Fix (Midnight Frustration)
After 30 minutes of thrashing, I realized: **I can bypass Keychain entirely.**

I found where the CLI stores the token in Keychain and extracted it manually:

```bash
export NOTION_API_TOKEN=$(security find-generic-password \
  -s "notion-cli" \
  -a "f75638a8-fe44-4905-8cbd-488fc1f08e0e" \
  -w)
export NOTION_WORKSPACE_ID="f75638a8-fe44-4905-8cbd-488fc1f08e0e"
```

Then in the same terminal:
```bash
$ ntn workers deploy
✅ Deployed cortana-worker (Zeta) in 2.3s
```

**Lesson learned:** macOS Keychain integration is fragile. If you're scripting Notion CLI deploys, export env vars explicitly every session.

---

## Bug #2: The Architecture Mismatch (2 hours lost)

### The Design I Expected
1. Twilio receives WhatsApp message
2. Cloudflare adapter sends HTTP request to Notion Worker tool
3. Notion Worker classifies + searches
4. Cloudflare adapter forwards reply to Twilio

### What I Built (First Attempt)
```typescript
// cf-adapter/index.ts
const response = await fetch(
  `https://api.notionworkers.com/v1/workers/${NOTION_WORKER_ID}/tools/classifyAndRespond/execute`,
  {
    method: "POST",
    headers: { 
      "Authorization": `Bearer ${NOTION_API_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ message: userMessage })
  }
);
```

### The Error
```
POST /v1/workers/{id}/tools/classifyAndRespond/execute
400 Bad Request
"invalid_request_url"
```

### The Reality Check
Notion Workers tools aren't HTTP-callable public APIs. They're designed for Notion Agents — internal automation within the Notion ecosystem. There's no `/v1/workers/{id}/tools/{name}/execute` endpoint.

**I had built something architecturally impossible.**

### The Pivot (1:30 AM)
Instead of calling the worker, I **moved the classification logic into the CF adapter itself.** 

I duplicated the `classifyQuery()` function (keyword-based classifier across 6 domains) and the `searchNotion()` function (Notion API v1 `/search` endpoint) into the Cloudflare worker.

**Trade-off:** Code duplication between Notion Worker and CF adapter
**Benefit:** No coupling, works immediately, stays under Cloudflare's execution limits

```typescript
// cf-adapter/index.ts
async function classifyQuery(message: string) {
  const domains = {
    "Personal": ["meeting", "friends", "weekend", "personal"],
    "Health": ["lab", "results", "doctor", "health", "fitness"],
    "Projects": ["build", "launch", "launch", "project", "shipped"],
    "Work": ["r-cubed", "client", "proposal", "deal", "closed"],
    "Growth": ["learn", "course", "skill", "certification"],
    "Data": ["metrics", "analytics", "revenue", "dashboard"]
  };
  // ... keyword matching logic
}
```

This unlocked everything downstream.

---

## Bug #3: Twilio's Phone Number Formatting (30 minutes lost)

### The Symptom
Messages were classifying ✅
Notion was returning results ✅
But Twilio replies were failing with:

```
Error 21910: Invalid 'To' parameter
Status: Failed
```

### The Investigation
I checked Twilio's logs. My CF adapter WAS sending the reply request. The issue was in the request body:

```json
{
  "To": "+18323821675",        // ❌ Wrong format for WhatsApp
  "From": "+14155238886",
  "Body": "..."
}
```

### The Fix (3 AM Eureka)
**WhatsApp on Twilio requires a `whatsapp:` URI prefix:**

```typescript
const cleanPhone = toPhone.startsWith("whatsapp:") 
  ? toPhone 
  : `whatsapp:${toPhone}`;

const response = await fetch(
  "https://api.twilio.com/2010-04-01/Accounts/{SID}/Messages.json",
  {
    method: "POST",
    headers: {
      "Authorization": "Basic " + btoa(accountSid + ":" + authToken)
    },
    body: new URLSearchParams({
      "To": `whatsapp:${cleanPhone}`,
      "From": `whatsapp:${fromPhone}`,
      "Body": message
    }).toString()
  }
);
```

Redeploy, test message:
```
User: "Tell me about R-Cubed"
Cortana: "🟦 Work — Found 4 results: R.C Sales Review, Event in R-Cubed, HubSpot and R-Cubed Consulting"
Status: ✅ Delivered
```

**Message delivered in 2 seconds.**

---

## What Actually Works

By 4:30 AM, the full pipeline was live:

**Architecture:**
```
WhatsApp
   ↓
Twilio Webhook
   ↓
Cloudflare Worker (cortana-twilio-adapter)
   ├→ Parse message + phone
   ├→ Classify across 6 Blueprint domains
   ├→ Search Notion workspace
   ├→ Format results
   └→ Reply via Twilio
   ↓
WhatsApp (2 second round-trip)
```

**Tested Flows:**
1. "Lab results January" → 🟨 Health domain → 2 results (Transparent Labs, Greentown Labs)
2. "Tell me about R-Cubed" → 🟦 Work domain → 4 results
3. "Hey" → 🟥 Personal domain → 5 results

---

## The Tech Breakdown

### Notion Workers (Zeta)
Deployed 3 tools for future agent integration:

```typescript
const tools = {
  classifyAndRespond: {
    description: "Classify a message and search Notion",
    inputSchema: j.object({ message: j.string() }),
    execute: async (input) => { ... }
  },
  dispatchBlueprint: {
    description: "Lightweight domain classifier with confidence score",
    inputSchema: j.object({ text: j.string() }),
    execute: async (input) => { ... }
  },
  triageBacklog: {
    description: "Read recent items from backlog database",
    inputSchema: j.object({}),
    execute: async () => { ... }
  }
};
```

**Key learning:** Notion Workers uses `j.object()` schema builder (not Zod). The SDK is minimal, the alpha docs are sparse, but it works.

### Cloudflare Workers (HTTP Adapter)
Lightweight TypeScript worker handling all Twilio integration:

**wrangler.toml:**
```toml
name = "cortana-twilio-adapter"
main = "index.ts"
compatibility_date = "2024-01-01"

[[env.production.secrets]]
NOTION_API_TOKEN = "ntn_Y337..."
TWILIO_ACCOUNT_SID = "ACf0bc..."
TWILIO_AUTH_TOKEN = "80c1f..."
```

**tsconfig.json fix** (took 10 mins to debug):
```json
{
  "compilerOptions": {
    "lib": ["ES2022", "dom", "webworker"]
  }
}
```

The `dom` + `webworker` libs were critical — without them, `Request`, `Response`, `URLSearchParams`, `btoa` all threw type errors.

### Blueprint Classification
Simple but effective keyword-based classifier:

```typescript
const keywords = {
  "Health": ["lab", "results", "doctor", "health", "fitness", "wellness"],
  "Work": ["r-cubed", "client", "proposal", "deal", "closed", "revenue"],
  "Projects": ["build", "launch", "shipped", "project", "github"],
  "Personal": ["friends", "meeting", "weekend", "personal", "family"],
  "Growth": ["learn", "course", "skill", "certification", "improve"],
  "Data": ["metrics", "analytics", "revenue", "dashboard", "kpi"]
};

const matches = Object.entries(keywords)
  .map(([domain, words]) => ({
    domain,
    score: words.filter(w => text.toLowerCase().includes(w)).length
  }))
  .sort((a, b) => b.score - a.score)[0];
```

Not ML. Not fancy. **But accurate enough for MVP**, and runs in <10ms.

---

## Deployment Checklist

**Notion Worker:**
```bash
export NOTION_API_TOKEN=$(security find-generic-password -s "notion-cli" -a "f75638a8-fe44-4905-8cbd-488fc1f08e0e" -w)
ntn workers deploy --name cortana-worker
```

**Cloudflare Worker:**
```bash
cd cf-adapter
npx wrangler secret put NOTION_API_TOKEN
npx wrangler secret put TWILIO_ACCOUNT_SID
npx wrangler secret put TWILIO_AUTH_TOKEN
npx wrangler deploy
```

**Twilio Sandbox:**
- WhatsApp number: +14155238886
- Webhook: https://cortana-twilio-adapter.cortana-khanstruct.workers.dev/whatsapp

---

## Lessons for Next Time

1. **Keychain is your enemy in CI/CD** — Export env vars explicitly, especially on macOS
2. **Read the API docs, not your assumptions** — Notion Workers tools aren't HTTP-callable
3. **Twilio WhatsApp requires `whatsapp:` URIs** — Not documented in the first place I looked
4. **Keyword classification works better than you'd think** — For MVP-stage semantic routing
5. **Ship fast, iterate later** — Spent 4 hours debugging, 2 hours shipping. The shipping part was the fun part.

---

## What's Next?

- **Semantic search** — Replace keyword matching with embeddings (use Notion's API + vector DB)
- **Agent loop** — Feed classified results back to Notion Agent for follow-up questions
- **Mobile UI** — Build a companion mobile app for richer interactions
- **Auth** — Support multiple Notion workspaces, not just one shared instance
- **Logging** — Add observability to track classification accuracy over time

---

## The Code

**GitHub:** https://github.com/zainkhan1994/cortana-notion-mcp

**Quick start:**
```bash
git clone https://github.com/zainkhan1994/cortana-notion-mcp.git
cd cortana-worker-full

# Deploy Notion Worker
export NOTION_API_TOKEN=your_token_here
ntn workers deploy

# Deploy CF adapter
cd cf-adapter
npx wrangler secret put NOTION_API_TOKEN
npx wrangler secret put TWILIO_ACCOUNT_SID
npx wrangler secret put TWILIO_AUTH_TOKEN
npx wrangler deploy

# Configure Twilio sandbox webhook
# → https://cortana-twilio-adapter.cortana-khanstruct.workers.dev/whatsapp
```

---

## The Real Win

At 4:30 AM, I texted: "Lab results January"

My phone buzzed 2 seconds later: "🟨 Health — Found 2 results: Transparent Labs, Greentown Labs"

No tabs. No scrolling. No friction.

That's the whole idea.

---

**Published March 28, 2026 — Submitted to MLH Notion MCP Challenge**

*If you built something with Notion Workers or Cloudflare, hit me up. I'm curious how others are shipping.*
