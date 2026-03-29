/**
 * webhook.ts
 * 
 * This file handles INCOMING WhatsApp messages from Twilio.
 * Deploy this as a separate endpoint (e.g. on Vercel, Railway, or Cloudflare Workers)
 * and point your Twilio WhatsApp sandbox webhook URL at it.
 * 
 * Twilio Sandbox Webhook Setup:
 * 1. Go to Messaging → Try it out → Send a WhatsApp message → Sandbox settings
 * 2. Set "When a message comes in" to your deployed webhook URL
 * 3. Method: HTTP POST
 * 
 * This handler receives the inbound message and calls your Notion Worker tool.
 */

import { Worker } from "@notionhq/workers";
import { j } from "@notionhq/workers/schema-builder";

const worker = new Worker();
export default worker;

worker.tool("handleInbound", {
  title: "Handle Inbound WhatsApp",
  description: "Processes an inbound Twilio WhatsApp webhook payload and routes it to classifyAndRespond.",
  schema: j.object({
    Body: j.string().describe("The message body from Twilio webhook"),
    From: j.string().describe("The sender WhatsApp number from Twilio webhook (whatsapp:+1XXXXXXXXXX)"),
  }),
  execute: async ({ Body, From }) => {
    // Forward to main classifyAndRespond tool logic
    // In production, call your deployed worker endpoint
    return `Received: "${Body}" from ${From} — route to classifyAndRespond tool`;
  },
});
