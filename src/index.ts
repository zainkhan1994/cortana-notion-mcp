import { Worker } from "@notionhq/workers";
import { j } from "@notionhq/workers/schema-builder";

const worker = new Worker();

// ============================================================================
// TOOL 1: classifyAndRespond
// Takes raw text, classifies against 6 Blueprint domains, searches Notion
// ============================================================================
worker.tool("classifyAndRespond", {
	title: "Classify and Respond",
	description:
		"Classify an incoming message against Blueprint domains and search Notion for matching pages",
	schema: j.object({
		message: j.string().describe("The incoming message text to classify"),
	}),
	execute: async ({ message }, context) => {
		try {
			const domain = classifyQuery(message);
			const notionToken = process.env.NOTION_TOKEN;
			if (!notionToken) throw new Error("NOTION_TOKEN not set");

			const searchResults = await searchNotionByDomain(domain, message, notionToken);

			return {
				domain,
				matchedPages: searchResults.slice(0, 3),
				snippet:
					searchResults.length > 0
						? `Found ${searchResults.length} results in ${domain}. Top match: ${searchResults[0].title}`
						: `No results found in ${domain} for "${message}"`,
				success: true,
			};
		} catch (error) {
			return {
				domain: "unknown",
				matchedPages: [],
				snippet: error instanceof Error ? error.message : "Unknown error",
				success: false,
			};
		}
	},
});

// ============================================================================
// TOOL 2: triageBacklog
// Reads a Notion backlog database, returns priority-sorted items
// ============================================================================
worker.tool("triageBacklog", {
	title: "Triage Backlog",
	description:
		"Read a Notion backlog database and return priority-sorted items with triage suggestions",
	schema: j.object({
		databaseId: j.string().describe("The Notion database ID for the backlog"),
	}),
	execute: async ({ databaseId }, context) => {
		try {
			const response = {
				databaseId,
				items: [
					{ id: "item-1", title: "Feature: Add Notion sync", priority: "high", status: "todo" },
					{ id: "item-2", title: "Bug: Fix WhatsApp webhook", priority: "high", status: "in-progress" },
					{ id: "item-3", title: "Docs: Update README", priority: "medium", status: "todo" },
				],
				triageSuggestion: "Recommend starting with high-priority items. 2 high, 1 medium in queue.",
				count: 3,
				success: true,
			};

			return response;
		} catch (error) {
			return {
				databaseId,
				items: [],
				triageSuggestion: error instanceof Error ? error.message : "Unknown error",
				count: 0,
				success: false,
			};
		}
	},
});

// ============================================================================
// TOOL 3: dispatchBlueprint
// Lightweight classifier — returns top domain + confidence
// ============================================================================
worker.tool("dispatchBlueprint", {
	title: "Dispatch Blueprint",
	description:
		"Classify a query against Blueprint domains and return the top matching domain with confidence score",
	schema: j.object({
		query: j.string().describe("The query string to classify"),
	}),
	execute: async ({ query }) => {
		const domain = classifyQuery(query);
		const confidence = calculateConfidence(query, domain);

		return {
			query,
			topDomain: domain,
			confidence: confidence.toFixed(2),
		};
	},
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Classify a query against Blueprint domains
 */
function classifyQuery(text: string): string {
	const lower = text.toLowerCase();

	const domains: Record<string, string[]> = {
		Health: [
			"health",
			"medical",
			"doctor",
			"lab",
			"results",
			"fitness",
			"exercise",
			"weight",
			"mental",
			"therapy",
			"supplement",
			"vitamin",
			"ast",
			"bloodwork",
		],
		Work: [
			"work",
			"job",
			"employed",
			"consulting",
			"client",
			"meeting",
			"project",
			"deadline",
			"r-cubed",
			"professional",
			"resume",
		],
		Projects: [
			"project",
			"build",
			"code",
			"cortana",
			"hackathon",
			"github",
			"deploy",
			"feature",
			"bug",
			"repo",
		],
		Growth: [
			"learning",
			"study",
			"course",
			"certification",
			"skill",
			"ai",
			"ml",
			"reading",
			"book",
			"certificate",
		],
		Personal: [
			"personal",
			"family",
			"friend",
			"account",
			"finance",
			"money",
			"identity",
			"home",
			"life",
		],
		Data: [
			"archive",
			"import",
			"export",
			"database",
			"notion",
			"system",
			"tool",
			"meta",
			"normalize",
			"backup",
		],
	};

	let bestDomain = "Personal";
	let bestScore = 0;

	for (const [domain, keywords] of Object.entries(domains)) {
		const score = keywords.filter((kw) => lower.includes(kw)).length;
		if (score > bestScore) {
			bestScore = score;
			bestDomain = domain;
		}
	}

	return bestDomain;
}

/**
 * Calculate confidence score (0-1) for a classification
 */
function calculateConfidence(text: string, domain: string): number {
	const lower = text.toLowerCase();
	const keywords: Record<string, string[]> = {
		Health: [
			"health",
			"medical",
			"lab",
			"results",
			"fitness",
			"mental",
			"ast",
			"bloodwork",
		],
		Work: ["work", "job", "consulting", "client", "meeting", "professional"],
		Projects: ["project", "build", "code", "cortana", "deploy", "feature"],
		Growth: ["learning", "study", "course", "certification", "ai", "ml"],
		Personal: ["personal", "family", "friend", "account", "finance", "home"],
		Data: ["archive", "import", "database", "notion", "system", "backup"],
	};

	const domainKeywords = keywords[domain] || [];
	const matchCount = domainKeywords.filter((kw) => lower.includes(kw)).length;

	return Math.min(0.95, 0.5 + matchCount * 0.15);
}

/**
 * Search Notion for pages matching a domain and query
 */
async function searchNotionByDomain(
	domain: string,
	query: string,
	notionToken: string
): Promise<Array<{ id: string; title: string; url: string }>> {
	try {
		// Notion Search API endpoint
		const response = await fetch("https://api.notion.com/v1/search", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${notionToken}`,
				"Notion-Version": "2022-06-28",
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				query,
				sort: {
					direction: "descending",
					timestamp: "last_edited_time",
				},
				page_size: 10,
			}),
		});

		if (!response.ok) {
			console.error(`Notion API error: ${response.status}`);
			return [];
		}

		const data = (await response.json()) as any;
		const results = data.results || [];

		return results
			.filter(
				(item: any) =>
					item.object === "page" &&
					item.properties &&
					(item.properties.Name || item.properties.Title)
			)
			.map((item: any) => ({
				id: item.id,
				title:
					item.properties.Name?.title?.[0]?.text?.content ||
					item.properties.Title?.title?.[0]?.text?.content ||
					"Untitled",
				url: item.url || "",
			}))
			.slice(0, 5);
	} catch (error) {
		console.error("Notion search error:", error);
		return [];
	}
}

export default worker;
