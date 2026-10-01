import { Board, type Pos } from "./Board";
import type { LevelDef } from "./levels";
import type { BoardView } from "../render/BoardView";
import { BOARD_SIZE, SCORE_PER_PIECE } from "../config";

export type SessionState = "playing" | "busy" | "won" | "lost";

export interface SessionCallbacks {
  onChange: (s: GameSession) => void;
  onWin: (s: GameSession) => void;
  onLose: (s: GameSession) => void;
}

/** One attempt at one level: board, score, moves and the match/cascade loop. */
export class GameSession {
  readonly board: Board;
  score = 0;
  movesLeft: number;
  state: SessionState = "playing";

  constructor(
    readonly level: LevelDef,
    private view: BoardView,
    private cb: SessionCallbacks,
    bonusMoves = 0,
  ) {
    this.board = new Board({
      size: BOARD_SIZE,
      kinds: level.kinds,
      inactive: level.inactive,
      locked: level.locked,
    });
    this.movesLeft = level.moves + bonusMoves;
    view.build(this.board);
    view.canInteract = (p) => this.state === "playing" && this.board.isPlayable(p.r, p.c);
    view.onSwapRequest = (a, b) => void this.trySwap(a, b);
    cb.onChange(this);
  }

  get progress(): number {
    return Math.min(1, this.score / this.level.targetScore);
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
    this.cb.onChange(this);
    await this.view.sync(this.board, 160);
    await this.resolve();
    this.finishTurn();
  }

  private async resolve(): Promise<void> {
    let cascade = 0;
    for (;;) {
      const matches = this.board.findMatches();
      if (matches.length === 0) break;
      cascade++;
      const cleared = this.board.clear(matches);
      this.score += cleared.length * SCORE_PER_PIECE * cascade;
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

  private finishTurn(): void {
    if (this.score >= this.level.targetScore) {
      this.state = "won";
      this.cb.onChange(this);
      this.cb.onWin(this);
    } else if (this.movesLeft <= 0) {
      this.state = "lost";
      this.cb.onChange(this);
      this.cb.onLose(this);
    } else {
      this.state = "playing";
      this.cb.onChange(this);
    }
  }
}
