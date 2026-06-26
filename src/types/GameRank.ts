export interface GameDefinition {
  id: string;
  name: string;
  ranks: string[];
}

export interface UserRanks {
  [gameId: string]: string;
}
