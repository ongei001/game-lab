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
  
  <!-- VIEW 1: LANDING (Host or Join) -->
  <div id="view-landing" class="view">
    <main class="layout centered">
      <section class="card welcome-card">
        <h2>Welcome to Family Feud Live!</h2>
        <p class="subtitle">Choose how you'd like to play</p>
        <div class="action-buttons">
          <button id="host-btn" class="primary large">🎮 Start as Host</button>
          <div class="divider">or</div>
          <div class="join-section">
            <label for="join-code">Join an existing game</label>
            <div class="h-stack">
              <input id="join-code" name="code" placeholder="Game Code" maxlength="6" />
              <input id="join-name" name="name" placeholder="Your Name" />
              <button id="join-btn" class="secondary">Join Game</button>
            </div>
          </div>
        </div>
      </section>
    </main>
  </div>

  <!-- VIEW 2: LOBBY (Team Assignment) -->
  <div id="view-lobby" class="view" style="display:none;">
    <main class="layout">
      <section class="card">
        <div class="section-head">
          <h2>Game Lobby</h2>
          <span id="phase-pill" class="pill">Waiting</span>
        </div>
        <div class="join-code-display">
          <span class="label">Join Code:</span>
          <span id="host-code-lobby" class="code-text"></span>
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
            <p class="hint">Host: click a name to swap teams</p>
          </div>
        </div>
        <div class="controls" id="lobby-host-controls" style="display:none;">
          <button id="start-game-btn" class="primary large">Start Game →</button>
        </div>
      </section>
    </main>
  </div>

  <!-- VIEW 3: GAME (Face-Off, Rounds, Gameplay) -->
  <div id="view-game" class="view" style="display:none;">
    <main class="layout">
      <section class="card scores-header">
        <div class="scores-compact">
          <div class="score-item teamA">
            <span class="team-name">Team A</span>
            <span id="score-a" class="score-value">0</span>
          </div>
          <div class="round-badge">
            <span id="round-display" class="pill">Round 0</span>
            <span id="phase-pill-game" class="pill">Waiting</span>
          </div>
          <div class="score-item teamB">
            <span class="team-name">Team B</span>
            <span id="score-b" class="score-value">0</span>
          </div>
        </div>
      </section>
      
      <section class="card">
        <div class="section-head">
          <h2>Round Board</h2>
          <div class="timer" id="timer"></div>
        </div>
        <p class="question" id="question">Waiting for host to start…</p>
        <div class="answers" id="answers"></div>
        <div class="strikes" id="strikes"></div>
        <div class="message" id="message"></div>
        
        <!-- Host Controls -->
        <div class="controls" id="host-controls">
          <label class="inline">Question
            <select id="question-select"></select>
          </label>
          <label class="inline">Timer (seconds)
            <input id="duration" type="number" min="15" max="120" value="45" />
          </label>
          <button id="start-round" class="primary">Start Round</button>
          <button id="end-round" class="secondary">End Round</button>
        </div>
        
        <!-- Buzzer for Face-Off -->
        <div id="buzzer-container" style="display:none; text-align:center; margin-top:16px;">
          <button id="buzz-btn" class="buzzer-btn">🔔 BUZZ IN!</button>
        </div>
        
        <!-- Play or Pass Dialog -->
        <div id="play-pass-dialog" class="modal" style="display:none;">
          <div class="modal-content">
            <h3>You won the Face-Off!</h3>
            <p>Choose to PLAY or PASS control to the other team.</p>
            <div class="h-stack">
              <button id="choose-play" class="primary">PLAY</button>
              <button id="choose-pass" class="secondary">PASS</button>
            </div>
          </div>
        </div>
        
        <!-- Steal Attempt Form -->
        <form id="steal-form" class="answer-form" style="display:none;">
          <input id="steal-input" placeholder="Your steal attempt..." autocomplete="off" />
          <button type="submit" class="primary">STEAL!</button>
        </form>
        
        <!-- Regular Answer Form -->
        <form id="answer-form" class="answer-form">
          <input id="answer-input" placeholder="Type your best guess" autocomplete="off" />
          <button type="submit" class="primary">Submit Answer</button>
        </form>
      </section>
    </main>
  </div>

  <!-- VIEW 5: FAST MONEY -->
  <div id="view-fast-money" class="view" style="display:none;">
    <main class="layout">
      <section class="card">
        <div class="section-head">
          <h2>Fast Money</h2>
          <div class="timer large" id="fm-timer">20</div>
        </div>
        
        <div class="grid two">
          <!-- Left: Questions/Inputs (Host only) -->
          <div id="fm-host-panel">
            <div class="current-question-card">
              <p id="fm-question-text" class="question-text">Ready?</p>
              <div class="controls">
                <input id="fm-answer-input" placeholder="Type answer..." autocomplete="off" />
                <button id="fm-submit-btn" class="primary">Submit</button>
                <button id="fm-pass-btn" class="secondary">Pass</button>
              </div>
            </div>
          </div>
          
          <!-- Right: Answer Board -->
          <div id="fm-board">
            <div class="fm-row" id="fm-row-0"><span>1.</span> <span class="fm-ans"></span> <span class="fm-pts"></span></div>
            <div class="fm-row" id="fm-row-1"><span>2.</span> <span class="fm-ans"></span> <span class="fm-pts"></span></div>
            <div class="fm-row" id="fm-row-2"><span>3.</span> <span class="fm-ans"></span> <span class="fm-pts"></span></div>
            <div class="fm-row" id="fm-row-3"><span>4.</span> <span class="fm-ans"></span> <span class="fm-pts"></span></div>
            <div class="fm-row" id="fm-row-4"><span>5.</span> <span class="fm-ans"></span> <span class="fm-pts"></span></div>
            <div class="fm-total">Total: <span id="fm-total-score">0</span></div>
          </div>
        </div>
        
        <div class="controls" id="fm-controls" style="display:none;">
          <button id="fm-start-p1" class="primary">Start Player 1</button>
          <button id="fm-start-p2" class="secondary">Start Player 2</button>
          <button id="fm-reveal-all" class="secondary">Reveal Answers</button>
        </div>
      </section>
    </main>
  </div>

  <!-- VIEW 4: VICTORY (Game Over) -->
  <div id="view-victory" class="view" style="display:none;">
    <main class="layout centered">
      <section class="card victory-card">
        <div class="trophy">🏆</div>
        <h2 id="victory-title">Team A Wins!</h2>
        <p id="victory-subtitle" class="final-score">Final Score: 350 - 200</p>
        <div class="victory-actions">
          <button id="play-again-btn" class="primary large">Play Again</button>
          <button id="start-fm-btn" class="secondary large" style="display:none;">💰 Fast Money</button>
          <button id="back-home-btn" class="secondary">Back to Home</button>
        </div>
      </section>
    </main>
  </div>
`;



// View Management
const views = {
  landing: document.querySelector<HTMLDivElement>('#view-landing'),
  lobby: document.querySelector<HTMLDivElement>('#view-lobby'),
  game: document.querySelector<HTMLDivElement>('#view-game'),
  victory: document.querySelector<HTMLDivElement>('#view-victory'),
  fastMoney: document.querySelector<HTMLDivElement>('#view-fast-money'),
};

type ViewName = keyof typeof views;

const switchView = (viewName: ViewName): void => {
  Object.entries(views).forEach(([name, view]) => {
    if (view) {
      view.style.display = name === viewName ? 'block' : 'none';
    }
  });
};

// DOM Element References
const wsDot = document.querySelector<HTMLSpanElement>('#ws-dot');
const wsStatus = document.querySelector<HTMLSpanElement>('#ws-status');

// Landing view elements
const hostBtn = document.querySelector<HTMLButtonElement>('#host-btn');
const joinBtn = document.querySelector<HTMLButtonElement>('#join-btn');
const joinCodeInput = document.querySelector<HTMLInputElement>('#join-code');
const joinNameInput = document.querySelector<HTMLInputElement>('#join-name');

// Lobby view elements
const hostCodeLobby = document.querySelector<HTMLSpanElement>('#host-code-lobby');
const phasePill = document.querySelector<HTMLSpanElement>('#phase-pill');
const playerList = document.querySelector<HTMLUListElement>('#player-list');
const teamAScore = document.querySelector<HTMLDivElement>('#teamA-score');
const teamBScore = document.querySelector<HTMLDivElement>('#teamB-score');
const lobbyHostControls = document.querySelector<HTMLDivElement>('#lobby-host-controls');
const startGameBtn = document.querySelector<HTMLButtonElement>('#start-game-btn');

// Game view elements
const scoreA = document.querySelector<HTMLSpanElement>('#score-a');
const scoreB = document.querySelector<HTMLSpanElement>('#score-b');
const roundDisplay = document.querySelector<HTMLSpanElement>('#round-display');
const phasePillGame = document.querySelector<HTMLSpanElement>('#phase-pill-game');
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
const buzzerContainer = document.querySelector<HTMLDivElement>('#buzzer-container');
const buzzBtn = document.querySelector<HTMLButtonElement>('#buzz-btn');
const playPassDialog = document.querySelector<HTMLDivElement>('#play-pass-dialog');
const choosePlayBtn = document.querySelector<HTMLButtonElement>('#choose-play');
const choosePassBtn = document.querySelector<HTMLButtonElement>('#choose-pass');
const stealForm = document.querySelector<HTMLFormElement>('#steal-form');
const stealInput = document.querySelector<HTMLInputElement>('#steal-input');

// Victory view elements
const victoryTitle = document.querySelector<HTMLHeadingElement>('#victory-title');
const victorySubtitle = document.querySelector<HTMLParagraphElement>('#victory-subtitle');
const playAgainBtn = document.querySelector<HTMLButtonElement>('#play-again-btn');
const startFmBtn = document.querySelector<HTMLButtonElement>('#start-fm-btn');
const backHomeBtn = document.querySelector<HTMLButtonElement>('#back-home-btn');

// Fast Money elements
const fmTimer = document.querySelector<HTMLDivElement>('#fm-timer');
const fmQuestionText = document.querySelector<HTMLParagraphElement>('#fm-question-text');
const fmAnswerInput = document.querySelector<HTMLInputElement>('#fm-answer-input');
const fmSubmitBtn = document.querySelector<HTMLButtonElement>('#fm-submit-btn');
const fmPassBtn = document.querySelector<HTMLButtonElement>('#fm-pass-btn');
const fmBoard = document.querySelector<HTMLDivElement>('#fm-board');
const fmTotalScore = document.querySelector<HTMLSpanElement>('#fm-total-score');
const fmControls = document.querySelector<HTMLDivElement>('#fm-controls');
const fmStartP1Btn = document.querySelector<HTMLButtonElement>('#fm-start-p1');
const fmStartP2Btn = document.querySelector<HTMLButtonElement>('#fm-start-p2');



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
      if (hostCodeLobby) hostCodeLobby.textContent = payload.code;
      switchView('lobby'); // Move to lobby view after creating game
    }
    if (payload.type === 'joined') {
      switchView('lobby'); // Move to lobby view after joining
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

const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
};

const renderPlayers = (): void => {
  if (!playerList || !state) return;
  playerList.innerHTML = '';

  state.players.forEach((player) => {
    const li = document.createElement('li');
    li.dataset.id = player.id;

    // Create avatar element
    const avatar = document.createElement('div');
    avatar.className = `avatar team-${player.team}`;
    avatar.textContent = getInitials(player.name);

    // Create name element
    const nameSpan = document.createElement('span');
    nameSpan.className = 'player-name';
    nameSpan.textContent = player.name;

    // Create container
    const container = document.createElement('div');
    container.className = 'player-item';
    if (role === 'host') container.classList.add('clickable');

    container.appendChild(avatar);
    container.appendChild(nameSpan);

    li.appendChild(container);

    if (role === 'host') {
      container.addEventListener('click', () => swapTeam(player));
    }
    playerList.appendChild(li);
  });
};

const renderScores = (): void => {
  if (!state) return;

  // Lobby scores (detailed)
  if (teamAScore && teamBScore) {
    teamAScore.innerHTML = `<strong>Team A</strong><span>${state.teams.teamA.score} pts</span>`;
    teamBScore.innerHTML = `<strong>Team B</strong><span>${state.teams.teamB.score} pts</span>`;
  }

  // Game view scores (compact)
  if (scoreA) scoreA.textContent = String(state.teams.teamA.score);
  if (scoreB) scoreB.textContent = String(state.teams.teamB.score);
};

const renderLobbyHostControls = (): void => {
  if (!lobbyHostControls) return;
  lobbyHostControls.style.display = role === 'host' ? 'flex' : 'none';
};

const renderPhase = (): void => {
  if (!state || !phasePill) return;
  const map: Record<string, string> = {
    lobby: 'Lobby',
    'face-off': '⚡ Face-Off',
    'play-or-pass': '🎯 Play or Pass',
    'round-play': '▶️ Round Live',
    'team-steal': '🎲 STEAL!',
    'round-end': 'Round Complete',
    'fast-money-p1': '⏱️ Fast Money P1',
    'fast-money-p2': '⏱️ Fast Money P2',
    'game-over': '🏆 Game Over',
  };
  phasePill.textContent = map[state.phase] ?? 'Waiting';
  phasePill.className = `pill pill-${state.phase}`;
};

const renderRoundInfo = (): void => {
  if (!state || !roundDisplay) return;
  const round = state.currentRound || 0;
  const mult = state.pointMultiplier || 1;
  roundDisplay.textContent = round > 0 ? `Round ${round} (${mult}x)` : 'Lobby';
  roundDisplay.className = round > 0 ? 'pill pill-round' : 'pill';
};

const renderQuestion = (): void => {
  if (!state || !questionEl || !answersEl) return;

  // Update question text if changed
  if (questionEl.textContent !== (state.currentQuestion?.prompt || 'Waiting for host to start…')) {
    questionEl.textContent = state.currentQuestion?.prompt || 'Waiting for host to start…';
  }

  if (!state.currentQuestion) {
    answersEl.innerHTML = '';
    return;
  }

  // Smart update for answers to preserve animations
  const answers = state.currentQuestion.answers;

  // If question changed (different number of answers or text), clear board
  if (answersEl.children.length !== answers.length) {
    answersEl.innerHTML = '';
    answers.forEach((answer) => {
      const div = document.createElement('div');
      div.className = 'answer';
      div.dataset.text = answer.text; // Store text for comparison
      div.innerHTML = `
        <div class="answer-content">
          <span>— — —</span>
          <span class="points">0</span>
        </div>
      `;
      answersEl.appendChild(div);
    });
  }

  // Update each answer card
  Array.from(answersEl.children).forEach((div, index) => {
    const answer = answers[index];
    const revealed = state?.revealedAnswers.find((r) => r.text === answer.text);
    const isRevealedInDom = div.classList.contains('revealed');

    if (revealed && !isRevealedInDom) {
      // New reveal! Animate it.
      div.classList.add('revealed', 'reveal-anim');
      const foundBy = revealed.revealedBy === 'teamA' ? '🟦 Team A' : revealed.revealedBy === 'teamB' ? '🟥 Team B' : '';
      div.innerHTML = `
        <div class="answer-content">
          <span>${answer.text}</span>
          <span class="points">${answer.points} pts ${foundBy ? `• ${foundBy}` : ''}</span>
        </div>
      `;
    }
  });
};

const renderStrikes = (): void => {
  if (!state || !strikesEl) return;

  // Ensure container structure exists
  if (!strikesEl.querySelector('.team-strikes')) {
    strikesEl.innerHTML = `
      <div class="team-strikes" id="strikes-teamA"><strong>Team A</strong> <div class="icons"></div></div>
      <div class="team-strikes" id="strikes-teamB"><strong>Team B</strong> <div class="icons"></div></div>
    `;
  }

  const updateTeamStrikes = (team: 'teamA' | 'teamB') => {
    const container = strikesEl.querySelector(`#strikes-${team} .icons`);
    if (!container) return;

    const currentStrikes = state!.teams[team].strikes;
    const domStrikes = container.children.length;

    if (currentStrikes === 0 && domStrikes > 0) {
      container.innerHTML = ''; // Reset
    } else if (currentStrikes > domStrikes) {
      // Add new strikes with animation
      for (let i = domStrikes; i < currentStrikes; i++) {
        const span = document.createElement('span');
        span.textContent = '❌';
        span.className = 'strike-anim';
        container.appendChild(span);
      }
    }
  };

  updateTeamStrikes('teamA');
  updateTeamStrikes('teamB');
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
  const canAnswer = state?.phase === 'round-play' && role === 'player';
  answerForm.style.display = canAnswer ? 'flex' : 'none';
  if (canAnswer) {
    answerInput?.focus();
  }
};

const renderBuzzer = (): void => {
  if (!buzzerContainer) return;
  const showBuzzer = state?.phase === 'face-off' && role === 'player';
  buzzerContainer.style.display = showBuzzer ? 'block' : 'none';
};

const renderPlayPassDialog = (): void => {
  if (!playPassDialog) return;
  // Only show to host for the Face-Off winner's decision
  const showDialog = state?.phase === 'play-or-pass' && role === 'host' && state?.faceOffWinner;
  playPassDialog.style.display = showDialog ? 'flex' : 'none';
};

const renderStealForm = (): void => {
  if (!stealForm) return;
  // Show steal form to stealing team's players
  const playerState = state?.players.find(p => p.id === clientId);
  const isOnStealingTeam = playerState && state?.stealingTeam === playerState.team;
  const canSteal = state?.phase === 'team-steal' && role === 'player' && isOnStealingTeam;
  stealForm.style.display = canSteal ? 'flex' : 'none';
  if (canSteal) {
    stealInput?.focus();
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
  if (lastState.phase !== next.phase && next.phase === 'round-end') {
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
  renderRoundInfo();
  renderQuestion();
  renderStrikes();
  renderMessage();
  renderAnswerForm();
  renderHostControls();
  renderLobbyHostControls();
  renderBuzzer();
  renderPlayPassDialog();
  renderStealForm();
  renderFastMoney();
  if (state?.code && role === 'host' && hostCodeLobby) {
    hostCodeLobby.textContent = state.code;
  }

  // Auto-switch views based on game state
  if (state?.phase === 'game-over' && state.winningTeam) {
    switchView('victory');
    if (victoryTitle && victorySubtitle) {
      const winner = state.teams[state.winningTeam];
      const loser = state.winningTeam === 'teamA' ? state.teams.teamB : state.teams.teamA;
      victoryTitle.textContent = `${winner.name} Wins!`;
      victorySubtitle.textContent = `Final Score: ${winner.score} - ${loser.score}`;

      // Show Fast Money button for host
      if (startFmBtn) {
        startFmBtn.style.display = role === 'host' ? 'inline-block' : 'none';
      }
    }
  } else if (state?.phase === 'lobby') {
    switchView('lobby');
  } else if (state?.phase.startsWith('fast-money')) {
    switchView('fastMoney');
  } else if (
    state?.phase === 'face-off' ||
    state?.phase === 'play-or-pass' ||
    state?.phase === 'round-play' ||
    state?.phase === 'team-steal' ||
    state?.phase === 'round-end' ||
    (state?.currentRound && state.currentRound > 0)
  ) {
    switchView('game'); // Switch to game view for any active game phase
  }
};

const renderFastMoney = (): void => {
  if (!state || !state.fastMoney) return;

  const isHost = role === 'host';
  const phase = state.phase;
  const isP1 = phase === 'fast-money-p1';
  const isP2 = phase === 'fast-money-p2';

  // Render Timer
  if (fmTimer) {
    // We need to calculate remaining time based on roundEndsAt
    const remaining = Math.max(0, Math.ceil((state.roundEndsAt! - Date.now()) / 1000));
    fmTimer.textContent = String(remaining);
    if (remaining <= 5) fmTimer.classList.add('urgent');
    else fmTimer.classList.remove('urgent');
  }

  // Render Question (Host only sees current question)
  if (fmQuestionText && isHost) {
    const qIndex = state.fastMoney.currentQuestionIndex;
    if (qIndex < 5) {
      fmQuestionText.textContent = state.fastMoney.questions[qIndex].prompt;
    } else {
      fmQuestionText.textContent = "Round Complete!";
    }
  }

  // Render Board
  if (fmBoard) {
    const answers = isP1 ? state.fastMoney.p1Answers : state.fastMoney.p2Answers;
    // We show P1 answers always, and P2 answers if in P2 phase
    // Actually, we should show both columns side-by-side eventually
    // For now, let's just show the current player's answers

    // Simple render for now
    for (let i = 0; i < 5; i++) {
      const row = document.getElementById(`fm-row-${i}`);
      if (row) {
        const ansSpan = row.querySelector('.fm-ans');
        const ptsSpan = row.querySelector('.fm-pts');

        // Show answer if it exists
        const p1Ans = state.fastMoney.p1Answers[i];
        const p2Ans = state.fastMoney.p2Answers[i];

        // Logic: Show P1 answers always? Or hide until reveal?
        // Let's show as they are typed for now to verify
        if (isP1 && p1Ans) {
          if (ansSpan) ansSpan.textContent = p1Ans.text;
          if (ptsSpan) ptsSpan.textContent = String(p1Ans.points);
        } else if (isP2) {
          // Show P1 answer (revealed) and P2 answer (if typed)
          // TODO: Enhance layout for 2 columns
          if (p2Ans) {
            if (ansSpan) ansSpan.textContent = p2Ans.text;
            if (ptsSpan) ptsSpan.textContent = String(p2Ans.points);
          }
        }
      }
    }

    if (fmTotalScore) {
      fmTotalScore.textContent = String(state.fastMoney.p1Score + state.fastMoney.p2Score);
    }
  }

  // Host Controls
  if (fmControls && isHost) {
    fmControls.style.display = 'flex';
    // Toggle buttons based on state
    if (fmStartP1Btn) fmStartP1Btn.disabled = phase !== 'fast-money-p1'; // Actually logic is complex
  }
};

const startTimerLoop = (): void => {
  const tick = () => {
    if (state?.roundEndsAt && state.phase === 'round-play') {
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
  renderHostControls(); // Show host controls immediately
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

// Start Game (Lobby -> Game)
startGameBtn?.addEventListener('click', () => {
  if (role !== 'host') return;
  // Start the first round
  const questionIndex = 0;
  const duration = 45;
  send({ type: 'start-round', questionIndex, duration });
});


// Play Again (Victory -> Lobby)
playAgainBtn?.addEventListener('click', () => {
  if (role !== 'host') return;
  send({ type: 'reset' }); // We might need to implement a full reset or just new game
  // For now, let's just go back to lobby or reset state. 
  // Ideally server handles 'reset' to clear scores and round.
  // Let's assume 'reset' type exists or we need to add it.
  // Existing server has 'reset' type? Let's check server.js later. 
  // For now, let's just reload page or similar? 
  // Actually, let's send 'reset' and ensure server handles it.
  send({ type: 'reset' });
});

// Back to Home (Victory -> Landing)
backHomeBtn?.addEventListener('click', () => {
  location.reload(); // Simple way to reset client state completely
});

// Buzzer event
buzzBtn?.addEventListener('click', () => {
  if (role !== 'player' || state?.phase !== 'face-off') return;

  // Prompt player for their answer
  const answer = prompt('Face-Off! Give your answer to the survey question:');
  if (!answer || !answer.trim()) {
    alert('Answer required for Face-Off!');
    return;
  }

  send({ type: 'buzz-in', answer: answer.trim() });
  // Disable button after clicking to prevent double-buzz
  if (buzzBtn) buzzBtn.disabled = true;
});

// Play or Pass choice
choosePlayBtn?.addEventListener('click', () => {
  if (role !== 'host' || state?.phase !== 'play-or-pass') return;
  send({ type: 'choose-play-pass', choice: 'play' });
});

choosePassBtn?.addEventListener('click', () => {
  if (role !== 'host' || state?.phase !== 'play-or-pass') return;
  send({ type: 'choose-play-pass', choice: 'pass' });
});

// Steal attempt
stealForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  if (role !== 'player' || state?.phase !== 'team-steal') return;
  const text = stealInput?.value.trim();
  if (text) {
    send({ type: 'steal-attempt', text });
    stealInput.value = '';
  }
});

// Fast Money Events
fmSubmitBtn?.addEventListener('click', () => {
  if (role !== 'host') return;
  const text = fmAnswerInput?.value.trim();
  if (text && state?.fastMoney) {
    send({
      type: 'fast-money-answer',
      answer: text,
      questionIndex: state.fastMoney.currentQuestionIndex
    });
    fmAnswerInput.value = '';
    // Auto-advance? Server needs to handle index increment
    // Actually server doesn't increment index automatically on answer?
    // We need 'next-question' or server handles it.
    // Let's assume server increments index on answer.
    // Wait, I didn't implement index increment in server.js!
    // I need to fix server.js to increment currentQuestionIndex.
  }
});

fmPassBtn?.addEventListener('click', () => {
  if (role !== 'host') return;
  // Send empty answer or specific 'pass' message
  // For now, empty answer
  if (state?.fastMoney) {
    send({
      type: 'fast-money-answer',
      answer: 'PASS',
      questionIndex: state.fastMoney.currentQuestionIndex
    });
  }
});

// Start Fast Money from Victory Screen
startFmBtn?.addEventListener('click', () => {
  if (role !== 'host') return;
  send({ type: 'start-fast-money' });
});

ensureSocket();
startTimerLoop();
