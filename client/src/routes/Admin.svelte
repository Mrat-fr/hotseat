<script>
  import { onMount, onDestroy } from 'svelte';
  import socket from '../lib/socket.js';
  import { querystring } from 'svelte-spa-router';

  let connected = false;
  let error = '';
  let adminState = null;

  // Parse the key from ?key=...
  let adminKey = '';

  onMount(() => {
    // Extract key from query string
    const params = new URLSearchParams($querystring);
    adminKey = params.get('key') || '';

    if (!adminKey) {
      error = 'No admin key provided';
      return;
    }

    // Try to reconnect with saved session
    const savedSession = localStorage.getItem('hotseat-admin-session');

    socket.emit('join-admin', { key: adminKey, sessionId: savedSession }, (res) => {
      if (res.error) {
        error = res.error;
      } else {
        connected = true;
        if (res.sessionId) {
          localStorage.setItem('hotseat-admin-session', res.sessionId);
        }
      }
    });

    socket.on('admin-state', (state) => {
      adminState = state;
    });

    socket.on('phase', () => {
      // Request fresh admin state when phase changes
      socket.emit('admin-refresh');
    });

    socket.on('player-list', () => {
      socket.emit('admin-refresh');
    });

    socket.on('yesno-reason', () => {
      socket.emit('admin-refresh');
    });

    socket.on('remove-reason', () => {
      socket.emit('admin-refresh');
    });

    socket.on('debate-state', () => {
      socket.emit('admin-refresh');
    });

    socket.on('spectrum-state', () => {
      socket.emit('admin-refresh');
    });
  });

  onDestroy(() => {
    socket.off('admin-state');
    socket.off('phase');
    socket.off('player-list');
    socket.off('yesno-reason');
    socket.off('remove-reason');
    socket.off('debate-state');
    socket.off('spectrum-state');
  });

  function nextAction() {
    socket.emit('admin-next-action');
  }

  $: nextLabel = (() => {
    const p = adminState?.phase;
    const dp = adminState?.debatePhase;
    const sp = adminState?.spectrumPhase;
    if (p === 'lobby') return 'START GAME';
    if (p === 'title1') return 'START STAGE 1';
    if (p === 'question') return 'NEXT QUESTION →';
    if (p === 'reveal') return 'NEXT QUESTION →';
    if (p === 'scoreboard') return 'NEXT ROUND →';
    if (p === 'title2') return 'START DEBATE';
    if (p === 'debate') {
      if (dp === 'title') return 'START DEBATE LOBBY';
      if (dp === 'lobby') return (adminState?.debateOptedInCount || 0) >= 2 ? 'START MATCH' : 'WAITING FOR PLAYERS...';
      if (dp === 'match') return 'PICK TOPIC';
      if (dp === 'grid') return 'PICK A TILE';
      if (dp === 'armed') return 'BEGIN DUEL';
      if (dp === 'duel') return 'END DUEL EARLY';
      if (dp === 'result') return 'NEW PLAYERS';
    }
    if (p === 'title3') return 'START SPECTRUM';
    if (p === 'spectrum') {
      if (sp === 'title') return 'START PICKING';
      if (sp === 'picking') return 'CONTINUE →';
      if (sp === 'speaker-reveal') return 'START TIMER';
      if (sp === 'guessing') return 'REVEAL EARLY';
      if (sp === 'results') return 'NEXT SPEAKER';
      if (sp === 'done') return 'GO TO GAME OVER';
    }
    if (p === 'gameover') return '—';
    return 'NEXT →';
  })();

  function kickPlayer(name) {
    socket.emit('admin-kick', { playerName: name });
  }

  function skipToStage(stage) {
    socket.emit('admin-skip-stage', { stage });
  }

  function removeReason(reasonId) {
    socket.emit('admin-remove-reason', { reasonId });
  }

  function refresh() {
    socket.emit('admin-refresh');
  }
</script>

<div class="admin">
  {#if error}
    <div class="admin-error">
      <div class="fire-icon">🔒</div>
      <h2 class="hero-title sm">ACCESS DENIED</h2>
      <p class="error-text">{error}</p>
    </div>

  {:else if !connected}
    <div class="admin-loading">
      <div class="fire-icon">🔑</div>
      <h2 class="hero-title sm">CONNECTING...</h2>
      <div class="pulse-ring"></div>
    </div>

  {:else}
    <div class="admin-bar">
      <span class="admin-bar-label">ADMIN REMOTE</span>
      <button class="refresh-btn" on:click={refresh}>↻</button>
    </div>

    <div class="admin-panels">
      <!-- Current Phase -->
      <div class="admin-section">
        <h3 class="section-heading">GAME STATUS</h3>
        <div class="phase-badge">{adminState?.phase?.toUpperCase() || 'UNKNOWN'}</div>
      </div>

      <!-- Continue / Next Action -->
      <div class="admin-section">
        <h3 class="section-heading">CONTINUE</h3>
        <button
          class="admin-btn next-btn"
          on:click={nextAction}
          disabled={nextLabel === 'PICK A TILE' || nextLabel === '—' || nextLabel === 'WAITING FOR PLAYERS...'}
        >
          {nextLabel}
        </button>
      </div>

      <!-- Stage Skip Controls -->
      <div class="admin-section">
        <h3 class="section-heading">SKIP TO</h3>
        <div class="skip-buttons">
          <button class="admin-btn skip-btn" on:click={() => skipToStage('scoreboard')}>
            SCOREBOARD
          </button>
          <button class="admin-btn skip-btn" on:click={() => skipToStage('debate')}>
            STAGE 2: DEBATE
          </button>
          <button class="admin-btn skip-btn" on:click={() => skipToStage('spectrum')}>
            STAGE 3: SPECTRUM
          </button>
        </div>
      </div>

      <!-- Player Management -->
      <div class="admin-section">
        <h3 class="section-heading">PLAYERS ({adminState?.players?.filter(p => !p.disconnected).length || 0})</h3>
        <div class="player-list">
          {#if adminState?.players}
            {#each adminState.players.filter(p => !p.disconnected) as player}
              <div class="player-row">
                <span class="player-name">{player.name}</span>
                <span class="player-score">{player.score} PTS</span>
                <button class="kick-btn" on:click={() => kickPlayer(player.name)}>KICK</button>
              </div>
            {/each}
          {/if}
          {#if !adminState?.players?.filter(p => !p.disconnected).length}
            <p class="empty-text">No players connected</p>
          {/if}
        </div>
      </div>

      <!-- Text Moderation (Stage 1 reasons) -->
      {#if adminState?.reasons?.length > 0}
        <div class="admin-section">
          <h3 class="section-heading">TEXT MODERATION</h3>
          <div class="reason-list">
            {#each adminState.reasons as reason}
              <div class="reason-row">
                <div class="reason-meta">
                  <span class="reason-author">{reason.name}</span>
                  <span class="reason-vote">{reason.answer === 'yes' ? 'YES' : 'NO'}</span>
                </div>
                <p class="reason-text">"{reason.reason}"</p>
                <button class="remove-btn" on:click={() => removeReason(reason.id)}>DELETE</button>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .admin {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    padding: 0;
  }

  /* ── Top Bar ── */
  .admin-bar {
    position: sticky;
    top: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.6rem 1rem;
    background: rgba(0, 0, 0, 0.7);
    border-bottom: 2px solid var(--accent-orange);
    z-index: 100;
    backdrop-filter: blur(6px);
  }
  .admin-bar-label {
    font-family: var(--font-hero);
    font-size: 1rem;
    color: var(--accent-orange);
    letter-spacing: 0.15em;
  }
  .refresh-btn {
    background: none;
    border: 2px solid var(--accent-orange);
    color: var(--accent-orange);
    font-size: 1.2rem;
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .refresh-btn:active {
    background: var(--accent-orange);
    color: var(--charcoal);
  }

  /* ── Error / Loading ── */
  .admin-error, .admin-loading {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 2rem;
  }
  .fire-icon {
    font-size: 3rem;
    filter: drop-shadow(0 0 12px rgba(232, 93, 38, 0.6));
  }
  .hero-title {
    font-family: var(--font-hero);
    font-size: 2rem;
    color: var(--accent-yellow);
    text-shadow: 3px 3px 0 var(--charcoal);
    letter-spacing: 0.05em;
    margin-top: 0.5rem;
  }
  .hero-title.sm { font-size: 1.8rem; }
  .error-text {
    font-family: var(--font-comic);
    font-size: 1.1rem;
    color: var(--cream-dim);
    margin-top: 0.5rem;
  }

  /* ── Panels ── */
  .admin-panels {
    flex: 1;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding-bottom: 2rem;
  }

  .admin-section {
    background: rgba(0, 0, 0, 0.3);
    border: 2px solid var(--charcoal);
    border-radius: 10px;
    padding: 0.75rem;
  }

  .section-heading {
    font-family: var(--font-hero);
    font-size: 1rem;
    color: var(--accent-orange);
    letter-spacing: 0.1em;
    margin-bottom: 0.5rem;
  }

  /* ── Phase Badge ── */
  .phase-badge {
    font-family: var(--font-hero);
    font-size: 1.4rem;
    color: var(--accent-yellow);
    text-shadow: 2px 2px 0 var(--charcoal);
    letter-spacing: 0.08em;
  }

  /* ── Skip Buttons ── */
  .skip-buttons {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .admin-btn {
    font-family: var(--font-body);
    font-weight: 700;
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    cursor: pointer;
    border-radius: 6px;
    padding: 0.6rem 1rem;
    transition: transform 0.1s, box-shadow 0.1s;
  }
  .admin-btn:active {
    transform: translate(1px, 1px);
  }
  .next-btn {
    width: 100%;
    background: var(--accent-orange);
    color: var(--cream);
    border: 2px solid var(--charcoal);
    font-size: 1rem;
    padding: 0.75rem 1rem;
    text-shadow: 1px 1px 0 rgba(0,0,0,0.3);
  }
  .next-btn:hover:not(:disabled) {
    background: #d44e1a;
  }
  .next-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .skip-btn {
    background: var(--charcoal);
    color: var(--cream);
    border: 2px solid var(--accent-yellow);
  }
  .skip-btn:hover {
    background: var(--accent-yellow);
    color: var(--charcoal);
  }

  /* ── Player List ── */
  .player-list {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }
  .player-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.6rem;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }
  .player-name {
    flex: 1;
    font-family: var(--font-body);
    font-weight: 700;
    font-size: 0.9rem;
    color: var(--cream);
    text-transform: uppercase;
  }
  .player-score {
    font-family: var(--font-hero);
    font-size: 0.8rem;
    color: var(--accent-yellow);
    letter-spacing: 0.05em;
  }
  .kick-btn {
    background: #c0392b;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 0.3rem 0.6rem;
    font-family: var(--font-body);
    font-weight: 700;
    font-size: 0.7rem;
    letter-spacing: 0.05em;
    cursor: pointer;
  }
  .kick-btn:active {
    background: #e74c3c;
  }

  /* ── Reason Moderation ── */
  .reason-list {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .reason-row {
    padding: 0.5rem 0.6rem;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }
  .reason-meta {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin-bottom: 0.2rem;
  }
  .reason-author {
    font-family: var(--font-body);
    font-weight: 700;
    font-size: 0.8rem;
    color: var(--cream);
    text-transform: uppercase;
  }
  .reason-vote {
    font-family: var(--font-body);
    font-size: 0.65rem;
    font-weight: 700;
    padding: 0.1rem 0.4rem;
    border-radius: 3px;
    letter-spacing: 0.05em;
    background: rgba(255, 255, 255, 0.1);
    color: var(--cream-dim);
  }
  .reason-text {
    font-family: var(--font-comic);
    font-size: 0.85rem;
    color: var(--cream);
    line-height: 1.3;
    margin: 0.2rem 0;
  }
  .remove-btn {
    background: #c0392b;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 0.3rem 0.8rem;
    font-family: var(--font-body);
    font-weight: 700;
    font-size: 0.7rem;
    letter-spacing: 0.05em;
    cursor: pointer;
    margin-top: 0.2rem;
  }
  .remove-btn:active {
    background: #e74c3c;
  }

  .empty-text {
    font-family: var(--font-comic);
    font-size: 0.85rem;
    color: var(--cream-dim);
    font-style: italic;
  }

  /* ── Pulse ── */
  .pulse-ring {
    width: 60px;
    height: 60px;
    border: 3px solid var(--accent-orange);
    border-radius: 50%;
    margin: 1rem auto 0;
    animation: pulse-anim 1.5s ease-in-out infinite;
  }
  @keyframes pulse-anim {
    0%, 100% { transform: scale(0.9); opacity: 0.5; }
    50% { transform: scale(1.1); opacity: 1; }
  }
</style>
