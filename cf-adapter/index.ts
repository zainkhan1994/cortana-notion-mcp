// Blueprint domain classification
function classifyQuery(text: string): string {
	const keywords: Record<string, string[]> = {
		Personal: ["meeting", "friends", "weekend", "personal", "family", "social"],
		Health: ["lab", "results", "doctor", "health", "fitness", "wellness", "medical"],
		Projects: ["build", "launch", "shipped", "project", "github", "code"],
		Work: ["r-cubed", "client", "proposal", "deal", "closed", "revenue", "business"],
		Growth: ["learn", "course", "skill", "certification", "improve", "development"],
		Data: ["metrics", "analytics", "revenue", "dashboard", "kpi", "report", "stats"],
	};

	const lowerText = text.toLowerCase();
	const scores: Record<string, number> = {};

	for (const [domain, words] of Object.entries(keywords)) {
		scores[domain] = words.filter((w) => lowerText.includes(w)).length;
	}

	const topDomain = Object.entries(scores).sort(([, a], [, b]) => b - a)[0];
	return topDomain ? topDomain[0] : "Personal";
}

// Search Notion by domain
async function searchNotionByDomain(
	domain: string,
	query: string,
	token: string
): Promise<{ title: string; id: string; url: string }[]> {
	try {
		const response = await fetch("https://api.notion.com/v1/search", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
				"Notion-Version": "2022-06-28",
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				query: query,
				filter: {
					value: "database",
					property: "object",
				},
				page_size: 5,
			}),
		});

		if (!response.ok) {
			console.error(`Notion API error: ${response.status}`);
			return [];
		}

		const data = (await response.json()) as {
			results: Array<{ id: string; properties?: Record<string, unknown>; title?: string }>;
		};

		return (
			data.results?.slice(0, 5).map((item) => ({
				title: (item as any).title || `Page ${item.id.slice(0, 8)}`,
				id: item.id,
				url: `https://notion.so/${item.id.replace(/-/g, "")}`,
			})) || []
		);
	} catch (error) {
		console.error("Search error:", error);
		return [];
	}
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		if (request.method !== "POST") {
			return new Response("Method not allowed", { status: 405 });
		}

		const url = new URL(request.url);
		if (url.pathname !== "/whatsapp") {
			return new Response("Not found", { status: 404 });
		}

		try {
			// Parse Twilio webhook form data
			const formData = await request.formData();
			const message = formData.get("Body") as string;
			const fromPhone = formData.get("From") as string;

			if (!message || !fromPhone) {
				return twilioEmptyResponse();
			}

			// Classify the message
			const domain = classifyQuery(message);

			// Search Notion
			const results = await searchNotionByDomain(
				domain,
				message,
				env.NOTION_API_TOKEN
			);

			// Format response
			const domainEmoji: Record<string, string> = {
				Personal: "🟥",
				Health: "🟨",
				Projects: "🟪",
				Work: "🟦",
				Growth: "⬛",
				Data: "🗄️",
			};

			const emoji = domainEmoji[domain] || "❓";
			const resultTitles = results.slice(0, 3).map((r) => r.title).join(", ");
			const reply =
				results.length > 0
					? `${emoji} ${domain} — Found ${results.length} results: ${resultTitles}`
					: `${emoji} ${domain} — No results found for "${message}"`;

			// Send Twilio reply
			await sendTwilioReply(
				fromPhone,
				reply,
				env.TWILIO_ACCOUNT_SID,
				env.TWILIO_AUTH_TOKEN,
				env.TWILIO_WHATSAPP_FROM
			);

			return twilioEmptyResponse();
		} catch (error) {
			console.error("Error processing webhook:", error);
			return twilioEmptyResponse();
		}
	},
};

// Helper: Send Twilio reply
async function sendTwilioReply(
	toPhone: string,
	message: string,
	accountSid: string,
	authToken: string,
	fromPhone: string
): Promise<void> {
	const cleanPhone = toPhone.startsWith("whatsapp:")
		? toPhone.slice(8)
		: toPhone;
	const baseUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

	const body = new URLSearchParams({
		To: `whatsapp:${cleanPhone}`,
		From: `whatsapp:${fromPhone}`,
		Body: message,
	});

	const response = await fetch(baseUrl, {
		method: "POST",
		headers: {
			Authorization: `Basic ${btoa(accountSid + ":" + authToken)}`,
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: body.toString(),
	});

	if (!response.ok) {
		console.error(`Twilio API error: ${response.status}`, await response.text());
	}
}

// Helper: Return empty TwiML response
function twilioEmptyResponse(): Response {
	return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
		headers: { "Content-Type": "application/xml" },
	});
}

interface Env {
	NOTION_API_TOKEN: string;
	TWILIO_ACCOUNT_SID: string;
	TWILIO_AUTH_TOKEN: string;
	TWILIO_WHATSAPP_FROM: string;
}
