import { config as dotenvConfig } from "dotenv";
import { setupLogging, ProjectLayout } from "../../utils/index.js";
import { ConversationalRAGOrchestrator } from "./conversational_rag_orchestrator.js";
import { RAGInteractiveCLI } from "./rag_interactive_cli.js";

dotenvConfig();

export {
  AGENT_SYSTEM_PROMPT,
  SEARCH_TOOL_NAME,
  SEARCH_TOOL_DESCRIPTION,
  AGENT_MESSAGES,
} from "./agent_prompts.js";
export { createSearchTool } from "./search_tool.js";
export { ConversationalRAGOrchestrator } from "./conversational_rag_orchestrator.js";
export { RAGInteractiveCLI } from "./rag_interactive_cli.js";

export async function runAgentCli(): Promise<void> {
  setupLogging();
  const configuration = ProjectLayout.loadConfiguration();
  const orchestrator = new ConversationalRAGOrchestrator(configuration);
  const agentExecutor = await orchestrator.buildAgentExecutor();
  const cli = new RAGInteractiveCLI(agentExecutor);
  await cli.runForever();
}
