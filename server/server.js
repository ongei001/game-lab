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
  questionIndex: null,
  roundEndsAt: null,
  roundDuration: 45,
  revealedAnswers: [],
  message: '',
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
      game.phase = 'round';
      game.questionIndex = questionIndex;
      game.currentQuestion = question;
      game.roundEndsAt = Date.now() + duration * 1000;
      game.roundDuration = duration;
      game.revealedAnswers = [];
      game.teams.teamA.strikes = 0;
      game.teams.teamB.strikes = 0;
      game.message = '';
      broadcastState(game.code);
      return;
    }

    if (type === 'answer') {
      if (game.phase !== 'round' || !game.currentQuestion) return;
      const player = game.players.find((p) => p.id === clientId);
      if (!player) return;
      const { text } = parsed;
      if (!text || typeof text !== 'string') return;
      const match = evaluateAnswer(game.currentQuestion, text, game.revealedAnswers);
      if (match) {
        game.revealedAnswers.push({ ...match, revealedBy: player.team });
        game.teams[player.team].score += match.points;
        game.message = `${player.name} found "${match.text}"!`;
      } else {
        game.teams[player.team].strikes = Math.min(3, game.teams[player.team].strikes + 1);
        game.message = `${player.name} missed (${game.teams[player.team].strikes} strike${
          game.teams[player.team].strikes === 1 ? '' : 's'
        }).`;
      }
      broadcastState(game.code);
      return;
    }

    if (type === 'finish-round' && game.hostId === clientId) {
      game.phase = 'between';
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
