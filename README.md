<h1>
  <p align="center">
    <img src="./web/src/assets/icon.svg" alt="RASVS logo" width="128">
     <br>RASVS
  </p>
</h1>

<p align="center">
  <strong>RASVS</strong> is a <strong>RAG</strong> stack for <strong>OWASP ASVS</strong>:
  ingest the reference PDF into <strong>Milvus</strong>, answer with <strong>hybrid retrieval</strong>,
  <strong>Cross-Encoder</strong> re-ranking, and <strong>LLM</strong> generation;
  optional <strong>LLM-as-a-Judge</strong> for retrieval quality.
  <br /> <br />
   <a href="#experiment-metadata-current-configuration">Experiment metadata</a>
    ·
    <a href="#core-features">Core features</a>
    ·
    <a href="#environment-setup">Environment setup</a>
    ·
    <a href="#running-the-cli">Running the CLI</a>
    ·
    <a href="#advanced-configuration-ragconfigyaml">Advanced configuration</a>
</p>

<p align="center">
  <a href="https://rasvs.whosramoss.com">Check the website</a>
</p>
<br/><br/>

## Experiment metadata (current configuration)

The table below matches the active ingestion strategy and `rag/config.yaml`. Update `experiment_metadata` when you change models, chunking, or dataset sizes.

| Item                       | Value                                                   |
| -------------------------- | ------------------------------------------------------- |
| Embedding model            | `local_models/bge-large-en-v1.5`                        |
| LLM (agent)                | `gpt-4o-mini`                                           |
| LLM (judge / evaluation)   | `gpt-4o-mini`                                           |
| Re-ranking (Cross-Encoder) | `cross-encoder/ms-marco-MiniLM-L-6-v2`                  |
| Chunk method               | `recursive`                                             |
| Chunk size                 | **1000** characters                                     |
| Chunk overlap              | **200** characters                                      |
| Training set rows          | **0** (CSV reserved; no fine-tuning in this project)    |
| Validation set rows        | **0** (CSV reserved)                                    |
| Test set rows              | **50** (questions in `rag/input/datasets/test_set.csv`) |

> **Note:** Embedding vectors are stored in **Milvus** (partition defined by the strategy, e.g. `strategy_7`). The folder `rag/output/embeddings/` is reserved for manifests or future caches. The retriever falls back to `all-MiniLM-L6-v2` if the local embedding path does not exist.

---

## Core features

- **Hybrid search:** Combines BM25 keyword search with semantic embedding similarity so both exact terms and context are captured.

- **Re-ranking:** A Cross-Encoder reorders hybrid results before they are passed to the LLM.

- **Milvus vector store:** Fast semantic search with partitions to isolate different ingestion strategies.

- **Conversational agent (LangChain):** Uses search tools to reason over user questions and answer from retrieved sources.

- **Evaluation pipeline:** Optional LLM-as-a-Judge scoring of retrieval quality and accuracy export.

- **Configurable ingestion:** Chunking methods and embedding models are driven from `rag/config.yaml`.

---

## Repository layout

Data flows under **`rag/`**: **input** (PDFs and CSVs) and **output** (generated artifacts). Python code lives in **`rag/app/`** (imported as `app` after `rag/main.py` adds the `rag/` folder to `sys.path`).

```
RASVS/                            # repository root (example name)
├── README.md
├── LICENSE
├── .env                             # not committed
├── .gitignore
├── web/                             # static site
├── rag/
│   ├── main.py                      # CLI entry point
│   ├── config.yaml
│   ├── requirements.in
│   ├── requirements.txt
│   ├── input/
│   │   ├── documents/               # source PDFs
│   │   └── datasets/
│   │       ├── train_set.csv
│   │       ├── validation_set.csv
│   │       └── test_set.csv         # columns: question, expected_answer
│   ├── output/
│   │   ├── parsed/
│   │   │   └── parsed_data.json
│   │   ├── evaluations/
│   │   │   └── evaluation_results.csv
│   │   └── embeddings/              # reserved; vectors live in Milvus
│   └── app/                         # Python package `app`
│       ├── __init__.py
│       ├── project_paths.py
│       ├── logging_configuration.py
│       ├── pdf_document_extractor.py
│       ├── milvus_vector_ingestion.py
│       ├── hybrid_retriever_builder.py
│       ├── retrieval_evaluation_pipeline.py
│       └── conversational_rag_agent.py
└── local_models/                    # optional local Hugging Face models (repo root)
```

---

## Prerequisites

- **Python 3.11+** and dependencies from `rag/requirements.txt`
- **Docker** and **Docker Compose** (to run **Milvus**)
- **OpenAI API key** for the agent, evaluation judge, and any paid models referenced in `rag/config.yaml`

---

## Environment setup

### Milvus (Docker)

From the **repository root**:

```bash
wget https://milvus.io/docs/v2.4.x/assets/milvus/milvus-standalone-docker-compose.yml -O docker-compose.yml
docker-compose up -d
```

By default Milvus listens at **`http://localhost:19530`**.

### Environment variables (`.env`)

Create a **`.env`** file at the root (do **not** commit it). The app reads these at runtime.

```bash
OPENAI_API_KEY="sk-..."

MILVUS_AMB_URI="http://localhost:19530"
MILVUS_DB_NAME="default"
MILVUS_COLLECTION_NAME="owasp_asvs_v5"
```

Treat API keys as secrets: exclude from VCS, rotate regularly, least privilege.

### Python virtual environment

```bash
python -m venv venv

# Windows (PowerShell)
.\venv\Scripts\activate

# Linux / macOS
source venv/bin/activate

pip install -r rag/requirements.txt
```

---

## Running the CLI

From the **repository root**, use **`python rag/main.py`** (or activate the venv, **`cd rag`**, then **`python main.py`**). `main.py` prepends the `rag/` directory to `sys.path` and dispatches into `rag/app/`. Paths in `rag/config.yaml` are **relative to `rag/`** and are normalized to absolute paths when loaded (`local_models/` etc. still resolve from the monorepo root).

```powershell
Set-Location -Path "C:\full\path\to\rag-test"
```

```bash
cd /full/path/to/rag-test
```

Help:

```bash
python rag/main.py -h
```

### Source PDFs

Place **PDF** files under **`rag/input/documents/`**.

### Step 1: extract → JSON

Produces the intermediate JSON used by ingestion (heuristic filter for likely table-of-contents pages):

```bash
python rag/main.py extract
```

### Step 2: ingest into Milvus

Requires **Milvus running** and a **collection that already exists** with the schema your pipeline expects (the app loads the collection by name from the environment; it creates **partitions** inside that collection). Reads the JSON from step 1, chunks, embeds, and writes to partitions defined in `rag/config.yaml`:

```bash
python rag/main.py ingest
```

Runtime depends on corpus size, embedding dimension, and hardware (CPU/GPU).

### (Optional) Evaluate retrieval

Uses questions from **`rag/input/datasets/test_set.csv`** (column **`question`**) and an LLM judge. Writes **`rag/output/evaluations/evaluation_results.csv`**:

```bash
python rag/main.py evaluate
```

### Interactive agent

Terminal chat; exit with **Ctrl+C**:

```bash
python rag/main.py agent
```

Example prompt:

`Your question: What are the three verification levels defined by ASVS?`

---

## Advanced configuration (`rag/config.yaml`)

- **Paths:** `data_path`, `parsed_data_path`, `test_set_path`, `results_path`, etc. point under `rag/input/...` and `rag/output/...` (relative to the repo root).

- **experiment_metadata:** Central reference for models, chunk/overlap, and CSV row counts; keep it aligned with the active strategy and files under `rag/input/datasets/`.

- **ingestion_strategies:** Multiple strategies; vary `chunk_method` (`recursive` or `semantic`), `chunk_size`, `chunk_overlap`, `embedding_model`, and `partition_name` (isolates data per strategy in Milvus).

- **evaluator:** LLM judge (`llm_judge`) and `retriever_k` for evaluation.

- **agent:** `strategy_to_use` selects which ingestion strategy drives the retriever; `agent_llm` and `retriever_k` configure the chat model and how many documents to re-rank.

- **retriever_models:** Default embedding fallback and Cross-Encoder model used by `rag/app/hybrid_retriever_builder.py`.

---

## License

MIT License. [LICENSE](./LICENSE)

## Author

Gabriel Ramos de Paula ([@whosramoss](https://github.com/whosramoss))
