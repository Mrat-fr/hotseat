<script>
  import { onMount, onDestroy } from 'svelte';
  import socket from '../lib/socket.js';
  import { players, phase, roundData, scoreboard, yesnoResults, yesnoReasons, debateState, spectrumState } from '../lib/store.js';
  import YesNo from './rounds/YesNo.svelte';
  import Debate from './rounds/Debate.svelte';
  import Spectrum from './rounds/Spectrum.svelte';

  let roomCode = '';
  let showQRModal = false;
  let joinUrl = '';

  onMount(() => {
    joinUrl = window.location.origin + '/#/play';
    socket.emit('join-host');

    socket.on('room-code', (code) => roomCode = code);
    socket.on('player-list', (list) => players.set(list));
    socket.on('phase', (p) => phase.set(p));
    socket.on('round-data', (data) => roundData.set(data));
    socket.on('scoreboard', (sb) => scoreboard.set(sb));
    socket.on('yesno-results', (r) => yesnoResults.set(r));
    socket.on('yesno-reason', (r) => yesnoReasons.update(arr => {
      return [...arr, { ...r, x: 5 + Math.random() * 70, y: 5 + Math.random() * 70, dur: 6 + Math.random() * 6, delay: Math.random() * 2 }];
    }));
    socket.on('yesno-reasons-reset', () => yesnoReasons.set([]));
    socket.on('debate-state', (s) => debateState.set(s));
    socket.on('debate-timer', (t) => {
      debateState.update(s => s ? { ...s, timeLeft: t } : s);
    });
    socket.on('spectrum-state', (s) => spectrumState.set(s));
    socket.on('spectrum-timer', (t) => {
      spectrumState.update(s => s ? { ...s, timeLeft: t } : s);
    });
  });

  onDestroy(() => {
    socket.off('room-code');
    socket.off('player-list');
    socket.off('phase');
    socket.off('round-data');
    socket.off('scoreboard');
    socket.off('yesno-results');
    socket.off('yesno-reason');
    socket.off('yesno-reasons-reset');
    socket.off('debate-state');
    socket.off('debate-timer');
    socket.off('spectrum-state');
    socket.off('spectrum-timer');
  });

  function startGame() { socket.emit('start-game'); }
  function startStage1() { socket.emit('start-stage1'); }
  function nextRound() { socket.emit('next-round'); }
  function showScoreboard() { socket.emit('show-scoreboard'); }
  function voteFor(name) { socket.emit('vote', { playerName: name }); }
  function startDebate() { socket.emit('debate-start'); }
  function startSpectrum() { socket.emit('spectrum-start'); }
  function skipToStage(stage) { socket.emit('skip-to-stage', { stage }); }
</script>

<div class="host">
  <!-- Skip to Stage 2 (fixed corner button, only during Stage 1 phases) -->
  {#if $phase === 'lobby' || $phase === 'title1' || $phase === 'question' || $phase === 'reveal' || $phase === 'scoreboard'}
    <button class="btn-skip-stage" on:click={() => skipToStage('debate')}>SKIP TO STAGE 2 →</button>
  {/if}
  {#if $phase === 'lobby' || $phase === 'title1' || $phase === 'question' || $phase === 'reveal' || $phase === 'scoreboard' || $phase === 'title2' || $phase === 'debate'}
    <button class="btn-skip-stage btn-skip-stage-3" on:click={() => skipToStage('spectrum')}>SKIP TO STAGE 3 →</button>
  {/if}

  <!-- QR icon button (visible during active game) -->
  {#if $phase !== 'lobby'}
    <button class="qr-fab" on:click={() => showQRModal = true} title="Show join QR">
      📱
    </button>
  {/if}

  <!-- QR Modal -->
  {#if showQRModal}
    <div class="modal-backdrop" on:click={() => showQRModal = false}>
      <div class="modal-box" on:click|stopPropagation>
        <button class="modal-close" on:click={() => showQRModal = false}>✕</button>
        <span class="join-label">JOIN THE GAME</span>
        <div class="code-display"><span class="code">{roomCode}</span></div>
        <img src="/api/qr" alt="QR Code" class="qr" />
        <a class="join-link" href={joinUrl} target="_blank">{joinUrl}</a>
      </div>
    </div>
  {/if}

  {#if $phase === 'lobby'}
    <div class="lobby">
      <!-- Left column: hero + join + players + start -->
      <div class="lobby-main">
        <div class="hero">
          <div class="fire-icon">🔥</div>
          <h1 class="logo">THE HOT SEAT</h1>
          <p class="tagline">SETTLE IT. RIGHT NOW.</p>
        </div>

        <div class="join-card">
          <div class="dotted-border">
            <span class="join-label">JOIN THE GAME</span>
            <div class="code-display">
              <span class="code">{roomCode}</span>
            </div>
            <img src="/api/qr" alt="QR Code" class="qr" />
            <a class="join-link" href={joinUrl} target="_blank">{joinUrl}</a>
          </div>
        </div>

        <div class="player-list">
          <h3 class="section-title">PLAYERS IN THE HOT SEAT ({$players.length})</h3>
          <div class="player-tags">
            {#each $players as name}
              <div class="player-tag">{name}</div>
            {/each}
          </div>
          {#if $players.length === 0}
            <p class="waiting">Waiting for brave souls to join...</p>
          {/if}
        </div>
        {#if $players.length >= 1}
          <button class="btn-start" on:click={startGame}>
            🔥 START THE HEAT 🔥
          </button>
        {/if}
      </div>

      <!-- Right column: rules pinned to the side -->
      <div class="lobby-side">
        <div class="rules-card">
          <div class="dotted-border rules">
            <span class="rules-label">HOUSE RULES</span>
            <ul class="rules-list">
              <li><strong>Keep it Fun:</strong> We're all here to have a good time. Play fair and be a good sport!</li>
              <li><strong>Watch Your Language:</strong> Please keep the chat clean. No swearing or offensive language.</li>
              <li><strong>Identity Matters:</strong> Choose a username that is respectful. Avoid anything suggestive, hateful, or inappropriate.</li>
              <li><strong>Respect Others:</strong> Treat your fellow players the way you'd want to be treated.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>

  {:else if $phase === 'title1'}
    <div class="title-screen">
      <div class="hero">
        <div class="fire-icon">🔥</div>
        <h1 class="logo">FANNING THE FLAMES</h1>
        <p class="tagline">STAGE 1</p>
      </div>
      <div class="title-description">
        <p>A series of hot-take YES or NO questions will appear on screen. Pick your side and defend your opinion!</p>
      </div>
      <button class="btn-start" on:click={startStage1}>
        🔥 START 🔥
      </button>
    </div>

  {:else if $phase === 'question'}
    <div class="round-display">
      {#if $roundData?.type === 'yesno'}
        <YesNo data={$roundData} results={$yesnoResults} reasons={$yesnoReasons} />
      {/if}
      <button class="btn-skip" on:click={nextRound}>SKIP QUESTION →</button>
    </div>

  {:else if $phase === 'reveal'}
    <div class="reveal-screen">
      {#if $roundData?.type === 'yesno'}
        <YesNo data={$roundData} results={$yesnoResults} reasons={$yesnoReasons} />
      {/if}
      <button class="btn-action" on:click={nextRound}>NEXT QUESTION →</button>
    </div>

  {:else if $phase === 'scoreboard'}
    <div class="scoreboard-screen">
      <div class="hero-sm">
        <div class="fire-icon sm">🔥</div>
        <h2 class="logo sm">SCOREBOARD</h2>
      </div>
      <div class="scores">
        {#each $scoreboard as entry, i}
          <div class="score-row" class:first={i === 0} class:second={i === 1} class:third={i === 2}>
            <span class="rank">
              {#if i === 0}👑{:else if i === 1}🥈{:else if i === 2}🥉{:else}#{i + 1}{/if}
            </span>
            <span class="name">{entry.name}</span>
            <span class="pts">{entry.score} PTS</span>
          </div>
        {/each}
      </div>
      <button class="btn-action" on:click={nextRound}>NEXT ROUND →</button>
    </div>

  {:else if $phase === 'debate'}
    <div class="round-display">
      <Debate state={$debateState} />
    </div>

  {:else if $phase === 'title2'}
    <div class="title-screen">
      <div class="hero">
        <div class="fire-icon">🎤</div>
        <h1 class="logo">THE HOT MIC DUEL</h1>
        <p class="tagline">STAGE 2</p>
      </div>
      <div class="title-description">
        <p>Two players go head-to-head in a live debate! The audience votes with thumbs-up to crown the winner.</p>
      </div>
      <button class="btn-start" on:click={startDebate}>
        🎤 START 🎤
      </button>
    </div>

  {:else if $phase === 'title3'}
    <div class="title-screen">
      <div class="hero">
        <div class="fire-icon">🎯</div>
        <h1 class="logo">THE SPECTRUM</h1>
        <p class="tagline">STAGE 3</p>
      </div>
      <div class="title-description">
        <p>Everyone picks a statement and rates it. Guess where the Speaker placed their slider — the closer you are, the more points you earn!</p>
      </div>
      <button class="btn-start" on:click={startSpectrum}>
        🎯 START 🎯
      </button>
    </div>

  {:else if $phase === 'spectrum'}
    <div class="round-display">
      <Spectrum state={$spectrumState} />
    </div>

  {:else if $phase === 'gameover'}
    <div class="scoreboard-screen">
      <div class="hero">
        <div class="fire-icon">🏆</div>
        <h1 class="logo">GAME OVER</h1>
      </div>
      {#if $scoreboard.length > 0}
        <div class="winner-card">
          <div class="dotted-border winner">
            <span class="winner-label">👑 WINNER 👑</span>
            <div class="winner-name">{$scoreboard[0].name}</div>
            <div class="winner-score">{$scoreboard[0].score} PTS</div>
          </div>
        </div>
      {/if}
      <div class="scores final">
        {#each $scoreboard as entry, i}
          <div class="score-row" class:first={i === 0} class:second={i === 1} class:third={i === 2}>
            <span class="rank">
              {#if i === 0}👑{:else if i === 1}🥈{:else if i === 2}🥉{:else}#{i + 1}{/if}
            </span>
            <span class="name">{entry.name}{#if entry.disconnected} <span class="disconnected-tag">offline</span>{/if}</span>
            <span class="pts">{entry.score} PTS</span>
          </div>
        {/each}
      </div>
      <p class="total-pts-note">Total points earned across all stages</p>
    </div>
  {/if}
</div>

<style>
  .host {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }
  .round-display, .reveal-screen, .scoreboard-screen, .gameover-screen, .title-screen {
    text-align: center;
    width: 100%;
    max-width: 700px;
  }

  /* ── Lobby two-column layout ── */
  .lobby {
    display: flex;
    align-items: flex-start;
    gap: 2rem;
    width: 100%;
    max-width: 1100px;
  }
  .lobby-main {
    flex: 1;
    text-align: center;
    min-width: 0;
  }
  .lobby-side {
    width: 280px;
    flex-shrink: 0;
    position: sticky;
    top: 1rem;
  }

  /* ── Hero / Logo ── */
  .hero, .hero-sm {
    margin-bottom: 1rem;
  }
  .fire-icon {
    font-size: 3rem;
    filter: drop-shadow(0 0 12px rgba(232, 93, 38, 0.6));
    animation: flicker 1.5s ease-in-out infinite alternate;
  }
  .fire-icon.sm { font-size: 2.5rem; }
  .logo {
    font-family: var(--font-hero);
    font-size: 4rem;
    color: var(--accent-yellow);
    text-shadow:
      3px 3px 0 var(--charcoal),
      -1px -1px 0 var(--charcoal),
      1px -1px 0 var(--charcoal),
      -1px 1px 0 var(--charcoal),
      0 6px 0 var(--bg-deep);
    letter-spacing: 0.05em;
    line-height: 1;
  }
  .logo.sm { font-size: 3rem; }
  .tagline {
    font-family: var(--font-body);
    font-weight: 700;
    font-size: 1.1rem;
    letter-spacing: 0.3em;
    color: var(--cream-dim);
    margin-top: 0.5rem;
    text-transform: uppercase;
  }

  /* ── Join Card ── */
  .join-card {
    margin: 1rem auto;
    max-width: 300px;
  }
  .dotted-border {
    border: 3px dashed var(--accent-yellow);
    border-radius: 16px;
    padding: 1rem;
    background: rgba(0, 0, 0, 0.25);
    position: relative;
  }
  .join-label {
    font-family: var(--font-hero);
    font-size: 1.4rem;
    color: var(--accent-orange);
    letter-spacing: 0.1em;
    display: block;
    margin-bottom: 0.5rem;
  }
  .code-display { margin: 0.25rem 0; }
  .code {
    font-family: var(--font-hero);
    font-size: 3.5rem;
    font-weight: 900;
    letter-spacing: 0.25em;
    color: var(--accent-yellow);
    text-shadow: 3px 3px 0 var(--charcoal);
  }
  .qr {
    width: 220px;
    height: 220px;
    margin: 0.75rem auto 0;
    display: block;
    background: var(--cream);
    padding: 10px;
    border-radius: 10px;
    border: 3px solid var(--charcoal);
  }
  .modal-box .qr {
    width: 280px;
    height: 280px;
  }

  /* ── Players ── */
  .player-list { margin: 1rem 0; }
  .section-title {
    font-family: var(--font-hero);
    font-size: 1.5rem;
    color: var(--accent-orange);
    letter-spacing: 0.08em;
    margin-bottom: 1rem;
  }
  .player-tags {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.5rem;
  }
  .player-tag {
    display: inline-block;
    background: var(--charcoal);
    color: var(--cream);
    padding: 0.5rem 1.2rem;
    border-radius: 6px;
    font-family: var(--font-body);
    font-weight: 700;
    font-size: 1rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border: 2px solid var(--accent-yellow);
    animation: pop 0.3s ease-out;
  }
  .waiting {
    color: var(--cream-dim);
    font-style: italic;
    font-family: var(--font-comic);
    font-size: 1.1rem;
  }

  /* ── Buttons ── */
  .btn-start {
    background: var(--accent-orange);
    color: var(--cream);
    border: 3px solid var(--charcoal);
    padding: 1rem 3rem;
    border-radius: 8px;
    font-family: var(--font-hero);
    font-size: 1.8rem;
    letter-spacing: 0.05em;
    cursor: pointer;
    margin-top: 1.5rem;
    text-shadow: 2px 2px 0 var(--charcoal);
    box-shadow: 4px 4px 0 var(--charcoal);
    transition: transform 0.1s, box-shadow 0.1s;
  }
  .btn-start:hover {
    transform: translate(-2px, -2px);
    box-shadow: 6px 6px 0 var(--charcoal);
  }
  .btn-start:active {
    transform: translate(2px, 2px);
    box-shadow: 2px 2px 0 var(--charcoal);
  }
  .btn-action {
    background: var(--accent-yellow);
    color: var(--charcoal);
    border: 3px solid var(--charcoal);
    padding: 0.8rem 2.5rem;
    border-radius: 8px;
    font-family: var(--font-hero);
    font-size: 1.4rem;
    letter-spacing: 0.05em;
    cursor: pointer;
    margin-top: 2rem;
    box-shadow: 4px 4px 0 var(--charcoal);
    transition: transform 0.1s, box-shadow 0.1s;
  }
  .btn-action:hover {
    transform: translate(-2px, -2px);
    box-shadow: 6px 6px 0 var(--charcoal);
  }
  .btn-action:active {
    transform: translate(2px, 2px);
    box-shadow: 2px 2px 0 var(--charcoal);
  }
  .btn-skip {
    background: transparent;
    color: var(--cream-dim);
    border: 2px solid var(--cream-dim);
    padding: 0.5rem 1.5rem;
    border-radius: 8px;
    font-family: var(--font-hero);
    font-size: 1rem;
    letter-spacing: 0.05em;
    cursor: pointer;
    margin-top: 1.5rem;
    box-shadow: 2px 2px 0 rgba(0,0,0,0.3);
    transition: transform 0.1s, box-shadow 0.1s, color 0.15s, border-color 0.15s;
  }
  .btn-skip:hover {
    color: var(--cream);
    border-color: var(--cream);
    transform: translate(-1px, -1px);
    box-shadow: 3px 3px 0 rgba(0,0,0,0.3);
  }
  .btn-skip:active {
    transform: translate(2px, 2px);
    box-shadow: 0 0 0 rgba(0,0,0,0.3);
  }
  .btn-skip-stage {
    position: fixed;
    bottom: 1rem;
    right: 1rem;
    background: rgba(0, 0, 0, 0.5);
    color: var(--cream-dim);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 6px;
    padding: 0.4rem 0.8rem;
    font-family: var(--font-body);
    font-size: 0.7rem;
    letter-spacing: 0.03em;
    cursor: pointer;
    opacity: 0.35;
    transition: opacity 0.15s, background 0.15s;
    z-index: 50;
    white-space: nowrap;
  }
  .btn-skip-stage-3 {
    bottom: 2.8rem;
  }
  .btn-skip-stage:hover {
    opacity: 1;
    background: rgba(0, 0, 0, 0.8);
    color: var(--cream);
    border-color: var(--cream-dim);
  }

  /* ── Scoreboard ── */
  .scores { margin: 1.5rem 0; }
  .scores.final { margin-top: 2rem; }
  .score-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.8rem 1.2rem;
    background: rgba(0, 0, 0, 0.3);
    border: 2px solid var(--charcoal);
    border-radius: 8px;
    margin: 0.5rem 0;
    font-family: var(--font-body);
    font-size: 1.1rem;
    font-weight: 600;
    text-transform: uppercase;
  }
  .score-row.first {
    background: var(--accent-yellow);
    color: var(--charcoal);
    border-color: var(--charcoal);
    font-weight: 900;
    font-size: 1.3rem;
    box-shadow: 4px 4px 0 var(--charcoal);
  }
  .score-row.second { background: rgba(242, 183, 5, 0.15); border-color: var(--accent-yellow); }
  .score-row.third { background: rgba(232, 93, 38, 0.15); border-color: var(--accent-orange); }
  .rank { min-width: 2.5rem; text-align: left; }
  .name { flex: 1; text-align: left; margin-left: 0.5rem; }
  .pts { font-family: var(--font-hero); font-size: 1.3rem; letter-spacing: 0.05em; }
  .score-row.first .pts { color: var(--charcoal); }

  /* ── Winner Card ── */
  .winner-card {
    margin: 2rem auto;
    max-width: 360px;
  }
  .dotted-border.winner {
    border-color: var(--accent-yellow);
    background: rgba(242, 183, 5, 0.1);
    text-align: center;
  }
  .winner-label {
    font-family: var(--font-hero);
    font-size: 1.3rem;
    color: var(--accent-orange);
    letter-spacing: 0.2em;
  }
  .winner-name {
    font-family: var(--font-hero);
    font-size: 3.5rem;
    color: var(--accent-yellow);
    text-shadow: 3px 3px 0 var(--charcoal);
    line-height: 1.1;
    margin: 0.5rem 0;
  }
  .winner-score {
    font-family: var(--font-hero);
    font-size: 2rem;
    color: var(--cream);
  }

  /* ── QR FAB ── */
  .qr-fab {
    position: fixed;
    top: 1rem;
    left: 1rem;
    width: 3rem;
    height: 3rem;
    border-radius: 50%;
    background: var(--charcoal);
    border: 3px solid var(--accent-yellow);
    font-size: 1.4rem;
    cursor: pointer;
    box-shadow: 3px 3px 0 var(--accent-yellow);
    transition: transform 0.1s, box-shadow 0.1s;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .qr-fab:hover {
    transform: translate(-1px, -1px);
    box-shadow: 4px 4px 0 var(--accent-yellow);
  }
  .qr-fab:active {
    transform: translate(2px, 2px);
    box-shadow: 1px 1px 0 var(--accent-yellow);
  }

  /* ── Modal ── */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
  }
  .modal-box {
    background: var(--bg-primary);
    border: 3px dashed var(--accent-yellow);
    border-radius: 16px;
    padding: 2rem 2.5rem;
    text-align: center;
    position: relative;
    max-width: 380px;
    width: 90%;
  }
  .modal-close {
    position: absolute;
    top: 0.6rem;
    right: 0.8rem;
    background: none;
    border: none;
    color: var(--cream-dim);
    font-size: 1.2rem;
    cursor: pointer;
    line-height: 1;
  }
  .modal-close:hover { color: var(--cream); }

  /* ── Join link ── */
  .join-link {
    display: block;
    margin-top: 0.75rem;
    color: var(--cream-dim);
    font-family: var(--font-body);
    font-size: 0.75rem;
    word-break: break-all;
    text-decoration: underline;
    opacity: 0.7;
  }
  .join-link:hover { opacity: 1; color: var(--cream); }

  /* ── Rules Card ── */
  .rules-card {
    margin-top: 0;
    width: 100%;
  }
  .dotted-border.rules {
    border-color: var(--accent-orange);
    background: rgba(0, 0, 0, 0.2);
    text-align: left;
  }
  .rules-label {
    font-family: var(--font-hero);
    font-size: 1.3rem;
    color: var(--accent-orange);
    letter-spacing: 0.1em;
    display: block;
    text-align: center;
    margin-bottom: 0.75rem;
  }
  .rules-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .rules-list li {
    font-family: var(--font-comic);
    font-size: 0.9rem;
    color: var(--cream);
    line-height: 1.4;
  }
  .rules-list li strong {
    color: var(--accent-yellow);
  }

  /* ── Title Screen ── */
  .title-description {
    margin: 1.5rem auto;
    max-width: 500px;
  }
  .title-description p {
    font-family: var(--font-comic);
    font-size: 1.3rem;
    color: var(--cream);
    line-height: 1.5;
  }

  /* ── Game Over Extras ── */
  .total-pts-note {
    font-family: var(--font-comic);
    font-size: 0.9rem;
    color: var(--cream-dim);
    opacity: 0.6;
    margin-top: 0.5rem;
    font-style: italic;
  }
  .disconnected-tag {
    font-family: var(--font-body);
    font-size: 0.65rem;
    color: var(--cream-dim);
    background: rgba(255,255,255,0.1);
    border-radius: 4px;
    padding: 0.1rem 0.4rem;
    margin-left: 0.3rem;
    letter-spacing: 0.05em;
    vertical-align: middle;
    opacity: 0.6;
  }

  /* ── Animations ── */
  @keyframes pop {
    from { transform: scale(0.7); opacity: 0; }
    to   { transform: scale(1);   opacity: 1; }
  }
  @keyframes flicker {
    0% { transform: scale(1) rotate(-2deg); }
    50% { transform: scale(1.05) rotate(1deg); }
    100% { transform: scale(1) rotate(-1deg); }
  }
</style>
