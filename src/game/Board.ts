// Pure match-3 board logic. No rendering here, so it is easy to test.
// Row 0 is the top of the board; gravity pulls pieces toward higher rows.

export interface Piece {
  id: number;
  kind: number;
}

export interface Cell {
  /** Inactive cells are holes: no piece lives there and nothing can be tapped. */
  active: boolean;
  /** Locked cells hold a piece that cannot be swapped or fall. Matching it breaks the lock. */
  locked: boolean;
  piece: Piece | null;
}

export interface Pos {
  r: number;
  c: number;
}

export interface ClearedPiece extends Pos {
  piece: Piece;
  wasLocked: boolean;
}

export interface BoardOptions {
  size: number;
  kinds: number;
  inactive?: Array<[number, number]>;
  locked?: Array<[number, number]>;
  rng?: () => number;
}

export class Board {
  readonly size: number;
  readonly kinds: number;
  readonly cells: Cell[][];
  private nextId = 1;
  private rng: () => number;

  constructor(opts: BoardOptions) {
    this.size = opts.size;
    this.kinds = opts.kinds;
    this.rng = opts.rng ?? Math.random;
    this.cells = [];
    for (let r = 0; r < this.size; r++) {
      const row: Cell[] = [];
      for (let c = 0; c < this.size; c++) row.push({ active: true, locked: false, piece: null });
      this.cells.push(row);
    }
    for (const [r, c] of opts.inactive ?? []) {
      if (this.inBounds(r, c)) this.cells[r][c].active = false;
    }
    for (const [r, c] of opts.locked ?? []) {
      if (this.inBounds(r, c) && this.cells[r][c].active) this.cells[r][c].locked = true;
    }
    this.generate();
  }

  inBounds(r: number, c: number): boolean {
    return r >= 0 && c >= 0 && r < this.size && c < this.size;
  }

  cell(r: number, c: number): Cell | null {
    return this.inBounds(r, c) ? this.cells[r][c] : null;
  }

  /** A cell the player can touch: active, has a piece, not locked. */
  isPlayable(r: number, c: number): boolean {
    const cell = this.cell(r, c);
    return !!cell && cell.active && !cell.locked && !!cell.piece;
  }

  static adjacent(a: Pos, b: Pos): boolean {
    return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
  }

  private kindAt(r: number, c: number): number | null {
    const cell = this.cell(r, c);
    return cell && cell.active && cell.piece ? cell.piece.kind : null;
  }

  private newPiece(kind: number): Piece {
    return { id: this.nextId++, kind };
  }

  private randomKind(exclude: Set<number> = new Set()): number {
    const options: number[] = [];
    for (let k = 0; k < this.kinds; k++) if (!exclude.has(k)) options.push(k);
    const pool = options.length ? options : [...Array(this.kinds).keys()];
    return pool[Math.floor(this.rng() * pool.length)];
  }

  /** Fill the board with no starting matches and at least one valid move. */
  generate(): void {
    for (let attempt = 0; attempt < 100; attempt++) {
      for (let r = 0; r < this.size; r++) {
        for (let c = 0; c < this.size; c++) {
          const cell = this.cells[r][c];
          if (!cell.active) {
            cell.piece = null;
            continue;
          }
          const exclude = new Set<number>();
          const l1 = this.kindAt(r, c - 1);
          if (l1 !== null && l1 === this.kindAt(r, c - 2)) exclude.add(l1);
          const u1 = this.kindAt(r - 1, c);
          if (u1 !== null && u1 === this.kindAt(r - 2, c)) exclude.add(u1);
          cell.piece = this.newPiece(this.randomKind(exclude));
        }
      }
      if (this.findMatches().length === 0 && this.hasValidMove()) return;
    }
  }

  /** All cells that are part of a horizontal or vertical run of 3+. */
  findMatches(): Pos[] {
    const hit = new Set<string>();
    const scan = (get: (i: number, j: number) => number | null, mark: (i: number, j: number) => void) => {
      for (let i = 0; i < this.size; i++) {
        let runStart = 0;
        for (let j = 1; j <= this.size; j++) {
          const prev = get(i, j - 1);
          const cur = j < this.size ? get(i, j) : null;
          if (cur === null || cur !== prev) {
            if (prev !== null && j - runStart >= 3) for (let k = runStart; k < j; k++) mark(i, k);
            runStart = j;
          }
        }
      }
    };
    scan((r, c) => this.kindAt(r, c), (r, c) => hit.add(`${r},${c}`));
    scan((c, r) => this.kindAt(r, c), (c, r) => hit.add(`${r},${c}`));
    return [...hit].map((k) => {
      const [r, c] = k.split(",").map(Number);
      return { r, c };
    });
  }

  private rawSwap(a: Pos, b: Pos): void {
    const pa = this.cells[a.r][a.c].piece;
    this.cells[a.r][a.c].piece = this.cells[b.r][b.c].piece;
    this.cells[b.r][b.c].piece = pa;
  }

  /** True if both cells are playable, adjacent, and the swap creates a match. */
  canSwap(a: Pos, b: Pos): boolean {
    if (!Board.adjacent(a, b) || !this.isPlayable(a.r, a.c) || !this.isPlayable(b.r, b.c)) return false;
    this.rawSwap(a, b);
    const ok = this.findMatches().length > 0;
    this.rawSwap(a, b);
    return ok;
  }

  swap(a: Pos, b: Pos): boolean {
    if (!this.canSwap(a, b)) return false;
    this.rawSwap(a, b);
    return true;
  }

  /** Remove matched pieces. Locked cells that get matched lose their lock. */
  clear(positions: Pos[]): ClearedPiece[] {
    const out: ClearedPiece[] = [];
    for (const { r, c } of positions) {
      const cell = this.cells[r][c];
      if (!cell.piece) continue;
      out.push({ r, c, piece: cell.piece, wasLocked: cell.locked });
      cell.locked = false;
      cell.piece = null;
    }
    return out;
  }

  /** Drop pieces down. Holes are skipped; locked cells act as barriers. */
  collapse(): void {
    for (let c = 0; c < this.size; c++) {
      let r = this.size - 1;
      while (r >= 0) {
        const seg: number[] = [];
        while (r >= 0 && !this.cells[r][c].locked) {
          if (this.cells[r][c].active) seg.push(r);
          r--;
        }
        const pieces = seg.map((rr) => this.cells[rr][c].piece).filter((p): p is Piece => !!p);
        seg.forEach((rr, i) => (this.cells[rr][c].piece = pieces[i] ?? null));
        r--; // skip the locked barrier cell
      }
    }
  }

  /** Spawn new pieces in every empty active cell. */
  refill(): Array<Pos & { piece: Piece }> {
    const spawned: Array<Pos & { piece: Piece }> = [];
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        const cell = this.cells[r][c];
        if (cell.active && !cell.piece) {
          cell.piece = this.newPiece(this.randomKind());
          spawned.push({ r, c, piece: cell.piece });
        }
      }
    }
    return spawned;
  }

  hasValidMove(): boolean {
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.canSwap({ r, c }, { r, c: c + 1 }) || this.canSwap({ r, c }, { r: r + 1, c })) return true;
      }
    }
    return false;
  }

  /** Reshuffle movable pieces until there are no matches and a move exists. */
  shuffle(): void {
    const slots: Pos[] = [];
    for (let r = 0; r < this.size; r++)
      for (let c = 0; c < this.size; c++) if (this.isPlayable(r, c)) slots.push({ r, c });
    for (let attempt = 0; attempt < 200; attempt++) {
      const pieces = slots.map((p) => this.cells[p.r][p.c].piece!);
      for (let i = pieces.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng() * (i + 1));
        [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
      }
      slots.forEach((p, i) => (this.cells[p.r][p.c].piece = pieces[i]));
      if (this.findMatches().length === 0 && this.hasValidMove()) return;
    }
    // Fall back to fresh kinds if a shuffle cannot produce a playable board.
    for (const p of slots) this.cells[p.r][p.c].piece!.kind = this.randomKind();
    if (this.findMatches().length > 0 || !this.hasValidMove()) this.shuffle();
  }
}
