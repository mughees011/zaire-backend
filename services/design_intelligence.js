/**
 * ZAIRE Design Intelligence Service (Phase 2.5)
 * 
 * Replaces the legacy Python `design_intelligence_api.py` with a deterministic,
 * Node.js-native pipeline for resolving design tokens, content strategy, and motion specs
 * before code generation. Includes live reference-site fetching.
 */

const https = require('https');
const http = require('http');

const BASE_SYSTEM = `You are ZAIRE's elite Design Intelligence AI.
Your job is to translate high-level project intents into a concrete, deterministic design brief.
This brief will be strictly followed by the scaffolding engine. DO NOT output code. Output only the requested JSON structure.`;

/**
 * Fetches HTML from a given URL and extracts basic text to keep it lightweight.
 */
async function fetchReferenceHtml(url) {
  return new Promise((resolve) => {
    try {
      const client = url.startsWith('https') ? https : http;
      client.get(url, { timeout: 5000 }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          // Follow one redirect
          return resolve(fetchReferenceHtml(res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, url).href));
        }
        
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          // Strip style, script, svg tags, and HTML tags to just get some text context
          const stripped = data.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                               .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                               .replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, '')
                               .replace(/<[^>]+>/g, ' ')
                               .replace(/\s+/g, ' ')
                               .trim()
                               .substring(0, 3000); // Only keep the first 3000 chars of text
          resolve(stripped);
        });
      }).on('error', (err) => resolve(`[Failed to fetch: ${err.message}]`));
    } catch (e) {
      resolve(`[Invalid URL]`);
    }
  });
}

/**
 * Extracts URLs from intake referenceSites and fetches them.
 */
async function enrichIntakeWithReferences(intake) {
  const sitesStr = intake.referenceSites || '';
  // Basic regex to find URLs
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const urls = sitesStr.match(urlRegex) || [];
  
  if (urls.length === 0) return '';

  const topUrls = urls.slice(0, 2); // Limit to 2 to save time/tokens
  const results = await Promise.all(topUrls.map(async url => {
    const text = await fetchReferenceHtml(url);
    return `--- Reference URL: ${url} ---\n${text}\n`;
  }));

  return results.join('\n');
}

/**
 * Builds the prompt pair for the Design Intelligence LLM step.
 * 
 * @param {Object} plan - The approved architecture plan
 * @param {Object} intake - The raw project intake data
 * @param {String} referenceContext - Text scraped from reference sites
 * @returns {{system: string, user: string}}
 */
function buildDesignBriefPrompt(plan, intake, referenceContext = '') {
  const system = BASE_SYSTEM + `

You must produce a JSON object exactly matching this schema:
{
  "competitive_analysis": {
    "category": "string (e.g. saas-dashboard, portfolio)",
    "table_stakes": ["string"],
    "differentiation_opportunities": ["string"],
    "avoid": ["string"]
  },
  "visual_tokens": {
    "primary_color": "string (hex or tailwind class)",
    "neutral_scale": "string (e.g. zinc, slate, custom hexes)",
    "typography": {
      "display": "string",
      "body": "string"
    },
    "border_radius": "string (e.g. 4px, 12px)",
    "spacing_system": "string (e.g. 8px base)"
  },
  "content_plan": [
    {
      "page": "string",
      "job": "string (what visitor should do)",
      "reader_state": "string (cold vs warm)",
      "core_message": "string",
      "section_copy_briefs": [
        { "headline_intent": "string", "supporting_point": "string", "cta_intent": "string" }
      ]
    }
  ],
  "motion_spec": {
    "level": "string (minimal, expressive, moderate)",
    "allowed_effects": ["string"],
    "forbidden_effects": ["string"]
  },
  "conversion_checklist": ["string"]
}

Rules:
1. "visual_tokens": Must be concrete decisions (e.g., specific colors, fonts like Inter/Playfair), not adjectives.
2. "content_plan": Headlines must describe an outcome for the user, not just describe the product. No generic "Click Here" CTAs.
3. "motion_spec": Follow category logic. B2B = minimal, Agency = expressive, Consumer = moderate. Every effect must have a purpose.
4. Output strictly valid JSON. No markdown wrappers.`;

  const user = `PROJECT INTAKE:
Name: ${intake.projectName || plan.appName || 'Untitled'}
Type: ${intake.projectType || 'saas'}
Target User: ${intake.who || 'professionals'}
Design Style: ${intake.designStyle || 'Modern dark premium'}
Reference Sites: ${intake.referenceSites || 'None provided'}
Core Value: ${intake.what || plan.summary || 'Unknown'}

ARCHITECTURE PLAN:
${JSON.stringify({ pages: plan.pages, components: plan.components }, null, 2)}

${referenceContext ? `LIVE COMPETITIVE CONTEXT (Scraped from Reference Sites):\n${referenceContext}` : ''}

Analyze this project and the competitive context, then output the concrete design brief JSON.`;

  return { system, user };
}

module.exports = {
  buildDesignBriefPrompt,
  enrichIntakeWithReferences
};
