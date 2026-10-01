import { Board, type ClearedPiece, type Pos } from "./Board";
import type { LevelDef } from "./levels";
import type { BoardView } from "../render/BoardView";
import { BOARD_SIZE, SCORE_PER_PIECE } from "../config";

export type SessionState = "playing" | "busy" | "won" | "lost";

export interface SessionCallbacks {
  onChange: (s: GameSession) => void;
  onWin: (s: GameSession) => void;
  /** Out of moves. Resolve true if the player earned more moves (ad), false to lose. */
  onOutOfMoves: (s: GameSession) => Promise<boolean>;
  onLose: (s: GameSession) => void;
}

export interface SessionOptions {
  bonusMoves?: number;
  /** Daily-streak score multiplier. */
  multiplier?: number;
  /** Pre-game Starter Blast booster. */
  blast?: boolean;
}

/** One attempt at one level: board, score, moves and the match/cascade loop. */
export class GameSession {
  readonly board: Board;
  score = 0;
  movesLeft: number;
  movesUsed = 0;
  state: SessionState = "playing";
  readonly multiplier: number;

  constructor(
    readonly level: LevelDef,
    private view: BoardView,
    private cb: SessionCallbacks,
    opts: SessionOptions = {},
  ) {
    this.board = new Board({ size: BOARD_SIZE, kinds: level.kinds, inactive: level.inactive, locked: level.locked });
    this.movesLeft = level.moves + (opts.bonusMoves ?? 0);
    this.multiplier = opts.multiplier ?? 1;
    view.tapOverride = null;
    view.build(this.board);
    view.canInteract = (p) => this.state === "playing" && this.board.isPlayable(p.r, p.c);
    view.onSwapRequest = (a, b) => void this.trySwap(a, b);
    cb.onChange(this);
    if (opts.blast) void this.runBooster(() => this.board.blastCross());
  }

  get progress(): number {
    return Math.min(1, this.score / this.level.targetScore);
  }

  private addScore(cleared: ClearedPiece[], cascade: number): void {
    this.score += Math.round(cleared.length * SCORE_PER_PIECE * cascade * this.multiplier);
  }

  async trySwap(a: Pos, b: Pos): Promise<void> {
    if (this.state !== "playing") return;
    if (!this.board.isPlayable(a.r, a.c) || !this.board.isPlayable(b.r, b.c)) return;
    this.state = "busy";
    if (!this.board.swap(a, b)) {
      await this.view.animateInvalid(this.board, a, b);
      this.state = "playing";
      return;
    }
    this.movesLeft--;
    this.movesUsed++;
    this.cb.onChange(this);
    await this.view.sync(this.board, 160);
    await this.resolve();
    await this.finishTurn();
  }

  /** Run a booster effect that clears pieces without using a move. */
  async runBooster(effect: () => ClearedPiece[]): Promise<boolean> {
    if (this.state !== "playing") return false;
    this.state = "busy";
    const cleared = effect();
    if (cleared.length === 0) {
      this.state = "playing";
      return false;
    }
    this.addScore(cleared, 1);
    this.cb.onChange(this);
    await this.view.animateClear(cleared);
    this.board.collapse();
    this.board.refill();
    await this.view.sync(this.board, 220);
    await this.resolve();
    await this.finishTurn();
    return true;
  }

  useLighter(p: Pos): Promise<boolean> {
    return this.runBooster(() => this.board.destroyAt(p));
  }

  async useShuffle(): Promise<boolean> {
    if (this.state !== "playing") return false;
    this.state = "busy";
    this.board.shuffle();
    await this.view.sync(this.board, 320);
    this.state = "playing";
    return true;
  }

  private async resolve(): Promise<void> {
    let cascade = 0;
    for (;;) {
      const matches = this.board.findMatches();
      if (matches.length === 0) break;
      cascade++;
      const cleared = this.board.clear(matches);
      this.addScore(cleared, cascade);
      this.cb.onChange(this);
      await this.view.animateClear(cleared);
      this.board.collapse();
      this.board.refill();
      await this.view.sync(this.board, 220);
    }
    if (!this.board.hasValidMove()) {
      this.board.shuffle();
      await this.view.sync(this.board, 300);
    }
  }

  private async finishTurn(): Promise<void> {
    if (this.score >= this.level.targetScore) {
      this.state = "won";
      this.cb.onChange(this);
      this.cb.onWin(this);
      return;
    }
    if (this.movesLeft <= 0) {
      this.state = "busy";
      const extended = await this.cb.onOutOfMoves(this);
      if (extended && this.movesLeft > 0) {
        this.state = "playing";
        this.cb.onChange(this);
        return;
      }
      this.state = "lost";
      this.cb.onChange(this);
      this.cb.onLose(this);
      return;
    }
    this.state = "playing";
    this.cb.onChange(this);
  }

  addMoves(n: number): void {
    this.movesLeft += n;
    this.cb.onChange(this);
  }
}
