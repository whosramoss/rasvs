import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { AgentExecutor, createOpenAIToolsAgent } from "langchain/agents";
import { logger, HybridRetrieverBuilder } from "../../utils/index.js";
import type { ProjectConfiguration, IngestionStrategy, Retriever } from "../../utils/index.js";
import { AGENT_SYSTEM_PROMPT } from "./agent_prompts.js";
import { createSearchTool } from "./search_tool.js";

export class ConversationalRAGOrchestrator {
  private config: ProjectConfiguration;
  private chosenStrategy: IngestionStrategy;
  private retriever: Retriever | null = null;

  constructor(config: ProjectConfiguration) {
    this.config = config;
    this.chosenStrategy = this.resolveStrategy(config.agent.strategy_to_use);
  }

  private resolveStrategy(strategyId: number): IngestionStrategy {
    const chosen = this.config.ingestion_strategies.find((s) => s.id === strategyId);
    if (!chosen) {
      throw new Error(`Strategy id '${strategyId}' not found in config.yaml`);
    }
    logger.info("Agent will use strategy id %s", chosen.id);
    return chosen;
  }

  async bootstrapRetriever(): Promise<void> {
    const builder = new HybridRetrieverBuilder();
    try {
      this.retriever = await builder.build(
        this.chosenStrategy.partition_name,
        this.chosenStrategy.embedding_model,
        this.config.agent.retriever_k,
        this.config.retriever_models
      );
    } catch (retrErr) {
      logger.error("Failed to create retriever for the agent: %s", retrErr);
      this.retriever = null;
    }
  }

  async buildAgentExecutor(): Promise<AgentExecutor> {
    await this.bootstrapRetriever();
    const tools = [createSearchTool(this.retriever)];

    const prompt = ChatPromptTemplate.fromMessages([
      ["system", AGENT_SYSTEM_PROMPT],
      ["human", "{input}"],
      new MessagesPlaceholder("agent_scratchpad"),
    ]);

    const llm = new ChatOpenAI({
      modelName: this.config.agent.agent_llm,
      temperature: 0,
    });

    const agent = await createOpenAIToolsAgent({
      llm,
      tools,
      prompt,
    });

    return new AgentExecutor({
      agent,
      tools,
      verbose: process.env.RAG_AGENT_VERBOSE === "true",
    });
  }
}
