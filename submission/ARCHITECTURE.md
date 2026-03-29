# Architecture Diagram

```mermaid
graph TB
    WA["📱 WhatsApp User<br/>+1 832-382-1675"]
    
    TW["Twilio WhatsApp Sandbox<br/>+1 415-523-8886"]
    
    CF["⚡ Cloudflare Worker<br/>cortana-twilio-adapter<br/><br/>• Parse Twilio form data<br/>• Classify message<br/>• Search Notion<br/>• Format response"]
    
    NW["🧠 Notion Worker<br/>Zeta (Tools)<br/><br/>• classifyAndRespond<br/>• dispatchBlueprint<br/>• triageBacklog"]
    
    NA["Notion API v1<br/>/search endpoint<br/><br/>Bearer: NOTION_API_TOKEN"]
    
    NDB[(📚 Notion Workspace<br/>f75638a8...<br/><br/>• Databases<br/>• Pages<br/>• Properties)]
    
    WA -->|"Message: 'Lab results January'"| TW
    TW -->|"POST /whatsapp<br/>Body, From"| CF
    
    CF -->|"Classify text"| NW
    NW -->|"Domain: Health<br/>Confidence: 0.9"| CF
    
    CF -->|"POST /v1/search<br/>Query: 'lab results'<br/>Filter: Database<br/>Auth: Bearer"| NA
    NA -->|"Results: 2 pages"| CF
    
    NA ---|"Reads from"| NDB
    
    CF -->|"Format: 🟨 Health<br/>Found 2: Transparent Labs,<br/>Greentown Labs"| TW
    TW -->|"SMS via WhatsApp"| WA
    
    WA -->|"✅ 2sec latency"| WA
    
    style CF fill:#FF6B6B,stroke:#333,color:#fff
    style NW fill:#4ECDC4,stroke:#333,color:#fff
    style NA fill:#95E1D3,stroke:#333,color:#000
    style NDB fill:#F7DC6F,stroke:#333,color:#000
    style TW fill:#7F8C8D,stroke:#333,color:#fff
    style WA fill:#3498DB,stroke:#333,color:#fff
```

## Data Flow

```
1. User sends WhatsApp message
   └─→ Twilio receives & forwards to webhook

2. Cloudflare Worker processes
   ├─→ Extracts message content & phone number
   ├─→ Classifies across 6 Blueprint domains
   ├─→ Searches Notion workspace
   └─→ Formats response

3. Notion API search
   └─→ Queries workspace databases
       └─→ Returns matching pages + metadata

4. Twilio sends reply
   └─→ User receives in WhatsApp (2 sec round-trip)
```

## Blueprint Domains

| Domain | Emoji | Keywords | Example Match |
|--------|-------|----------|----------------|
| Personal | 🟥 | friends, weekend, family | "meeting my friends" |
| Health | 🟨 | lab, doctor, fitness, wellness | "lab results" |
| Projects | 🟪 | build, launch, shipped | "project shipped" |
| Work | 🟦 | r-cubed, client, proposal | "R-Cubed meeting" |
| Growth | ⬛ | learn, course, skill | "learning Python" |
| Data | 🗄️ | metrics, analytics, kpi | "revenue dashboard" |

## Tech Stack

```
Frontend
├─ Twilio WhatsApp SDK
├─ Notion Workspace

Workers (Compute)
├─ Cloudflare Workers (TypeScript)
│  └─ wrangler CLI (deployment)
│
└─ Notion Workers Alpha (TypeScript)
   └─ ntn CLI (deployment)

APIs
├─ Notion API v1 (/search)
├─ Twilio SMS API (/Messages.json)

Storage
└─ Notion (Databases)

Auth
├─ NOTION_API_TOKEN (Bearer)
├─ TWILIO_ACCOUNT_SID (Basic)
└─ TWILIO_AUTH_TOKEN (Basic)
```

## Deployment URLs

- **Cloudflare:** https://cortana-twilio-adapter.cortana-khanstruct.workers.dev/whatsapp
- **GitHub:** https://github.com/zainkhan1994/cortana-notion-mcp
- **MLH Challenge:** https://www.notionmcpchallenge.com

---

*Generated March 28, 2026 - Notion Workers MVP*
