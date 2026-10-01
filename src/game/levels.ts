import { FACTIONS } from "../config";

export interface LevelDef {
  id: number;
  faction: string;
  moves: number;
  targetScore: number;
  kinds: number;
  inactive: Array<[number, number]>;
  locked: Array<[number, number]>;
  tip: string;
}

// Levels are plain data so Phase 3 can move them to JSON files or the backend.
export const LEVELS: LevelDef[] = [
  {
    id: 1,
    faction: FACTIONS[0],
    moves: 20,
    targetScore: 600,
    kinds: 5,
    inactive: [],
    locked: [],
    tip: "Line up 3 matching pieces to clear them. Chains score more.",
  },
  {
    id: 2,
    faction: FACTIONS[0],
    moves: 20,
    targetScore: 900,
    kinds: 5,
    inactive: [[0, 0], [0, 7], [7, 0], [7, 7]],
    locked: [],
    tip: "Dark corners are off the board. Nothing falls into them.",
  },
  {
    id: 3,
    faction: FACTIONS[0],
    moves: 18,
    targetScore: 1100,
    kinds: 5,
    inactive: [],
    locked: [[3, 3], [3, 4], [4, 3], [4, 4]],
    tip: "Caged pieces can't be moved. Match them to break the cage.",
  },
  {
    id: 4,
    faction: FACTIONS[1],
    moves: 22,
    targetScore: 1500,
    kinds: 6,
    inactive: [[3, 0], [4, 0], [3, 7], [4, 7]],
    locked: [[2, 2], [2, 5], [5, 2], [5, 5]],
    tip: "More piece types means fewer easy matches. Look for setups.",
  },
  {
    id: 5,
    faction: FACTIONS[1],
    moves: 20,
    targetScore: 1700,
    kinds: 6,
    inactive: [[0, 3], [0, 4], [7, 3], [7, 4]],
    locked: [[3, 1], [4, 1], [3, 6], [4, 6]],
    tip: "Work from the bottom to set off chain reactions.",
  },
  {
    id: 6,
    faction: FACTIONS[2],
    moves: 20,
    targetScore: 2000,
    kinds: 6,
    inactive: [[0, 0], [0, 1], [0, 6], [0, 7], [7, 0], [7, 1], [7, 6], [7, 7]],
    locked: [[3, 3], [3, 4], [4, 3], [4, 4], [1, 3], [6, 4]],
    tip: "Break the center cages early to open up the board.",
  },
];

export function levelAt(index: number): LevelDef {
  // After the last authored level, loop with harder targets.
  const base = LEVELS[index % LEVELS.length];
  const loop = Math.floor(index / LEVELS.length);
  return { ...base, id: index + 1, targetScore: Math.round(base.targetScore * (1 + loop * 0.25)) };
}
