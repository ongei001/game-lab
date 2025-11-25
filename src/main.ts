import './style.css';
import { SURVEY_QUESTIONS } from './data/questions';
import type { ClientRole, GameState, PlayerState, TeamChoice } from './types';
import { playCorrect, playStrike, playTransition } from './sound';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) {
  throw new Error('#app container missing');
}

const socketUrl = import.meta.env.VITE_SOCKET_URL ?? `ws://${window.location.hostname}:8787`;
let socket: WebSocket | null = null;
let clientId = '';
let role: ClientRole = null;
let state: GameState | null = null;
let lastState: GameState | null = null;

app.innerHTML = `
  <header class="topbar">
    <div>
      <p class="eyebrow">Family Feud Live</p>
      <h1>Fast, remote-friendly survey battles</h1>
    </div>
    <div class="status-block">
      <span class="dot" id="ws-dot"></span>
      <span id="ws-status">Connecting…</span>
    </div>
  </header>
  <main class="layout">
    <section class="card" id="setup-card">
      <h2>Host or Join</h2>
      <div class="stack">
        <button id="host-btn" class="primary">Start as host</button>
        <div class="join-form">
          <label for="join-code">Join code</label>
          <div class="h-stack">
            <input id="join-code" name="code" placeholder="ABCD" maxlength="6" />
            <input id="join-name" name="name" placeholder="Your name" />
            <button id="join-btn" class="secondary">Join</button>
          </div>
        </div>
        <p class="hint">Share the join code in your Zoom chat so players can hop in.</p>
        <p class="hint" id="host-code"></p>
      </div>
    </section>

    <section class="card" id="lobby-card">
      <div class="section-head">
        <h2>Lobby & Teams</h2>
        <span id="phase-pill" class="pill">Waiting</span>
      </div>
      <div class="grid two">
        <div>
          <h3>Players</h3>
          <ul id="player-list" class="list"></ul>
        </div>
        <div>
          <h3>Team Scores</h3>
          <div class="scores">
            <div class="score" id="teamA-score"></div>
            <div class="score" id="teamB-score"></div>
          </div>
          <p class="hint">Host: click a name to swap teams.</p>
        </div>
      </div>
    </section>

    <section class="card" id="round-card">
      <div class="section-head">
        <h2>Round Board</h2>
        <div class="timer" id="timer"></div>
      </div>
      <p class="question" id="question">Waiting for host to start…</p>
      <div class="answers" id="answers"></div>
      <div class="strikes" id="strikes"></div>
      <div class="message" id="message"></div>
      <div class="controls" id="host-controls">
        <label class="inline">Question
          <select id="question-select"></select>
        </label>
        <label class="inline">Timer (seconds)
          <input id="duration" type="number" min="15" max="120" value="45" />
        </label>
        <button id="start-round" class="primary">Start round</button>
        <button id="end-round" class="secondary">End round</button>
      </div>
      <form id="answer-form" class="answer-form">
        <input id="answer-input" placeholder="Type your best guess" autocomplete="off" />
        <button type="submit" class="primary">Submit answer</button>
      </form>
    </section>
  </main>
`;

const wsDot = document.querySelector<HTMLSpanElement>('#ws-dot');
const wsStatus = document.querySelector<HTMLSpanElement>('#ws-status');
const hostBtn = document.querySelector<HTMLButtonElement>('#host-btn');
const joinBtn = document.querySelector<HTMLButtonElement>('#join-btn');
const joinCodeInput = document.querySelector<HTMLInputElement>('#join-code');
const joinNameInput = document.querySelector<HTMLInputElement>('#join-name');
const hostCode = document.querySelector<HTMLParagraphElement>('#host-code');
const phasePill = document.querySelector<HTMLSpanElement>('#phase-pill');
const playerList = document.querySelector<HTMLUListElement>('#player-list');
const teamAScore = document.querySelector<HTMLDivElement>('#teamA-score');
const teamBScore = document.querySelector<HTMLDivElement>('#teamB-score');
const questionEl = document.querySelector<HTMLParagraphElement>('#question');
const answersEl = document.querySelector<HTMLDivElement>('#answers');
const strikesEl = document.querySelector<HTMLDivElement>('#strikes');
const messageEl = document.querySelector<HTMLDivElement>('#message');
const timerEl = document.querySelector<HTMLDivElement>('#timer');
const questionSelect = document.querySelector<HTMLSelectElement>('#question-select');
const durationInput = document.querySelector<HTMLInputElement>('#duration');
const startRoundBtn = document.querySelector<HTMLButtonElement>('#start-round');
const endRoundBtn = document.querySelector<HTMLButtonElement>('#end-round');
const answerForm = document.querySelector<HTMLFormElement>('#answer-form');
const answerInput = document.querySelector<HTMLInputElement>('#answer-input');
const hostControls = document.querySelector<HTMLDivElement>('#host-controls');

SURVEY_QUESTIONS.forEach((question, index) => {
  const option = document.createElement('option');
  option.value = `${index}`;
  option.textContent = `${index + 1}. ${question.prompt}`;
  questionSelect?.appendChild(option);
});

const setStatus = (text: string, connected: boolean): void => {
  wsStatus!.textContent = text;
  wsDot!.classList.toggle('connected', connected);
};

const ensureSocket = (): void => {
  if (socket && socket.readyState === WebSocket.OPEN) return;
  socket = new WebSocket(socketUrl);
  setStatus('Connecting…', false);
  socket.addEventListener('open', () => setStatus('Connected', true));
  socket.addEventListener('close', () => setStatus('Disconnected', false));
  socket.addEventListener('message', (event) => {
    const payload = JSON.parse(event.data);
    if (payload.type === 'welcome') {
      clientId = payload.clientId;
    }
    if (payload.type === 'created') {
      hostCode!.textContent = `Join code: ${payload.code}`;
    }
    if (payload.type === 'state') {
      applyState(payload.state as GameState);
    }
    if (payload.type === 'error') {
      messageEl!.textContent = payload.message;
    }
  });
};

const send = (data: Record<string, unknown>): void => {
  ensureSocket();
  if (!socket) return;
  socket.send(JSON.stringify(data));
};

const swapTeam = (player: PlayerState): void => {
  if (role !== 'host') return;
  const nextTeam: TeamChoice = player.team === 'teamA' ? 'teamB' : 'teamA';
  send({ type: 'set-team', playerId: player.id, team: nextTeam });
};

const renderPlayers = (): void => {
  if (!playerList || !state) return;
  playerList.innerHTML = '';
  state.players.forEach((player) => {
    const li = document.createElement('li');
    li.dataset.id = player.id;
    li.innerHTML = `<span>${player.name}</span><span class="pill team-${player.team}">${
      player.team === 'teamA' ? 'Team A' : 'Team B'
    }</span>`;
    if (role === 'host') {
      li.classList.add('clickable');
      li.addEventListener('click', () => swapTeam(player));
    }
    playerList.appendChild(li);
  });
};

const renderScores = (): void => {
  if (!state || !teamAScore || !teamBScore) return;
  teamAScore.innerHTML = `<strong>Team A</strong><span>${state.teams.teamA.score} pts</span>`;
  teamBScore.innerHTML = `<strong>Team B</strong><span>${state.teams.teamB.score} pts</span>`;
};

const renderPhase = (): void => {
  if (!state || !phasePill) return;
  const map: Record<string, string> = {
    lobby: 'Lobby',
    round: 'Round live',
    between: 'Intermission',
  };
  phasePill.textContent = map[state.phase] ?? 'Waiting';
  phasePill.className = `pill pill-${state.phase}`;
};

const renderQuestion = (): void => {
  if (!state || !questionEl || !answersEl) return;
  if (state.currentQuestion) {
    questionEl.textContent = state.currentQuestion.prompt;
    answersEl.innerHTML = '';
    state.currentQuestion.answers.forEach((answer) => {
      const revealed = state.revealedAnswers.find((r) => r.text === answer.text);
      const div = document.createElement('div');
      div.className = `answer ${revealed ? 'revealed' : ''}`;
      const foundBy = revealed?.revealedBy === 'teamA' ? '🟦 Team A' : revealed?.revealedBy === 'teamB' ? '🟥 Team B' : '';
      div.innerHTML = `
        <span>${revealed ? answer.text : '— — —'}</span>
        <span class="points">${answer.points} pts ${foundBy ? `• ${foundBy}` : ''}</span>
      `;
      answersEl.appendChild(div);
    });
  } else {
    questionEl.textContent = 'Waiting for host to start…';
    answersEl.innerHTML = '';
  }
};

const renderStrikes = (): void => {
  if (!state || !strikesEl) return;
  const strikeIcons = (count: number) => Array.from({ length: count }, () => '❌').join(' ');
  strikesEl.innerHTML = `
    <div><strong>Team A</strong> ${strikeIcons(state.teams.teamA.strikes)}</div>
    <div><strong>Team B</strong> ${strikeIcons(state.teams.teamB.strikes)}</div>
  `;
};

const renderMessage = (): void => {
  if (!messageEl) return;
  messageEl.textContent = state?.message ?? '';
};

const renderHostControls = (): void => {
  if (!hostControls) return;
  hostControls.style.display = role === 'host' ? 'flex' : 'none';
};

const renderAnswerForm = (): void => {
  if (!answerForm) return;
  const canAnswer = state?.phase === 'round' && role === 'player';
  answerForm.style.display = canAnswer ? 'flex' : 'none';
  if (canAnswer) {
    answerInput?.focus();
  }
};

const applyAudio = (next: GameState): void => {
  if (!lastState) {
    lastState = next;
    return;
  }
  if (next.revealedAnswers.length > lastState.revealedAnswers.length) {
    playCorrect();
  }
  const teamAStrikeUp = next.teams.teamA.strikes > lastState.teams.teamA.strikes;
  const teamBStrikeUp = next.teams.teamB.strikes > lastState.teams.teamB.strikes;
  if (teamAStrikeUp || teamBStrikeUp) {
    playStrike();
  }
  if (lastState.phase !== next.phase && next.phase === 'between') {
    playTransition();
  }
  lastState = next;
};

const applyState = (next: GameState): void => {
  state = next;
  applyAudio(next);
  renderPlayers();
  renderScores();
  renderPhase();
  renderQuestion();
  renderStrikes();
  renderMessage();
  renderAnswerForm();
  renderHostControls();
  if (state?.code && role === 'host') {
    hostCode!.textContent = `Join code: ${state.code}`;
  }
};

const startTimerLoop = (): void => {
  const tick = () => {
    if (state?.roundEndsAt && state.phase === 'round') {
      const remaining = Math.max(0, state.roundEndsAt - Date.now());
      const seconds = Math.ceil(remaining / 1000);
      const baseDuration = state.roundDuration ?? Number(durationInput?.value) ?? 45;
      const ratio = Math.max(0, Math.min(1, remaining / (baseDuration * 1000)));
      timerEl!.innerHTML = `<div class="timer-bar" style="width:${ratio * 100}%"></div><span>${seconds}s</span>`;
    } else {
      timerEl!.innerHTML = '<div class="timer-bar" style="width:0"></div><span>—</span>';
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

hostBtn?.addEventListener('click', () => {
  role = 'host';
  ensureSocket();
  send({ type: 'create' });
});

joinBtn?.addEventListener('click', () => {
  role = 'player';
  ensureSocket();
  const code = joinCodeInput?.value.trim().toUpperCase();
  const name = joinNameInput?.value.trim() || 'Guest';
  if (code) {
    send({ type: 'join', code, name });
  }
});

startRoundBtn?.addEventListener('click', () => {
  if (role !== 'host') return;
  const questionIndex = Number(questionSelect?.value || 0);
  const duration = Number(durationInput?.value || 45);
  send({ type: 'start-round', questionIndex, duration });
});

endRoundBtn?.addEventListener('click', () => {
  if (role !== 'host') return;
  send({ type: 'finish-round' });
});

answerForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  if (role !== 'player') return;
  const text = answerInput?.value.trim();
  if (text) {
    send({ type: 'answer', text });
    answerInput.value = '';
  }
});

ensureSocket();
startTimerLoop();
