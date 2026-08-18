export class TableOfContentsHeuristic {
  private readonly threshold: number;

  constructor(threshold = 0.3) {
    this.threshold = threshold;
  }

  isTableOfContentsPage(pageContent: string): boolean {
    let linesWithDots = 0;
    let totalLines = 0;

    const lines = pageContent.split("\n");
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      totalLines++;
      if (line.includes(". ")) {
        const parts = line.split(". ");
        const lastPart = parts[parts.length - 1].trim();
        if (/^\d+$/.test(lastPart)) {
          linesWithDots++;
        }
      }
    }

    if (totalLines > 0 && linesWithDots / totalLines > this.threshold) {
      return true;
    }
    return false;
  }
}
