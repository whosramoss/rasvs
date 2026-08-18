export interface DocumentChunk {
  pageContent: string;
  metadata: {
    source: string;
    page: number;
  };
}

export interface MilvusEntity {
  [key: string]: unknown;
  embedding: number[];
  chunk_text: string;
  source: string;
  page: number;
}

export interface RetrievedDocument {
  pageContent: string;
  metadata: {
    source: string;
    page: number;
  };
}

export interface JudgementResult {
  isRelevant: boolean;
  rawResponse: string;
}

export interface EvaluationResult {
  strategy_id: number;
  chunk_size: number | string;
  embedding_model: string;
  accuracy: string;
}

export interface Retriever {
  invoke(query: string): Promise<RetrievedDocument[]>;
}
