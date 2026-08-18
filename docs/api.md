# RASVS API

[English](./api.md) · [Português](./api.pt.md)

RASVS is a Retrieval-Augmented Generation (RAG) stack for [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/). It ingests the reference PDF into Milvus, answers questions with hybrid retrieval and an LLM, and can score retrieval quality with LLM-as-a-Judge.

The runtime is **Node.js + TypeScript**. Configuration lives in `rag/config.yaml`. Sensitive values live in `.env` at the repository root.

## Experiment metadata (current configuration)

The table below matches the active ingestion strategy and `rag/config.yaml`. Update `experiment_metadata` when you change models, chunking, or dataset sizes.

| Item | Value |
| --- | --- |
| Embedding model | `local_models/bge-large-en-v1.5` |
| LLM (agent) | `gpt-4o-mini` |
| LLM (judge / evaluation) | `gpt-4o-mini` |
| Re-ranking (Cross-Encoder) | `cross-encoder/ms-marco-MiniLM-L-6-v2` |
| Chunk method | `recursive` |
| Chunk size | **1000** characters |
| Chunk overlap | **200** characters |
| Training set rows | **0** (CSV reserved; no fine-tuning in this project) |
| Validation set rows | **0** (CSV reserved) |
| Test set rows | **50** (questions in `rag/src/input/datasets/test_set.csv`) |

Embedding vectors are stored in **Milvus** (partition defined by the strategy, e.g. `strategy_7`). The folder `rag/src/output/embeddings/` is reserved for manifests or future caches. The retriever falls back to `all-MiniLM-L6-v2` if the local embedding path does not exist.

## Architecture

```
RASVS/
├── README.md
├── LICENSE
├── .env
├── docs/
│   ├── api.md
│   └── api.pt.md
├── web/
├── rag/
│   ├── src/
│   │   ├── index.ts
│   │   ├── input/
│   │   │   ├── documents/
│   │   │   └── datasets/
│   │   │       ├── train_set.csv
│   │   │       ├── validation_set.csv
│   │   │       └── test_set.csv
│   │   ├── output/
│   │   │   ├── parsed/
│   │   │   ├── evaluations/
│   │   │   └── embeddings/
│   │   └── app/
│   │       ├── commands/
│   │       ├── services/
│   │       │   ├── extract/
│   │       │   ├── ingest/
│   │       │   ├── evaluate/
│   │       │   └── agent/
│   │       └── utils/
│   ├── config.yaml
│   ├── package.json
│   └── tsconfig.json
└── local_models/
```

Paths in `rag/config.yaml` are relative to `rag/src/` and are resolved to absolute paths when loaded. Local Hugging Face models under `local_models/` still resolve from the repository root.

## Environment setup

### Milvus (Docker)

From the repository root:

```bash
wget https://milvus.io/docs/v2.4.x/assets/milvus/milvus-standalone-docker-compose.yml -O docker-compose.yml
docker-compose up -d
```

By default Milvus listens at `http://localhost:19530`.

### Environment variables (`.env`)

Create a `.env` file at the repository root (do not commit it). The app reads these at runtime.

```bash
OPENAI_API_KEY="sk-..."

MILVUS_AMB_URI="http://localhost:19530"
MILVUS_DB_NAME="default"
MILVUS_COLLECTION_NAME="owasp_asvs_v5"
```

Treat API keys as secrets: exclude from VCS, rotate regularly, least privilege.

### Node.js dependencies

```bash
cd rag
npm install
```

## Running the CLI

From `rag/`:

```bash
npm run dev
```

With no arguments the program opens an interactive prompt. Commands can also be run directly:

```bash
npm run extract
npm run ingest
npm run evaluate
npm run agent
```

Help:

```bash
npx tsx src/index.ts --help
```

### Source PDFs

Place PDF files under `rag/src/input/documents/`.

### Step 1: extract → JSON

Produces the intermediate JSON used by ingestion (heuristic filter for likely table-of-contents pages):

```bash
npm run extract
```

Output: `rag/src/output/parsed/parsed_data.json`.

### Step 2: ingest into Milvus

Requires Milvus running and a collection that already exists with the schema the pipeline expects. The app loads the collection by name from the environment and creates partitions inside that collection. It reads the JSON from step 1, chunks, embeds, and writes to partitions defined in `rag/config.yaml`:

```bash
npm run ingest
```

Runtime depends on corpus size, embedding dimension, and hardware.

### Optional: evaluate retrieval

Uses questions from `rag/src/input/datasets/test_set.csv` (column `question`) and an LLM judge. Writes `rag/src/output/evaluations/evaluation_results.csv`:

```bash
npm run evaluate
```

### Interactive agent

Terminal chat; exit with Ctrl+C or `exit`:

```bash
npm run agent
```

Example prompt:

`Your question: What are the three verification levels defined by ASVS?`

## Advanced configuration (`rag/config.yaml`)

- **Paths:** `data_path`, `parsed_data_path`, `test_set_path`, `results_path`, and related keys point under `rag/src/input/...` and `rag/src/output/...`.
- **experiment_metadata:** Central reference for models, chunk/overlap, and CSV row counts; keep it aligned with the active strategy and files under `rag/src/input/datasets/`.
- **ingestion_strategies:** Multiple strategies; vary `chunk_method` (`recursive` or `semantic`), `chunk_size`, `chunk_overlap`, `embedding_model`, and `partition_name` (isolates data per strategy in Milvus).
- **evaluator:** LLM judge (`llm_judge`) and `retriever_k` for evaluation.
- **agent:** `strategy_to_use` selects which ingestion strategy drives the retriever; `agent_llm` and `retriever_k` configure the chat model and how many documents to return.
- **retriever_models:** Default embedding fallback and Cross-Encoder model name.

## RAG flow

### Extract

1. Read every PDF under `rag/src/input/documents/`.
2. Split text into pages.
3. Skip pages that look like a table of contents.
4. Write `rag/src/output/parsed/parsed_data.json`.

### Ingest

1. Load the parsed JSON.
2. For each strategy in `ingestion_strategies`:
   - chunk with recursive or semantic splitting
   - generate embeddings
   - create or replace the Milvus partition
   - insert chunk text, metadata, and vectors

### Query (agent)

1. Receive the user question.
2. Hybrid search: BM25 (weight 0.25) + Milvus (weight 0.75).
3. Fuse ranks with Reciprocal Rank Fusion (RRF, k = 60).
4. Build context from the top-k documents.
5. Call the LLM with the system prompt, context, and question.
6. Return a structured answer with evidence and sources.

### Evaluate

1. Load `test_set.csv`.
2. For each question, run hybrid retrieval and LLM-as-Judge.
3. Aggregate accuracy per strategy.
4. Write the results CSV.

## Document processing

Recursive character splitting uses hierarchical separators (`\n\n`, `\n`, ` `) with configurable `chunk_size` and `chunk_overlap`. Semantic chunking groups related sentences.

Embeddings use `@xenova/transformers`. Local Hugging Face / ONNX models are supported. If a local path is missing, the fallback is `all-MiniLM-L6-v2`.

## Embedding storage

Milvus rows:

| Field | Type | Description |
| --- | --- | --- |
| embedding | Float vector | Embedding vector |
| chunk_text | String | Chunk text |
| source | String | PDF file name |
| page | Integer | Page number |

## Document retrieval

The hybrid retriever combines:

1. **MilvusRetriever** — vector similarity
2. **BM25Retriever** — keyword search

Default weights: 0.25 BM25, 0.75 Milvus.

RRF score:

```
score(d) = Σ (weight_i / (rank_i + k))
```

with k = 60.

## LLM integration

- Model: `gpt-4o-mini` (configurable)
- Temperature: 0
- Tool: `search_in_documents`

The agent must decompose the question, always search before answering, quote evidence, list sources as `(File: [file_name], Page: [page_number])`, and say when the documents are insufficient.

### Agent response shape

```
- Direct answer: [clear answer]
- Evidence: [quoted passages]
- Sources: (File: [file], Page: [page])
```

### Evaluation CSV

```csv
strategy_id,chunk_size,embedding_model,accuracy
7,1000,local_models/bge-large-en-v1.5,85.00%
```

## CLI

| Command | Description |
| --- | --- |
| `extract` | Extract PDFs to JSON under `rag/src/output/parsed` |
| `ingest` | Chunk, embed, and write to Milvus |
| `evaluate` | LLM-as-Judge over `rag/src/input/datasets` |
| `agent` | Interactive conversational agent |
| `help` | Show the command screen |
| `exit` | Leave the interactive prompt |

`config.yaml` input parameters:

| Parameter | Type | Description |
| --- | --- | --- |
| data_path | string | PDF directory |
| parsed_data_path | string | Extracted JSON path |
| test_set_path | string | Evaluation dataset |
| ingestion_strategies | array | Chunking and embedding strategies |
| agent.retriever_k | number | Top-k documents |
| agent.agent_llm | string | Agent model |

## Errors

| Error | Cause | Fix |
| --- | --- | --- |
| Collection not found | Milvus collection missing | Create the collection first |
| File not found | `parsed_data.json` missing | Run `npm run extract` |
| Embedding model not found | Local model path missing | Download the model or use the fallback |
| LLM judge unavailable | Invalid API key | Check `OPENAI_API_KEY` |

## External dependencies

| Package | Role |
| --- | --- |
| `@langchain/openai` | OpenAI chat models |
| `@langchain/core` | LangChain primitives |
| `@zilliz/milvus2-sdk-node` | Milvus client |
| `@xenova/transformers` | Local embeddings |
| `pdf-parse` | PDF extraction |
| `papaparse` | CSV parsing |
| `js-yaml` | YAML config |
| `commander` | CLI parsing |
| `zod` | Tool schemas |

## Python → TypeScript mapping

| Python | TypeScript |
| --- | --- |
| `rag/main.py` | `rag/src/index.ts` |
| `app/pdf_document_extractor.py` | `app/services/extract/` |
| `app/milvus_vector_ingestion.py` | `app/services/ingest/` |
| `app/retrieval_evaluation_pipeline.py` | `app/services/evaluate/` |
| `app/conversational_rag_agent.py` | `app/services/agent/` |
| `app/project_paths.py` | `app/utils/project_paths.ts` |
| `app/logging_configuration.py` | `app/utils/logging_configuration.ts` |
| `app/hybrid_retriever_builder.py` | `app/utils/hybrid_retriever_builder.ts` |
| `langchain` / `langchain_openai` | `langchain`, `@langchain/openai` |
| `langchain_huggingface` | `@xenova/transformers` |
| `pymilvus` / `langchain_milvus` | `@zilliz/milvus2-sdk-node` |
| `pandas` | `papaparse` |
| `PyMuPDFLoader` | `pdf-parse` |
| `argparse` | `commander` + `RasvsCommand` |

## Migration notes

- BM25 is implemented in TypeScript; there is no LangChain JS equivalent with the same interface.
- Cross-Encoder re-ranking is configured in YAML; the hybrid retriever currently fuses Milvus + BM25.
- Local embeddings use `@xenova/transformers` (ONNX). Non-ONNX local models fall back to `all-MiniLM-L6-v2`.
- PDF pages are split on the form-feed character (`\f`).
- The CLI is interactive when started with no arguments; `extract`, `ingest`, `evaluate`, and `agent` remain available as subcommands.
