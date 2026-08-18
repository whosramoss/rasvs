import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { formatRetrievedDocumentsForLlm, logger } from "../../utils/index.js";
import type { Retriever } from "../../utils/index.js";
import {
  SEARCH_TOOL_NAME,
  SEARCH_TOOL_DESCRIPTION,
  AGENT_MESSAGES,
} from "./agent_prompts.js";

export function createSearchTool(retriever: Retriever | null): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: SEARCH_TOOL_NAME,
    description: SEARCH_TOOL_DESCRIPTION,
    schema: z.object({
      search_query: z.string().describe("The search query"),
    }),
    func: async ({ search_query }) => {
      logger.info("--- Agent tool invoked with query: '%s' ---", search_query);

      if (retriever === null) {
        return AGENT_MESSAGES.searchUnavailable;
      }

      const docs = await retriever.invoke(search_query);
      if (docs.length === 0) {
        return AGENT_MESSAGES.noResults;
      }

      return formatRetrievedDocumentsForLlm(docs);
    },
  });
}
