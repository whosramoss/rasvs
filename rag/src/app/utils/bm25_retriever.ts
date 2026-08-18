import type { RetrievedDocument } from "./types.js";

interface TokenizedDocument {
  document: RetrievedDocument;
  tokens: string[];
}

export class BM25Retriever {
  private documents: TokenizedDocument[];
  private avgDocLength: number;
  private k1: number;
  private b: number;
  private idf: Map<string, number>;
  private k: number;

  constructor(options: { k?: number; k1?: number; b?: number } = {}) {
    this.documents = [];
    this.avgDocLength = 0;
    this.k1 = options.k1 ?? 1.5;
    this.b = options.b ?? 0.75;
    this.k = options.k ?? 15;
    this.idf = new Map();
  }

  static fromDocuments(
    documents: RetrievedDocument[],
    options: { k?: number } = {}
  ): BM25Retriever {
    const retriever = new BM25Retriever(options);
    retriever.addDocuments(documents);
    return retriever;
  }

  addDocuments(documents: RetrievedDocument[]): void {
    this.documents = documents.map((doc) => ({
      document: doc,
      tokens: this.tokenize(doc.pageContent),
    }));
    this.computeIdf();
    this.avgDocLength = this.computeAvgDocLength();
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 1);
  }

  private computeAvgDocLength(): number {
    if (this.documents.length === 0) return 0;
    const totalLength = this.documents.reduce(
      (sum, doc) => sum + doc.tokens.length,
      0
    );
    return totalLength / this.documents.length;
  }

  private computeIdf(): void {
    this.idf.clear();
    const docCount = this.documents.length;
    const termDocFreq = new Map<string, number>();

    for (const doc of this.documents) {
      const seenTerms = new Set<string>();
      for (const token of doc.tokens) {
        if (!seenTerms.has(token)) {
          seenTerms.add(token);
          termDocFreq.set(token, (termDocFreq.get(token) ?? 0) + 1);
        }
      }
    }

    for (const [term, df] of termDocFreq) {
      const idfValue = Math.log((docCount - df + 0.5) / (df + 0.5) + 1);
      this.idf.set(term, idfValue);
    }
  }

  private computeScore(queryTokens: string[], docTokens: string[]): number {
    const docLength = docTokens.length;
    const termFreq = new Map<string, number>();

    for (const token of docTokens) {
      termFreq.set(token, (termFreq.get(token) ?? 0) + 1);
    }

    let score = 0;
    for (const queryToken of queryTokens) {
      const idf = this.idf.get(queryToken) ?? 0;
      const tf = termFreq.get(queryToken) ?? 0;

      const numerator = tf * (this.k1 + 1);
      const denominator =
        tf + this.k1 * (1 - this.b + this.b * (docLength / this.avgDocLength));

      score += idf * (numerator / denominator);
    }

    return score;
  }

  invoke(query: string): RetrievedDocument[] {
    const queryTokens = this.tokenize(query);

    const scoredDocs = this.documents.map((doc) => ({
      document: doc.document,
      score: this.computeScore(queryTokens, doc.tokens),
    }));

    scoredDocs.sort((a, b) => b.score - a.score);

    return scoredDocs.slice(0, this.k).map((item) => item.document);
  }

  setK(k: number): void {
    this.k = k;
  }
}
