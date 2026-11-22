/**
 * PaperBridge Layout Validator: a local MCP server over stdio.
 *
 *   npm run mcp        (or: npx tsx mcp/server.ts)
 *
 * Configured for Kiro in .kiro/settings/mcp.json. Read-only: it never writes files.
 * Only protocol messages go to stdout; logs go to stderr.
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { listRegisteredApps, validateCardLayout } from "./tools";

const APPS_DIR = join(dirname(fileURLToPath(import.meta.url)), "../src/apps");

const server = new McpServer({ name: "paperbridge-layout-validator", version: "0.1.0" });

server.registerTool(
  "validate_card_layout",
  {
    title: "Validate a PaperBridge CardLayout",
    description:
      "Check a PaperBridge CardLayout (the JSON object an app's layout.ts exports) against every geometric invariant the optical decoder needs: bubbles inside the page margins, clear of the 4 corner fiducials and the card-ID strip, no bubble-to-bubble overlap, and unique group/row/col IDs (and, with checkText, printed text placement). Returns pass/fail with one diagnostic per problem (code, message, bubble IDs, JSON path).",
    inputSchema: {
      layout: z
        .union([z.record(z.string(), z.unknown()), z.string()])
        .describe("The CardLayout object, or a JSON string of it. Units are millimetres."),
      checkText: z
        .boolean()
        .optional()
        .describe("Also check printed text: labels, notes and titles stay on the page and off bubbles, corner markers, the card-ID strip and each other. Default false."),
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  async ({ layout, checkText }) => {
    const report = validateCardLayout(layout, { checkText });
    return { content: [{ type: "text", text: report.summary }], structuredContent: { ...report }, isError: false };
  },
);

server.registerTool(
  "list_registered_apps",
  {
    title: "List PaperBridge apps",
    description:
      "List every app folder in src/apps/ with its switcher label, card ID and version, page sizes, bubble groups and count, whether its layout passes validation, how many sample photos it has, and any problems (missing files, card-ID code clashes).",
    inputSchema: {},
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  async () => {
    const apps = await listRegisteredApps(APPS_DIR);
    const text = apps
      .map((a) => `${a.slug}: ${a.label ?? "(not registered)"}, card ${a.cardId} v${a.version}, ${a.pages.join("+")}, ${a.bubbles} bubbles, layout ${a.layoutOk ? "OK" : `${a.layoutErrors} errors`}, ${a.samplePhotos} sample photos${a.problems.length ? `; problems: ${a.problems.join("; ")}` : ""}`)
      .join("\n");
    return { content: [{ type: "text", text: text || "No apps found." }], structuredContent: { apps } };
  },
);

await server.connect(new StdioServerTransport());
console.error("paperbridge-layout-validator running on stdio");
