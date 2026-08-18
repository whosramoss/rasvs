export interface CliCommandDefinition {
  name: string;
  description: string;
}

export const PROGRAM_NAME = "rag-asvs";
export const PROGRAM_VERSION = "1.0.0";
export const PROGRAM_TITLE = "RAG ASVS";
export const PROGRAM_SUBTITLE = "Retrieval-Augmented Generation — OWASP ASVS";
export const PROGRAM_DESCRIPTION =
  "RAG ASVS — run extract, ingest, evaluate, or agent for the OWASP ASVS RAG system.";
export const INTERACTIVE_PROMPT = "rag-asvs> ";
export const SCREEN_WIDTH = 72;

export const COMMAND_DEFINITIONS: CliCommandDefinition[] = [
  {
    name: "extract",
    description: "Extract text from PDFs to JSON under rag/src/output/parsed",
  },
  {
    name: "ingest",
    description: "Read JSON, build chunks/embeddings, and write to Milvus",
  },
  {
    name: "evaluate",
    description:
      "Evaluate the retriever with LLM-as-Judge (datasets under rag/src/input/datasets)",
  },
  {
    name: "agent",
    description: "Start the conversational agent (interactive CLI)",
  },
];

export const EXIT_COMMANDS = ["exit", "quit", "q"] as const;
export const HELP_COMMANDS = ["help", "h", "?"] as const;

export const CLI_MESSAGES = {
  availableCommands: "  Available commands:",
  helpDescription: "Show this screen again",
  exitDescription: "Exit the program",
  typeACommand: "  Type a command:",
  exiting: "Exiting. Goodbye.",
  unknownCommand: (name: string) =>
    `Unknown command: "${name}". Type help to see available options.`,
  showHelpAfterError: "Run rag-asvs --help to see available commands.",
  noArgsHelp: "With no arguments, the program opens an interactive prompt.",
  commandsHeading: "Commands:",
} as const;
