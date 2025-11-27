import type { SurveyQuestion } from './data/questions';

type TeamId = 'teamA' | 'teamB';

// Expanded game phases for full Family Feud gameplay
type Phase =
  | 'lobby'           // Waiting for players
  | 'face-off'        // Buzzer competition to win control
  | 'play-or-pass'    // Winner chooses to play or pass
  | 'round-play'      // Team answering questions with turn rotation
  | 'team-steal'      // Opposing team attempts to steal
  | 'round-end'       // Round complete, show results
  | 'fast-money-p1'   // Fast Money: Player 1
  | 'fast-money-p2'   // Fast Money: Player 2
  | 'game-over';      // Victory screen

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
  avatar?: string; // Avatar identifier/color
}

export interface RevealedAnswer {
  text: string;
  points: number;
  revealedBy?: TeamId;
}

export interface BuzzEvent {
  playerId: string;
  playerName: string;
  team: TeamId;
  timestamp: number;
}

export interface FastMoneyAnswer {
  questionIndex: number;
  answer: string;
  points: number;
}

export interface GameState {
  code: string;
  hostId: string;
  teams: Record<TeamId, TeamState>;
  players: PlayerState[];
  phase: Phase;

  // Round management
  currentRound: number; // 0-4 for 5 rounds
  pointMultiplier: number; // 1x, 2x, or 3x based on round
  questionIndex: number | null;
  currentQuestion?: SurveyQuestion;
  roundEndsAt: number | null;
  roundDuration?: number;
  revealedAnswers: RevealedAnswer[];
  message?: string;

  // Face-Off mechanics
  faceOffBuzzers: BuzzEvent[]; // List of buzz-ins
  faceOffWinner: PlayerState | null; // Who won the Face-Off

  // Turn-based play
  controllingTeam: TeamId | null; // Team currently playing
  currentTurnTeam: TeamId | null; // Team whose turn it is
  currentPlayerIndex: number; // Index in team's player list

  // Steal opportunity
  stealingTeam: TeamId | null; // Team attempting to steal
  stealAnswer: string | null; // Their steal attempt

  // Fast Money
  fastMoneyPlayers: [string, string] | null; // [player1Id, player2Id]
  fastMoneyP1Answers: FastMoneyAnswer[];
  fastMoneyP2Answers: FastMoneyAnswer[];
  fastMoneyTimeRemaining: number;

  // Fast Money
  fastMoney?: {
    setIndex: number;
    questions: SurveyQuestion[];
    p1Answers: Array<{ text: string; points: number }>;
    p2Answers: Array<{ text: string; points: number }>;
    currentQuestionIndex: number;
    p1Score: number;
    p2Score: number;
  };

  // Win condition
  winningTeam: TeamId | null;
}

export type ClientRole = 'host' | 'player' | null;
export type TeamChoice = TeamId;

