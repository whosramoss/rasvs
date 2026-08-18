# RASVS API

[English](./api.md) · [Português](./api.pt.md)

O RASVS é um sistema de Retrieval-Augmented Generation (RAG) para o [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/). Ele ingere o PDF de referência no Milvus, responde perguntas com recuperação híbrida e um LLM, e pode avaliar a qualidade da recuperação com LLM-as-a-Judge.

O runtime é **Node.js + TypeScript**. A configuração fica em `rag/config.yaml`. Valores sensíveis ficam no `.env` na raiz do repositório.

## Metadados do experimento (configuração atual)

A tabela abaixo corresponde à estratégia de ingestão ativa e ao `rag/config.yaml`. Atualize `experiment_metadata` quando mudar modelos, chunking ou tamanhos de dataset.

| Item | Valor |
| --- | --- |
| Modelo de embedding | `local_models/bge-large-en-v1.5` |
| LLM (agente) | `gpt-4o-mini` |
| LLM (juiz / avaliação) | `gpt-4o-mini` |
| Re-ranking (Cross-Encoder) | `cross-encoder/ms-marco-MiniLM-L-6-v2` |
| Método de chunk | `recursive` |
| Tamanho do chunk | **1000** caracteres |
| Sobreposição do chunk | **200** caracteres |
| Linhas do conjunto de treino | **0** (CSV reservado; sem fine-tuning neste projeto) |
| Linhas do conjunto de validação | **0** (CSV reservado) |
| Linhas do conjunto de teste | **50** (perguntas em `rag/src/input/datasets/test_set.csv`) |

Os vetores de embedding são armazenados no **Milvus** (partição definida pela estratégia, por exemplo `strategy_7`). A pasta `rag/src/output/embeddings/` é reservada para manifests ou caches futuros. O retriever usa `all-MiniLM-L6-v2` se o caminho local do modelo de embedding não existir.

## Arquitetura

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

Os caminhos em `rag/config.yaml` são relativos a `rag/src/` e são resolvidos para caminhos absolutos no carregamento. Modelos locais do Hugging Face em `local_models/` continuam resolvendo a partir da raiz do repositório.

## Configuração do ambiente

### Milvus (Docker)

Na raiz do repositório:

```bash
wget https://milvus.io/docs/v2.4.x/assets/milvus/milvus-standalone-docker-compose.yml -O docker-compose.yml
docker-compose up -d
```

Por padrão o Milvus escuta em `http://localhost:19530`.

### Variáveis de ambiente (`.env`)

Crie um arquivo `.env` na raiz do repositório (não o versione). A aplicação lê esses valores em runtime.

```bash
OPENAI_API_KEY="sk-..."

MILVUS_AMB_URI="http://localhost:19530"
MILVUS_DB_NAME="default"
MILVUS_COLLECTION_NAME="owasp_asvs_v5"
```

Trate as chaves de API como segredos: exclua do VCS, rotacione com regularidade e use o menor privilégio necessário.

### Dependências Node.js

```bash
cd rag
npm install
```

## Executando a CLI

A partir de `rag/`:

```bash
npm run dev
```

Sem argumentos, o programa abre um prompt interativo. Os comandos também podem ser executados diretamente:

```bash
npm run extract
npm run ingest
npm run evaluate
npm run agent
```

Ajuda:

```bash
npx tsx src/index.ts --help
```

### PDFs de origem

Coloque os arquivos PDF em `rag/src/input/documents/`.

### Passo 1: extract → JSON

Gera o JSON intermediário usado na ingestão (filtro heurístico para páginas que parecem sumário):

```bash
npm run extract
```

Saída: `rag/src/output/parsed/parsed_data.json`.

### Passo 2: ingestão no Milvus

Exige o Milvus em execução e uma collection já existente com o schema esperado pelo pipeline. A aplicação carrega a collection pelo nome definido no ambiente e cria partições dentro dela. Lê o JSON do passo 1, faz chunking, gera embeddings e grava nas partições definidas em `rag/config.yaml`:

```bash
npm run ingest
```

O tempo de execução depende do tamanho do corpus, da dimensão dos embeddings e do hardware.

### Opcional: avaliar a recuperação

Usa perguntas de `rag/src/input/datasets/test_set.csv` (coluna `question`) e um LLM como juiz. Grava `rag/src/output/evaluations/evaluation_results.csv`:

```bash
npm run evaluate
```

### Agente interativo

Chat no terminal; saia com Ctrl+C ou `exit`:

```bash
npm run agent
```

Exemplo de prompt:

`Your question: What are the three verification levels defined by ASVS?`

## Configuração avançada (`rag/config.yaml`)

- **Caminhos:** `data_path`, `parsed_data_path`, `test_set_path`, `results_path` e chaves relacionadas apontam para `rag/src/input/...` e `rag/src/output/...`.
- **experiment_metadata:** Referência central de modelos, chunk/overlap e quantidade de linhas nos CSVs; mantenha alinhado à estratégia ativa e aos arquivos em `rag/src/input/datasets/`.
- **ingestion_strategies:** Várias estratégias; varíe `chunk_method` (`recursive` ou `semantic`), `chunk_size`, `chunk_overlap`, `embedding_model` e `partition_name` (isola os dados de cada estratégia no Milvus).
- **evaluator:** LLM juiz (`llm_judge`) e `retriever_k` para a avaliação.
- **agent:** `strategy_to_use` escolhe qual estratégia de ingestão alimenta o retriever; `agent_llm` e `retriever_k` configuram o modelo de chat e quantos documentos retornar.
- **retriever_models:** Fallback padrão de embedding e nome do modelo Cross-Encoder.

## Fluxo do RAG

### Extract

1. Ler todos os PDFs em `rag/src/input/documents/`.
2. Dividir o texto em páginas.
3. Ignorar páginas que parecem sumário.
4. Gravar `rag/src/output/parsed/parsed_data.json`.

### Ingest

1. Carregar o JSON extraído.
2. Para cada estratégia em `ingestion_strategies`:
   - fazer chunking recursivo ou semântico
   - gerar embeddings
   - criar ou substituir a partição no Milvus
   - inserir texto, metadados e vetores

### Consulta (agente)

1. Receber a pergunta do usuário.
2. Busca híbrida: BM25 (peso 0.25) + Milvus (peso 0.75).
3. Fundir rankings com Reciprocal Rank Fusion (RRF, k = 60).
4. Montar o contexto com os top-k documentos.
5. Chamar o LLM com o system prompt, o contexto e a pergunta.
6. Devolver uma resposta estruturada com evidências e fontes.

### Evaluate

1. Carregar `test_set.csv`.
2. Para cada pergunta, executar recuperação híbrida e LLM-as-Judge.
3. Agregar a acurácia por estratégia.
4. Gravar o CSV de resultados.

## Processamento de documentos

O splitting recursivo usa separadores hierárquicos (`\n\n`, `\n`, ` `) com `chunk_size` e `chunk_overlap` configuráveis. O chunking semântico agrupa sentenças relacionadas.

Os embeddings usam `@xenova/transformers`. Modelos locais Hugging Face / ONNX são suportados. Se o caminho local não existir, o fallback é `all-MiniLM-L6-v2`.

## Armazenamento dos embeddings

Linhas no Milvus:

| Campo | Tipo | Descrição |
| --- | --- | --- |
| embedding | Float vector | Vetor de embedding |
| chunk_text | String | Texto do chunk |
| source | String | Nome do arquivo PDF |
| page | Integer | Número da página |

## Recuperação de documentos

O retriever híbrido combina:

1. **MilvusRetriever** — similaridade vetorial
2. **BM25Retriever** — busca por palavra-chave

Pesos padrão: 0.25 BM25, 0.75 Milvus.

Score RRF:

```
score(d) = Σ (weight_i / (rank_i + k))
```

com k = 60.

## Integração com o LLM

- Modelo: `gpt-4o-mini` (configurável)
- Temperatura: 0
- Ferramenta: `search_in_documents`

O agente deve decompor a pergunta, sempre buscar antes de responder, citar evidências, listar fontes como `(File: [file_name], Page: [page_number])` e informar quando os documentos forem insuficientes.

### Formato da resposta do agente

```
- Direct answer: [resposta clara]
- Evidence: [trechos citados]
- Sources: (File: [arquivo], Page: [página])
```

### CSV de avaliação

```csv
strategy_id,chunk_size,embedding_model,accuracy
7,1000,local_models/bge-large-en-v1.5,85.00%
```

## CLI

| Comando | Descrição |
| --- | --- |
| `extract` | Extrai PDFs para JSON em `rag/src/output/parsed` |
| `ingest` | Faz chunking, embeddings e grava no Milvus |
| `evaluate` | LLM-as-Judge sobre `rag/src/input/datasets` |
| `agent` | Agente conversacional interativo |
| `help` | Mostra a tela de comandos |
| `exit` | Sai do prompt interativo |

Parâmetros de entrada do `config.yaml`:

| Parâmetro | Tipo | Descrição |
| --- | --- | --- |
| data_path | string | Diretório dos PDFs |
| parsed_data_path | string | Caminho do JSON extraído |
| test_set_path | string | Dataset de avaliação |
| ingestion_strategies | array | Estratégias de chunking e embedding |
| agent.retriever_k | number | Top-k documentos |
| agent.agent_llm | string | Modelo do agente |

## Erros

| Erro | Causa | Correção |
| --- | --- | --- |
| Collection not found | Collection do Milvus ausente | Crie a collection primeiro |
| File not found | `parsed_data.json` ausente | Execute `npm run extract` |
| Embedding model not found | Caminho do modelo local ausente | Baixe o modelo ou use o fallback |
| LLM judge unavailable | API key inválida | Verifique `OPENAI_API_KEY` |

## Dependências externas

| Pacote | Função |
| --- | --- |
| `@langchain/openai` | Modelos de chat da OpenAI |
| `@langchain/core` | Primitivas do LangChain |
| `@zilliz/milvus2-sdk-node` | Cliente Milvus |
| `@xenova/transformers` | Embeddings locais |
| `pdf-parse` | Extração de PDF |
| `papaparse` | Parsing de CSV |
| `js-yaml` | Configuração YAML |
| `commander` | Parsing da CLI |
| `zod` | Schemas das tools |

## Equivalência Python → TypeScript

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

## Notas da migração

- O BM25 foi implementado em TypeScript; não há equivalente direto no LangChain JS com a mesma interface.
- O re-ranking Cross-Encoder está configurado no YAML; o retriever híbrido atualmente funde Milvus + BM25.
- Embeddings locais usam `@xenova/transformers` (ONNX). Modelos locais que não estão em ONNX caem no fallback `all-MiniLM-L6-v2`.
- As páginas do PDF são separadas pelo caractere form-feed (`\f`).
- A CLI é interativa quando iniciada sem argumentos; `extract`, `ingest`, `evaluate` e `agent` continuam disponíveis como subcomandos.
