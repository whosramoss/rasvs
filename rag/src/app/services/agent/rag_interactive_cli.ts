import * as readline from "node:readline";
import { AgentExecutor } from "langchain/agents";
import { logger } from "../../utils/index.js";
import { AGENT_MESSAGES } from "./agent_prompts.js";

export class RAGInteractiveCLI {
  private executor: AgentExecutor;
  private rl: readline.Interface;

  constructor(executor: AgentExecutor) {
    this.executor = executor;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  async runForever(): Promise<void> {
    logger.info(AGENT_MESSAGES.agentStarted);

    const askQuestion = (): void => {
      this.rl.question(AGENT_MESSAGES.questionPrompt, async (question) => {
        if (!question.trim()) {
          askQuestion();
          return;
        }

        try {
          const response = await this.executor.invoke({ input: question });
          logger.info(AGENT_MESSAGES.agentReply);
          logger.info(response.output);
        } catch (err) {
          logger.error("Error during agent execution: %s", err);
        }

        askQuestion();
      });
    };

    this.rl.on("close", () => {
      logger.info(AGENT_MESSAGES.agentExiting);
      process.exit(0);
    });

    askQuestion();
  }
}
