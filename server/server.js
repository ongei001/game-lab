import { createServer } from 'http';
import { randomUUID } from 'crypto';
import { WebSocketServer } from 'ws';
import { SURVEY_QUESTIONS } from './questions.js';

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

  // Turn-based play
  controllingTeam: null, // Team that won Face-Off/is playing
  currentTurnTeam: null, // Team whose turn it is currently
  currentPlayerIndex: 0, // Index within the team's players

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
      game.controllingTeam = null;
      game.currentTurnTeam = null;
      game.currentPlayerIndex = 0;
      game.message = '⚡ Face-Off! First to buzz in!';
      broadcastState(game.code);
      return;
    }

    // Face-Off: Player buzzes in
    if (type === 'buzz-in') {
      if (game.phase !== 'face-off') return;
      const player = game.players.find((p) => p.id === clientId);
      if (!player) return;

      // Record the buzz-in with timestamp
      const buzzEvent = {
        playerId: player.id,
        playerName: player.name,
        team: player.team,
        timestamp: Date.now(),
      };

      // Only record if first buzzer or very close (within 50ms of first)
      if (game.faceOffBuzzers.length === 0) {
        game.faceOffBuzzers.push(buzzEvent);
        game.faceOffWinner = player;
        game.phase = 'play-or-pass';
        game.message = `${player.name} buzzed in first! Choose to Play or Pass.`;
        broadcastState(game.code);
      }
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

      // Move to round-end
      game.phase = 'round-end';
      game.roundEndsAt = null;
      broadcastState(game.code);
      return;
    }

    if (type === 'finish-round' && game.hostId === clientId) {
      game.phase = 'round-end';
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
