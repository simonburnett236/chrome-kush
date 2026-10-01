const KEY = "ck.progress.v1";

interface ProgressState {
  levelIndex: number;
  totalPoints: number;
  bestScores: Record<number, number>;
}

export class Progress {
  state: ProgressState;

  constructor() {
    this.state = { levelIndex: 0, totalPoints: 0, bestScores: {} };
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.state = { ...this.state, ...JSON.parse(raw) };
    } catch {
      /* ignore */
    }
  }

  recordWin(levelIndex: number, score: number): void {
    const prev = this.state.bestScores[levelIndex] ?? 0;
    if (score > prev) this.state.bestScores[levelIndex] = score;
    this.state.totalPoints += score;
    this.state.levelIndex = Math.max(this.state.levelIndex, levelIndex + 1);
    this.save();
  }

  private save(): void {
    localStorage.setItem(KEY, JSON.stringify(this.state));
  }
}
