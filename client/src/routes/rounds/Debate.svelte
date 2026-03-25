<script>
  import { onMount, onDestroy } from 'svelte';
  import socket from '../../lib/socket.js';

  export let state;

  // All 25 topic titles for the grid
  const topicTitles = [
    'The Cereal Sequence', 'Daily Dilemmas', 'Animal Showdowns', 'The White Lie',
    'Privacy vs. Safety', 'Space Colonization', 'The Simulation', 'The Superpower',
    'The Truth Serum', 'Digital Life', 'The Remote Reality', 'The Gift of Time',
    'The Dog vs. Cat', 'The Zoo Debate', 'The Silicon Brain', 'The Urban Escape',
    'The Breakfast Battle', 'The Social Scroll', 'The Homework Debate', 'The Money Question',
    'The Alien Contact', 'The Sleep Schedule', 'The Fashion Statement', 'The Music War',
    'The Food Fight',
  ];

  // Floating thumbs-up animations
  let thumbAnims = [];
  let animId = 0;

  onMount(() => {
    socket.on('debate-thumbsup-anim', ({ side }) => {
      const id = animId++;
      const xDrift = -30 + Math.random() * 60; // random horizontal drift
      thumbAnims = [...thumbAnims, { id, side, xDrift }];
      // Auto-remove after animation (1.5s)
      setTimeout(() => {
        thumbAnims = thumbAnims.filter(a => a.id !== id);
      }, 1600);
    });
  });

  onDestroy(() => {
    socket.off('debate-thumbsup-anim');
  });

  function startMatch() {
    socket.emit('debate-start-match');
  }
  function showGrid() {
    socket.emit('debate-show-grid');
  }
  function pickTopic(index) {
    socket.emit('debate-pick-topic', { index });
  }
  function beginDuel() {
    socket.emit('debate-begin-duel');
  }
  function finishDuel() {
    socket.emit('debate-finish');
  }
  function newPlayers() {
    socket.emit('debate-new-players');
  }
  function newTopic() {
    socket.emit('debate-new-topic');
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
</script>

<div class="debate">
  {#if !state || state.phase === 'lobby'}
    <!-- OPT-IN LOBBY (happens first, before topic) -->
    <div class="lobby-view">
      <div class="hero-sm">
        <h2 class="stage-title">STAGE 2</h2>
        <h1 class="logo">DEBATE DUEL</h1>
        <p class="tagline">WHO WANTS TO DEBATE?</p>
      </div>

      <div class="opt-in-section">
        <h3 class="section-title">PLAYERS READY TO DEBATE ({state?.optedIn?.length || 0})</h3>
        <div class="opt-in-tags">
          {#each state?.optedIn || [] as name}
            <div class="opt-tag">{name}</div>
          {/each}
        </div>
        {#if (state?.optedIn?.length || 0) === 0}
          <p class="waiting">Waiting for brave souls to opt in...</p>
        {:else if (state?.optedIn?.length || 0) === 1}
          <p class="waiting">Waiting for a Challenger...</p>
        {/if}
      </div>

      <div class="lobby-actions">
        {#if (state?.optedIn?.length || 0) >= 2}
          <button class="btn-action fire" on:click={startMatch}>START MATCH</button>
        {/if}
      </div>
    </div>

  {:else if state.phase === 'match'}
    <!-- PLAYERS PICKED — no topic yet -->
    <div class="match-view">
      <h2 class="match-header">THE MATCHUP</h2>
      <div class="matchup simple">
        <div class="debater pro-debater">
          <span class="debater-side">PRO</span>
          <span class="debater-name">{state.player1?.name}</span>
        </div>
        <div class="match-vs">VS</div>
        <div class="debater con-debater">
          <span class="debater-side">CON</span>
          <span class="debater-name">{state.player2?.name}</span>
        </div>
      </div>
      <p class="match-prompt">Ask them — what topic do you want?</p>
      <button class="btn-action fire" on:click={showGrid}>PICK A TOPIC</button>
    </div>

  {:else if state.phase === 'grid'}
    <!-- 5x5 GRID (players already picked) -->
    <div class="hero-sm">
      <h2 class="stage-title">{state.player1?.name} vs {state.player2?.name}</h2>
      <h1 class="logo">PICK A TOPIC</h1>
    </div>
    <div class="grid">
      {#each topicTitles as title, i}
        <button
          class="tile"
          class:flipped={state?.flipped?.includes(i)}
          disabled={state?.flipped?.includes(i)}
          on:click={() => pickTopic(i)}
        >
          {#if state?.flipped?.includes(i)}
            <span class="tile-flipped">FLIPPED</span>
          {:else}
            <span class="tile-title">{title}</span>
          {/if}
        </button>
      {/each}
    </div>

  {:else if state.phase === 'armed'}
    <!-- TOPIC ASSIGNED — full matchup with stances -->
    <div class="match-view">
      <h2 class="match-header">THE MATCHUP</h2>
      <div class="topic-badge">{state.currentTopic?.title}</div>
      <div class="matchup">
        <div class="debater pro-debater">
          <span class="debater-side">PRO</span>
          <span class="debater-name">{state.player1?.name}</span>
          <p class="debater-stance">"{state.player1?.stance}"</p>
        </div>
        <div class="match-vs">VS</div>
        <div class="debater con-debater">
          <span class="debater-side">CON</span>
          <span class="debater-name">{state.player2?.name}</span>
          <p class="debater-stance">"{state.player2?.stance}"</p>
        </div>
      </div>
      <button class="btn-action fire" on:click={beginDuel}>BEGIN DUEL</button>
    </div>

  {:else if state.phase === 'duel'}
    <!-- 3-MINUTE DUEL WITH LIVE THUMBS-UP -->
    <div class="duel-view">
      <div class="topic-badge">{state.currentTopic?.title}</div>
      <div class="timer" class:timer-danger={state.timeLeft <= 30}>
        <span class="timer-digits">{formatTime(state.timeLeft)}</span>
      </div>
      <div class="duel-matchup">
        <div class="duel-side pro-side">
          <span class="duel-label">PRO</span>
          <span class="duel-name">{state.player1?.name}</span>
          <p class="duel-stance">"{state.player1?.stance}"</p>
          <!-- Floating thumbs on PRO side -->
          {#each thumbAnims.filter(a => a.side === 'player1') as anim (anim.id)}
            <div class="thumb-float" style="--drift:{anim.xDrift}px">👍</div>
          {/each}
        </div>
        <div class="duel-divider"><span class="duel-vs">VS</span></div>
        <div class="duel-side con-side">
          <span class="duel-label">CON</span>
          <span class="duel-name">{state.player2?.name}</span>
          <p class="duel-stance">"{state.player2?.stance}"</p>
          <!-- Floating thumbs on CON side -->
          {#each thumbAnims.filter(a => a.side === 'player2') as anim (anim.id)}
            <div class="thumb-float" style="--drift:{anim.xDrift}px">👍</div>
          {/each}
        </div>
      </div>
      <button class="btn-action fire finish-btn" on:click={finishDuel}>FINISH</button>
    </div>

  {:else if state.phase === 'result'}
    <!-- RESULTS -->
    <div class="result-view">
      <h2 class="result-header">
        {#if state.winner === 'TIE'}
          IT'S A TIE!
        {:else}
          {state.winner} WINS!
        {/if}
      </h2>
      <div class="topic-badge">{state.currentTopic?.title}</div>
      <div class="result-scores">
        <div class="result-card" class:winner-card={state.winner === state.player1?.name}>
          <span class="result-side">PRO</span>
          <span class="result-name">{state.player1?.name}</span>
          <span class="result-thumbs">👍 {state.thumbsUp?.player1 || 0}</span>
          {#if state.winner === state.player1?.name}<span class="trophy">+1000 PTS</span>{/if}
        </div>
        <div class="result-card" class:winner-card={state.winner === state.player2?.name}>
          <span class="result-side">CON</span>
          <span class="result-name">{state.player2?.name}</span>
          <span class="result-thumbs">👍 {state.thumbsUp?.player2 || 0}</span>
          {#if state.winner === state.player2?.name}<span class="trophy">+1000 PTS</span>{/if}
        </div>
      </div>
      <div class="result-actions">
        <button class="btn-action fire" on:click={newPlayers}>NEW PLAYERS</button>
        <button class="btn-action" on:click={newTopic}>NEW TOPIC (SAME PLAYERS)</button>
      </div>
    </div>
  {/if}
</div>

<style>
  .debate {
    text-align: center;
    width: 100%;
    max-width: 800px;
    margin: 0 auto;
  }

  /* ── Stage header ── */
  .hero-sm { margin-bottom: 1.5rem; }
  .stage-title {
    font-family: var(--font-hero);
    font-size: 1.2rem;
    color: var(--accent-orange);
    letter-spacing: 0.3em;
    margin-bottom: 0;
  }
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
    margin: 0;
  }
  .tagline {
    font-family: var(--font-body);
    font-weight: 700;
    font-size: 1rem;
    letter-spacing: 0.3em;
    color: var(--cream-dim);
    margin-top: 0.5rem;
    text-transform: uppercase;
  }

  /* ── 5x5 Grid ── */
  .grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 0.6rem;
    margin: 1.5rem 0;
  }
  .tile {
    aspect-ratio: 1;
    border: 3px solid var(--charcoal);
    border-radius: 10px;
    background: linear-gradient(135deg, rgba(242, 183, 5, 0.15), rgba(232, 93, 38, 0.15));
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.5rem;
    transition: transform 0.15s, box-shadow 0.15s, background 0.15s;
    box-shadow: 3px 3px 0 var(--charcoal);
  }
  .tile:hover:not(.flipped) {
    transform: translate(-2px, -2px);
    box-shadow: 5px 5px 0 var(--charcoal);
    background: linear-gradient(135deg, rgba(242, 183, 5, 0.3), rgba(232, 93, 38, 0.3));
  }
  .tile:active:not(.flipped) {
    transform: translate(2px, 2px);
    box-shadow: 1px 1px 0 var(--charcoal);
  }
  .tile.flipped {
    background: rgba(0, 0, 0, 0.4);
    border-color: rgba(50, 50, 50, 0.5);
    cursor: not-allowed;
    box-shadow: none;
  }
  .tile-title {
    font-family: var(--font-hero);
    font-size: 1.05rem;
    color: var(--cream);
    letter-spacing: 0.03em;
    line-height: 1.15;
    text-transform: uppercase;
  }
  .tile-flipped {
    font-family: var(--font-hero);
    font-size: 0.8rem;
    color: var(--cream-dim);
    opacity: 0.4;
    letter-spacing: 0.1em;
  }

  /* ── Topic badge ── */
  .topic-badge {
    background: var(--charcoal);
    border: 2px solid var(--accent-yellow);
    display: inline-block;
    padding: 0.35rem 1.2rem;
    border-radius: 6px;
    font-family: var(--font-hero);
    font-size: 1.1rem;
    letter-spacing: 0.1em;
    color: var(--accent-yellow);
    margin-bottom: 1.5rem;
  }

  /* ── Lobby / Opt-in ── */
  .lobby-view { padding: 1rem 0; }
  .opt-in-section { margin: 1.5rem 0; }
  .section-title {
    font-family: var(--font-hero);
    font-size: 1.3rem;
    color: var(--accent-orange);
    letter-spacing: 0.08em;
    margin-bottom: 1rem;
  }
  .opt-in-tags {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.5rem;
  }
  .opt-tag {
    display: inline-block;
    background: var(--charcoal);
    color: var(--cream);
    padding: 0.4rem 1rem;
    border-radius: 6px;
    font-family: var(--font-body);
    font-weight: 700;
    font-size: 0.9rem;
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
    margin-top: 0.5rem;
  }
  .lobby-actions {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    margin-top: 1.5rem;
  }

  /* ── Matchup ── */
  .match-view { padding: 1rem 0; }
  .match-header {
    font-family: var(--font-hero);
    font-size: 2.5rem;
    color: var(--accent-yellow);
    text-shadow: 2px 2px 0 var(--charcoal);
    margin-bottom: 1rem;
    animation: pop 0.4s ease-out;
  }
  .matchup {
    display: flex;
    align-items: stretch;
    gap: 0;
    border-radius: 12px;
    overflow: hidden;
    border: 3px solid var(--charcoal);
    box-shadow: 6px 6px 0 var(--charcoal);
    margin-bottom: 2rem;
  }
  .debater {
    flex: 1;
    padding: 1.5rem 1rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }
  .pro-debater { background: rgba(45, 147, 108, 0.25); }
  .con-debater { background: rgba(214, 64, 69, 0.25); }
  .debater-side {
    font-family: var(--font-hero);
    font-size: 1.2rem;
    letter-spacing: 0.15em;
  }
  .pro-debater .debater-side { color: var(--yes-green); }
  .con-debater .debater-side { color: var(--no-red); }
  .debater-name {
    font-family: var(--font-hero);
    font-size: 2rem;
    color: var(--cream);
    text-shadow: 2px 2px 0 var(--charcoal);
    text-transform: uppercase;
  }
  .debater-stance {
    font-family: var(--font-comic);
    font-size: 1.05rem;
    color: var(--cream);
    line-height: 1.3;
    font-style: italic;
    margin: 0;
  }
  .match-vs {
    background: var(--charcoal);
    color: var(--accent-yellow);
    font-family: var(--font-hero);
    font-size: 1.4rem;
    display: flex;
    align-items: center;
    padding: 0 0.8rem;
    flex-shrink: 0;
  }
  .match-prompt {
    font-family: var(--font-comic);
    font-size: 1.2rem;
    color: var(--cream-dim);
    font-style: italic;
    margin-bottom: 1rem;
  }

  /* ── Duel / Timer ── */
  .duel-view { padding: 1rem 0; }
  .timer {
    margin: 1rem auto;
    width: 180px;
    height: 180px;
    border-radius: 50%;
    border: 6px solid var(--accent-yellow);
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.4);
    box-shadow: 0 0 40px rgba(242, 183, 5, 0.2);
    transition: border-color 0.3s, box-shadow 0.3s;
  }
  .timer.timer-danger {
    border-color: var(--no-red);
    box-shadow: 0 0 40px rgba(214, 64, 69, 0.4);
    animation: pulse-timer 0.8s ease-in-out infinite;
  }
  .timer-digits {
    font-family: var(--font-hero);
    font-size: 3.5rem;
    color: var(--cream);
    text-shadow: 2px 2px 0 var(--charcoal);
    letter-spacing: 0.05em;
  }
  .timer.timer-danger .timer-digits { color: var(--no-red); }

  .duel-matchup {
    display: flex;
    align-items: stretch;
    gap: 0;
    border-radius: 12px;
    overflow: hidden;
    border: 3px solid var(--charcoal);
    box-shadow: 4px 4px 0 var(--charcoal);
    margin-top: 1rem;
    position: relative;
  }
  .duel-side {
    flex: 1;
    padding: 1.2rem 0.8rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.3rem;
    position: relative;
    overflow: hidden;
    min-height: 180px;
  }
  .pro-side { background: rgba(45, 147, 108, 0.2); }
  .con-side { background: rgba(214, 64, 69, 0.2); }
  .duel-label {
    font-family: var(--font-hero);
    font-size: 1.2rem;
    letter-spacing: 0.15em;
  }
  .pro-side .duel-label { color: var(--yes-green); }
  .con-side .duel-label { color: var(--no-red); }
  .duel-name {
    font-family: var(--font-hero);
    font-size: 1.8rem;
    color: var(--cream);
    text-shadow: 1px 1px 0 var(--charcoal);
    text-transform: uppercase;
  }
  .duel-stance {
    font-family: var(--font-comic);
    font-size: 1.05rem;
    color: var(--cream);
    line-height: 1.3;
    margin: 0;
  }
  .duel-divider {
    width: 4px;
    background: var(--charcoal);
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    flex-shrink: 0;
  }
  .duel-vs {
    position: absolute;
    background: var(--charcoal);
    color: var(--accent-yellow);
    font-family: var(--font-hero);
    font-size: 1rem;
    padding: 0.3rem 0.5rem;
    border-radius: 6px;
    border: 2px solid var(--accent-yellow);
    z-index: 2;
  }

  /* ── Floating Thumbs-Up Animations ── */
  .thumb-float {
    position: absolute;
    bottom: 0;
    left: 50%;
    font-size: 2.2rem;
    pointer-events: none;
    animation: thumb-rise 1.5s ease-out forwards;
    z-index: 10;
    filter: drop-shadow(0 0 4px rgba(0,0,0,0.4));
  }

  @keyframes thumb-rise {
    0% {
      opacity: 1;
      transform: translate(calc(-50% + var(--drift, 0px)), 0) scale(1);
    }
    100% {
      opacity: 0;
      transform: translate(calc(-50% + var(--drift, 0px)), -160px) scale(0.6);
    }
  }

  /* ── Results ── */
  .result-view { padding: 1rem 0; }
  .result-header {
    font-family: var(--font-hero);
    font-size: 2.8rem;
    color: var(--accent-yellow);
    text-shadow: 3px 3px 0 var(--charcoal);
    margin-bottom: 1rem;
    animation: pop 0.5s ease-out;
  }
  .result-scores {
    display: flex;
    gap: 1rem;
    justify-content: center;
    margin-bottom: 2rem;
  }
  .result-card {
    flex: 1;
    max-width: 220px;
    padding: 1.5rem 1rem;
    border-radius: 12px;
    border: 3px solid var(--charcoal);
    background: rgba(0, 0, 0, 0.3);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
    transition: all 0.3s;
  }
  .result-card.winner-card {
    border-color: var(--accent-yellow);
    background: rgba(242, 183, 5, 0.15);
    box-shadow: 0 0 20px rgba(242, 183, 5, 0.2);
    transform: scale(1.05);
  }
  .result-side {
    font-family: var(--font-hero);
    font-size: 0.9rem;
    color: var(--cream-dim);
    letter-spacing: 0.15em;
  }
  .result-name {
    font-family: var(--font-hero);
    font-size: 1.6rem;
    color: var(--cream);
    text-shadow: 1px 1px 0 var(--charcoal);
    text-transform: uppercase;
  }
  .result-thumbs {
    font-family: var(--font-hero);
    font-size: 1.8rem;
    color: var(--accent-orange);
  }
  .trophy {
    font-family: var(--font-hero);
    font-size: 1.1rem;
    color: var(--accent-yellow);
    letter-spacing: 0.05em;
    animation: pop 0.6s ease-out;
  }
  .result-actions {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
  }

  /* ── Shared buttons ── */
  .btn-action {
    background: var(--accent-yellow);
    color: var(--charcoal);
    border: 3px solid var(--charcoal);
    padding: 0.8rem 2.5rem;
    border-radius: 8px;
    font-family: var(--font-hero);
    font-size: 1.3rem;
    letter-spacing: 0.05em;
    cursor: pointer;
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
  .btn-action.fire {
    background: var(--accent-orange);
    color: var(--cream);
    text-shadow: 1px 1px 0 var(--charcoal);
  }
  .btn-action.secondary {
    background: transparent;
    color: var(--cream-dim);
    border-color: var(--cream-dim);
    box-shadow: 2px 2px 0 rgba(0,0,0,0.3);
    font-size: 1rem;
    padding: 0.5rem 1.5rem;
    margin-top: 1rem;
  }
  .btn-action.secondary:hover {
    color: var(--cream);
    border-color: var(--cream);
  }
  .finish-btn {
    margin-top: 1.5rem;
  }

  /* ── Animations ── */
  @keyframes pop {
    from { transform: scale(0.7); opacity: 0; }
    to   { transform: scale(1);   opacity: 1; }
  }
  @keyframes pulse-timer {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.05); }
  }
</style>
