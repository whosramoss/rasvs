export class LangChainTracingGuard {
  static disableLangSmithTracing(): void {
    try {
      delete process.env.LANGCHAIN_TRACING_V2;
      delete process.env.LANGCHAIN_API_KEY;
      console.log("--- LangSmith tracing disabled from code. ---");
    } catch {
      // Ignore
    }
  }
}
