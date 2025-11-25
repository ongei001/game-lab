import type { SurveyQuestion } from './data/questions';

type TeamId = 'teamA' | 'teamB';

type Phase = 'lobby' | 'round' | 'between';

export interface TeamState {
  id: TeamId;
  name: string;
  score: number;
  strikes: number;
}

export interface PlayerState {
  id: string;
  name: string;
  team: TeamId;
}

export interface RevealedAnswer {
  text: string;
  points: number;
  revealedBy?: TeamId;
}

export interface GameState {
  code: string;
  hostId: string;
  teams: Record<TeamId, TeamState>;
  players: PlayerState[];
  phase: Phase;
  questionIndex: number | null;
  currentQuestion?: SurveyQuestion;
  roundEndsAt: number | null;
  roundDuration?: number;
  revealedAnswers: RevealedAnswer[];
  message?: string;
}

export type ClientRole = 'host' | 'player' | null;
export type TeamChoice = TeamId;
