import { createServer } from 'http';
import { randomUUID } from 'crypto';
import { WebSocketServer } from 'ws';
import { SURVEY_QUESTIONS, FAST_MONEY_SETS } from './questions.js';

const PORT = process.env.PORT || 8787;
const games = new Map(); // code -> game
const sockets = new Map(); // ws -> { gameCode, clientId }

const baseState = () => ({
  teams: {
    teamA: { id: 'teamA', name: 'Team A', score: 0, strikes: 0 },
    teamB: { id: 'teamB', name: 'Team B', score: 0, strikes: 0 },
  },
  players: [],
  phase: 'lobby',

  // Round management
  currentRound: 0, // 0-4 for up to 5 rounds
  pointMultiplier: 1, // 1x, 2x, or 3x
  questionIndex: null,
  roundEndsAt: null,
  roundDuration: 45,
  revealedAnswers: [],
  message: '',

  // Face-Off mechanics
  faceOffBuzzers: [],
  faceOffWinner: null,
  faceOffAnswers: [], // Track both players' answers and rankings
  faceOffPhase: null, // 'awaiting-first' | 'awaiting-second' | 'comparing'

  // Turn-based play
  controllingTeam: null, // Team that won Face-Off/is playing
  currentTurnTeam: null, // Team whose turn it is currently
  currentPlayerIndex: 0, // Index within the team's players
  currentTurnPlayerIndex: 0, // Which player number (0-4) is answering

  // Steal opportunity
  stealingTeam: null,
  stealAnswer: null,

  // Fast Money
  fastMoneyPlayers: null,
  fastMoneyP1Answers: [],
  fastMoneyP2Answers: [],
  fastMoneyTimeRemaining: 0,

  // Win condition
  winningTeam: null,

  // Fast Money State
  fastMoney: {
    setIndex: 0,
    questions: [],
    p1Answers: [],
    p2Answers: [],
    currentQuestionIndex: 0,
    p1Score: 0,
    p2Score: 0,
  }
});

const httpServer = createServer();
const wss = new WebSocketServer({ server: httpServer });

const generateCode = () => Math.random().toString(16).slice(2, 6).toUpperCase();

const getTeamToBalance = (players) => {
  const a = players.filter((p) => p.team === 'teamA').length;
  const b = players.filter((p) => p.team === 'teamB').length;
  return a <= b ? 'teamA' : 'teamB';
};

const normalize = (value) => value.trim().toLowerCase();

const evaluateAnswer = (question, text, revealed) => {
  const normalized = normalize(text);
  const already = new Set(revealed.map((r) => normalize(r.text)));
  return question.answers.find((answer) =>
    !already.has(normalize(answer.text)) && normalize(answer.text).includes(normalized)
  );
};

const checkWinCondition = (game) => {
  const WIN_THRESHOLD = 300; // LOW FOR TESTING
  const MAX_ROUNDS = 5;

  const scoreA = game.teams.teamA.score;
  const scoreB = game.teams.teamB.score;

  // Check if either team reached 300 points
  if (scoreA >= WIN_THRESHOLD || scoreB >= WIN_THRESHOLD) {
    if (scoreA > scoreB) {
      game.winningTeam = 'teamA';
      game.phase = 'game-over';
      game.message = `🏆 ${game.teams.teamA.name} WINS! Final Score: ${scoreA} - ${scoreB}`;
      return true;
    } else if (scoreB > scoreA) {
      game.winningTeam = 'teamB';
      game.phase = 'game-over';
      game.message = `🏆 ${game.teams.teamB.name} WINS! Final Score: ${scoreB} - ${scoreA}`;
      return true;
    } else {
      // Tie at 300+ - Sudden Death
      game.phase = 'round-end';
      game.message = `TIE! Sudden Death next round!`;
      return false;
    }
  }

  // Check if max rounds reached
  if (game.currentRound >= MAX_ROUNDS) {
    if (scoreA > scoreB) {
      game.winningTeam = 'teamA';
      game.phase = 'game-over';
      game.message = `🏆 ${game.teams.teamA.name} WINS! Final Score: ${scoreA} - ${scoreB}`;
      return true;
    } else if (scoreB > scoreA) {
      game.winningTeam = 'teamB';
      game.phase = 'game-over';
      game.message = `🏆 ${game.teams.teamB.name} WINS! Final Score: ${scoreB} - ${scoreA}`;
      return true;
    } else {
      // Tie after 5 rounds - Sudden Death
      game.phase = 'round-end';
      game.message = `TIE after ${MAX_ROUNDS} rounds! Sudden Death next!`;
      return false;
    }
  }

  return false;
};

const broadcastState = (code) => {
  const game = games.get(code);
  if (!game) return;
  const payload = JSON.stringify({ type: 'state', state: game });
  for (const [ws, meta] of sockets.entries()) {
    if (meta.gameCode === code && ws.readyState === ws.OPEN) {
      ws.send(payload);
    }
  }
};

const cleanupSocket = (ws) => {
  const meta = sockets.get(ws);
  if (!meta) return;
  const { gameCode, clientId } = meta;
  const game = games.get(gameCode);
  if (game) {
    game.players = game.players.filter((p) => p.id !== clientId);
    // Preserve scores; just mark disconnect by removal.
    broadcastState(gameCode);
  }
  sockets.delete(ws);
};

wss.on('connection', (ws) => {
  const clientId = randomUUID();
  ws.send(JSON.stringify({ type: 'welcome', clientId }));

  ws.on('message', (data) => {
    let parsed;
    try {
      parsed = JSON.parse(data.toString());
    } catch (err) {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
      return;
    }

    const { type } = parsed;

    if (type === 'create') {
      const code = generateCode();
      const game = {
        code,
        hostId: clientId,
        ...baseState(),
      };
      games.set(code, game);
      sockets.set(ws, { gameCode: code, clientId });
      ws.send(JSON.stringify({ type: 'created', code }));
      broadcastState(code);
      return;
    }

    if (type === 'join') {
      const { code, name } = parsed;
      const game = games.get(code);
      if (!game) {
        ws.send(JSON.stringify({ type: 'error', message: 'Game not found' }));
        return;
      }
      const team = getTeamToBalance(game.players);
      game.players.push({ id: clientId, name: name?.trim() || 'Guest', team });
      sockets.set(ws, { gameCode: code, clientId });
      ws.send(JSON.stringify({ type: 'joined', code }));
      broadcastState(code);
      return;
    }

    const meta = sockets.get(ws);
    if (!meta) {
      ws.send(JSON.stringify({ type: 'error', message: 'Join a game first' }));
      return;
    }

    const game = games.get(meta.gameCode);
    if (!game) {
      ws.send(JSON.stringify({ type: 'error', message: 'Game missing' }));
      return;
    }

    if (type === 'set-team' && game.hostId === clientId) {
      const { playerId, team } = parsed;
      const player = game.players.find((p) => p.id === playerId);
      if (player && (team === 'teamA' || team === 'teamB')) {
        player.team = team;
        broadcastState(game.code);
      }
      return;
    }

    if (type === 'start-round' && game.hostId === clientId) {
      const { questionIndex = 0, duration = 45 } = parsed;
      const question = SURVEY_QUESTIONS[questionIndex];
      if (!question) {
        ws.send(JSON.stringify({ type: 'error', message: 'Question not found' }));
        return;
      }

      // Increment round counter
      game.currentRound++;

      // Set point multiplier based on round
      // Round 1: 1x, Rounds 2-3: 2x, Rounds 4-5: 3x
      if (game.currentRound === 1) {
        game.pointMultiplier = 1;
      } else if (game.currentRound >= 2 && game.currentRound <= 3) {
        game.pointMultiplier = 2;
      } else {
        game.pointMultiplier = 3;
      }

      // Start with Face-Off phase
      game.phase = 'face-off';
      game.questionIndex = questionIndex;
      game.currentQuestion = question;
      game.roundDuration = duration;
      game.revealedAnswers = [];
      game.teams.teamA.strikes = 0;
      game.teams.teamB.strikes = 0;
      game.faceOffBuzzers = [];
      game.faceOffWinner = null;
      game.faceOffAnswers = [];
      game.faceOffPhase = 'awaiting-first';
      game.controllingTeam = null;
      game.currentTurnTeam = null;
      game.currentPlayerIndex = 0;
      game.message = `⚡ Round ${game.currentRound} Face-Off! (${game.pointMultiplier}x points)`;
      broadcastState(game.code);
      return;
    }


    // Face-Off: Player buzzes in with answer
    if (type === 'buzz-in') {
      if (game.phase !== 'face-off') return;
      const player = game.players.find((p) => p.id === clientId);
      if (!player) return;

      const { answer } = parsed;
      if (!answer || !answer.trim()) {
        ws.send(JSON.stringify({ type: 'error', message: 'Answer required' }));
        return;
      }

      // Find answer ranking in current question
      const normalizedAnswer = answer.trim().toLowerCase();
      const matchedAnswer = game.currentQuestion.answers.find(
        (a) => a.text.toLowerCase() === normalizedAnswer
      );

      const ranking = matchedAnswer
        ? game.currentQuestion.answers.indexOf(matchedAnswer) + 1  // 1-indexed
        : 999; // Invalid answer gets worst ranking

      const faceOffAnswer = {
        playerId: player.id,
        playerName: player.name,
        team: player.team,
        answer: answer.trim(),
        ranking: ranking,
        isTopAnswer: ranking === 1,
        points: matchedAnswer ? matchedAnswer.points : 0,
        timestamp: Date.now(),
      };

      // First player to buzz
      if (game.faceOffAnswers.length === 0) {
        game.faceOffAnswers.push(faceOffAnswer);
        game.faceOffPhase = 'awaiting-second';

        if (faceOffAnswer.isTopAnswer) {
          // First player has #1 answer - their team wins control
          game.faceOffWinner = player;
          game.phase = 'play-or-pass';
          game.message = `${player.name} gave the #1 answer! ${game.teams[player.team].name} chooses to Play or Pass.`;
        } else {
          // Wait for second player
          game.message = `${player.name} answered "${faceOffAnswer.answer}" (Rank #${ranking}). Waiting for second player...`;
        }

        broadcastState(game.code);
        return;
      }

      // Second player to buzz
      if (game.faceOffAnswers.length === 1) {
        const firstAnswer = game.faceOffAnswers[0];

        // Prevent same team from buzzing twice
        if (player.team === firstAnswer.team) {
          ws.send(JSON.stringify({ type: 'error', message: 'Waiting for opposing team' }));
          return;
        }

        game.faceOffAnswers.push(faceOffAnswer);
        game.faceOffPhase = 'comparing';

        // Compare rankings - lower ranking number wins (1 is best)
        const winner = faceOffAnswer.ranking < firstAnswer.ranking ? faceOffAnswer : firstAnswer;
        const winnerPlayer = game.players.find((p) => p.id === winner.playerId);

        game.faceOffWinner = winnerPlayer;
        game.phase = 'play-or-pass';
        game.message = `${winnerPlayer.name} wins Face-Off with "${winner.answer}" (Rank #${winner.ranking})! ${game.teams[winnerPlayer.team].name} chooses to Play or Pass.`;

        broadcastState(game.code);
        return;
      }

      // Already have two answers - shouldn't happen
      ws.send(JSON.stringify({ type: 'error', message: 'Face-Off already complete' }));
      return;
    }

    // Play-or-Pass: Winner chooses to play or pass
    if (type === 'choose-play-pass' && game.hostId === clientId) {
      if (game.phase !== 'play-or-pass') return;
      const { choice } = parsed; // 'play' or 'pass'
      if (!game.faceOffWinner) return;

      if (choice === 'play') {
        // Winning team plays
        game.controllingTeam = game.faceOffWinner.team;
        game.currentTurnTeam = game.faceOffWinner.team;
        game.message = `${game.teams[game.faceOffWinner.team].name} chooses to PLAY!`;
      } else {
        // Pass to other team
        const otherTeam = game.faceOffWinner.team === 'teamA' ? 'teamB' : 'teamA';
        game.controllingTeam = otherTeam;
        game.currentTurnTeam = otherTeam;
        game.message = `${game.teams[game.faceOffWinner.team].name} passes to ${game.teams[otherTeam].name}!`;
      }

      game.phase = 'round-play';
      game.roundEndsAt = Date.now() + game.roundDuration * 1000;
      game.currentPlayerIndex = 0;
      broadcastState(game.code);
      return;
    }

    if (type === 'answer') {
      if (game.phase !== 'round-play' || !game.currentQuestion) return;
      const player = game.players.find((p) => p.id === clientId);
      if (!player) return;
      const { text } = parsed;
      if (!text || typeof text !== 'string') return;
      const match = evaluateAnswer(game.currentQuestion, text, game.revealedAnswers);
      if (match) {
        game.revealedAnswers.push({ ...match, revealedBy: player.team });
        game.teams[player.team].score += match.points * game.pointMultiplier;
        game.message = `${player.name} found "${match.text}"!`;
      } else {
        game.teams[player.team].strikes = Math.min(3, game.teams[player.team].strikes + 1);
        game.message = `${player.name} missed (${game.teams[player.team].strikes} strike${game.teams[player.team].strikes === 1 ? '' : 's'
          }).`;

        // Check if team got 3 strikes - switch to steal opportunity
        if (game.teams[player.team].strikes >= 3) {
          const otherTeam = player.team === 'teamA' ? 'teamB' : 'teamA';
          game.phase = 'team-steal';
          game.stealingTeam = otherTeam;
          game.message = `${game.teams[otherTeam].name} can STEAL!`;
        }
      }
      broadcastState(game.code);
      return;
    }

    // Steal attempt: opposing team tries to steal after 3 strikes
    if (type === 'steal-attempt') {
      if (game.phase !== 'team-steal') return;
      const { text } = parsed;
      if (!text || typeof text !== 'string') return;

      const match = evaluateAnswer(game.currentQuestion, text, game.revealedAnswers);
      if (match) {
        // Steal successful! Award points to stealing team
        game.revealedAnswers.push({ ...match, revealedBy: game.stealingTeam });
        game.teams[game.stealingTeam].score += match.points * game.pointMultiplier;
        game.message = `STEAL SUCCESSFUL! ${game.teams[game.stealingTeam].name} found \"${match.text}\"!`;
      } else {
        // Steal failed - points stay with original team
        game.message = `Steal failed! Points remain with ${game.teams[game.controllingTeam].name}.`;
      }

      // Check for win condition
      if (!checkWinCondition(game)) {
        // No winner yet, move to round-end
        game.phase = 'round-end';
      }

      game.roundEndsAt = null;
      broadcastState(game.code);
      return;
    }

    if (type === 'start-fast-money') {
      // Initialize Fast Money
      const setIndex = Math.floor(Math.random() * FAST_MONEY_SETS.length);
      game.fastMoney = {
        setIndex,
        questions: FAST_MONEY_SETS[setIndex],
        p1Answers: [],
        p2Answers: [],
        currentQuestionIndex: 0,
        p1Score: 0,
        p2Score: 0,
      };
      game.phase = 'fast-money-p1';
      game.roundDuration = 20; // 20 seconds for player 1
      game.roundEndsAt = Date.now() + 20000;
      game.message = 'Fast Money: Player 1 (20 seconds)';
      broadcastState(game.code);
    }

    if (type === 'fast-money-answer') {
      const { answer, questionIndex } = parsed;
      const isP1 = game.phase === 'fast-money-p1';
      const question = game.fastMoney.questions[questionIndex];

      // Find matching answer
      const normalized = normalize(answer);
      const match = question.answers.find(a => normalize(a.text) === normalized);
      const points = match ? match.points : 0;
      const text = match ? match.text : answer; // Use official text if match, else raw input

      if (isP1) {
        game.fastMoney.p1Answers[questionIndex] = { text, points };
        game.fastMoney.p1Score += points;
      } else {
        // Check duplicate with P1
        const p1Answer = game.fastMoney.p1Answers[questionIndex];
        if (p1Answer && normalize(p1Answer.text) === normalized) {
          // Duplicate! 0 points (buzzer sound on client)
          game.fastMoney.p2Answers[questionIndex] = { text: 'DUPLICATE', points: 0 };
        } else {
          game.fastMoney.p2Answers[questionIndex] = { text, points };
          game.fastMoney.p2Score += points;
        }
      }
      broadcastState(game.code);
    }

    if (type === 'finish-fast-money-p1') {
      game.phase = 'fast-money-p2';
      game.roundDuration = 25; // 25 seconds for player 2
      game.roundEndsAt = Date.now() + 25000;
      game.message = 'Fast Money: Player 2 (25 seconds)';
      game.fastMoney.currentQuestionIndex = 0; // Reset for P2
      broadcastState(game.code);
    }

    if (type === 'finish-round' && game.hostId === clientId) {
      // Check for win condition first
      if (!checkWinCondition(game)) {
        // No winner yet, go to round-end
        game.phase = 'round-end';
      }
      game.roundEndsAt = null;
      broadcastState(game.code);
      return;
    }

    if (type === 'reset' && game.hostId === clientId) {
      const preservedScores = {
        teamA: game.teams.teamA.score,
        teamB: game.teams.teamB.score,
      };
      Object.assign(game, {
        ...baseState(),
        code: game.code,
        hostId: game.hostId,
      });
      game.teams.teamA.score = preservedScores.teamA;
      game.teams.teamB.score = preservedScores.teamB;
      broadcastState(game.code);
    }
  });

  ws.on('close', () => cleanupSocket(ws));
});

setInterval(() => {
  const now = Date.now();
  for (const game of games.values()) {
    if (game.phase === 'round' && game.roundEndsAt && game.roundEndsAt <= now) {
      game.phase = 'between';
      game.roundEndsAt = null;
      game.message = 'Time up!';
      broadcastState(game.code);
    }
  }
}, 1000);

httpServer.listen(PORT, () => {
  console.log(`Family Feud server listening on ws://localhost:${PORT}`);
});
