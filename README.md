<h1>
  <p align="center">
    <img src="./web/assets/icon.svg" alt="RASVS logo" width="128">
     <br>RASVS
  </p>
</h1>

<p align="center">
  <strong>RASVS</strong> is a <strong>RAG</strong> stack for <strong>OWASP ASVS</strong>:
  ingest the reference PDF into <strong>Milvus</strong>, answer with <strong>hybrid retrieval</strong>,
  <strong>Cross-Encoder</strong> re-ranking, and <strong>LLM</strong> generation;
  optional <strong>LLM-as-a-Judge</strong> for retrieval quality.
  <br /> <br />
  <a href="./docs/api.md">Documentation (EN)</a>
    ·
  <a href="./docs/api.pt.md">Documentação (PT)</a>
    ·
    <a href="#prerequisites">Prerequisites</a>
    ·
    <a href="#core-features">Core features</a>
</p>

<p align="center">
  <a href="https://rasvs.whosramoss.com">Check the website</a>
</p>
<br/><br/>

## Prerequisites

- **Node.js 20+** and dependencies from `rag/package.json`
- **Docker** and **Docker Compose** (to run **Milvus**)
- **OpenAI API key** for the agent, evaluation judge, and any paid models referenced in `rag/config.yaml`

## Core features

- **Hybrid search:** Combines BM25 keyword search with semantic embedding similarity so both exact terms and context are captured.

- **Milvus vector store:** Fast semantic search with partitions to isolate different ingestion strategies.

- **Conversational agent (LangChain):** Uses search tools to reason over user questions and answer from retrieved sources.

- **Evaluation pipeline:** Optional LLM-as-a-Judge scoring of retrieval quality and accuracy export.

- **Configurable ingestion:** Chunking methods and embedding models are driven from `rag/config.yaml`.

## License

MIT License. [LICENSE](./LICENSE)

## Author

Gabriel Ramos de Paula ([@whosramoss](https://github.com/whosramoss))
