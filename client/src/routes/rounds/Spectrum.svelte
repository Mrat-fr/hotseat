<script>
  import socket from '../../lib/socket.js';

  export let state;

  function startPicking() {
    socket.emit('spectrum-start-picking');
  }
  function continueGame() {
    socket.emit('spectrum-continue');
  }
  function startTimer() {
    socket.emit('spectrum-start-timer');
  }
  function revealEarly() {
    socket.emit('spectrum-reveal');
  }
  function nextSpeaker() {
    socket.emit('spectrum-next-speaker');
  }
  function endGame() {
    socket.emit('spectrum-end');
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  $: speakersLeft = state ? (state.defendPool?.length || 0) - (state.usedSpeakers?.length || 0) : 0;
  $: sortedScores = state?.scores
    ? Object.entries(state.scores)
        .map(([name, s]) => ({ name, ...s }))
        .sort((a, b) => b.points - a.points)
    : [];
</script>

<div class="spectrum">
  {#if !state || state.phase === 'title'}
    <!-- TITLE / HOW TO PLAY -->
    <div class="lobby-view">
      <div class="hero-sm">
        <div class="fire-icon-spectrum">🎯</div>
        <h1 class="logo">THE SPECTRUM</h1>
        <p class="tagline">STAGE 3</p>
      </div>
      <div class="how-to-play">
        <h3 class="section-title">HOW TO PLAY</h3>
        <ul class="how-list">
          <li>Everyone picks a statement on their phone and rates it on a slider (0% Disagree → 100% Agree).</li>
          <li>Players who opt in can be chosen as the Speaker.</li>
          <li>A random speaker is chosen. Their statement appears on screen and a 3-minute timer starts.</li>
          <li>Everyone else guesses exactly where the Speaker placed their slider.</li>
          <li>Closer guesses = more points. 👑 for a perfect match!</li>
          <li>Every opt-in player gets a turn as speaker before the game ends.</li>
        </ul>
      </div>
      <button class="btn-action fire" on:click={startPicking}>🎯 START 🎯</button>
    </div>

  {:else if state.phase === 'picking'}
    <!-- WAITING FOR PLAYERS TO PICK -->
    <div class="lobby-view">
      <div class="hero-sm">
        <h2 class="stage-title">STAGE 3</h2>
        <h1 class="logo sm">THE SPECTRUM</h1>
        <p class="tagline">PLAYERS ARE PICKING...</p>
      </div>

      <div class="progress-section">
        <div class="progress-ring">
          <span class="progress-num">{state.readyCount}</span>
          <span class="progress-sep">/</span>
          <span class="progress-den">{state.totalPlayers}</span>
        </div>
        <p class="progress-label">PLAYERS READY</p>
      </div>

      {#if state.defendPool?.length > 0}
        <div class="defend-section">
          <h3 class="section-title">READY TO DEFEND 🎤 ({state.defendPool.length})</h3>
          <div class="opt-in-tags">
            {#each state.defendPool as name}
              <div class="opt-tag">{name}</div>
            {/each}
          </div>
        </div>
      {/if}

      <button class="btn-action fire" on:click={continueGame}>CONTINUE →</button>
    </div>

  {:else if state.phase === 'speaker-reveal'}
    <!-- SPEAKER REVEAL -->
    <div class="match-view">
      <h2 class="match-header">THE SPEAKER</h2>
      <div class="speaker-card">
        <div class="speaker-icon">🎤</div>
        <span class="speaker-name">{state.currentSpeaker}</span>
      </div>
      <div class="statement-card">
        <p class="statement-text">"{state.currentStatement}"</p>
      </div>
      <p class="match-prompt">Where did {state.currentSpeaker} place their slider?</p>
      <button class="btn-action fire" on:click={startTimer}>START GUESSING (3:00)</button>
    </div>

  {:else if state.phase === 'guessing'}
    <!-- GUESSING PHASE WITH TIMER -->
    <div class="duel-view">
      <div class="statement-card">
        <p class="statement-text">"{state.currentStatement}"</p>
      </div>
      <div class="timer" class:timer-danger={state.timeLeft <= 30}>
        <span class="timer-digits">{formatTime(state.timeLeft)}</span>
      </div>
      <div class="speaker-badge">
        <span class="speaker-badge-icon">🎤</span>
        <span class="speaker-badge-name">{state.currentSpeaker}</span>
      </div>
      <div class="guess-progress">
        <span class="guess-count">{state.guessCount} guesses in</span>
      </div>
      <button class="btn-action fire finish-btn" on:click={revealEarly}>REVEAL EARLY</button>
    </div>

  {:else if state.phase === 'results'}
    <!-- RESULTS -->
    <div class="result-view">
      <h2 class="result-header">THE ANSWER</h2>
      <div class="statement-card compact">
        <p class="statement-text sm">"{state.currentStatement}"</p>
      </div>

      <!-- Speaker's answer slider visualization -->
      <div class="answer-bar-section">
        <div class="speaker-answer-label">
          <span class="speaker-answer-icon">🎤</span>
          {state.currentSpeaker} answered:
        </div>
        <div class="answer-bar">
          <div class="answer-fill" style="width: {state.speakerValue}%"></div>
          <div class="answer-marker" style="left: {state.speakerValue}%">
            <span class="marker-label">{state.speakerValue}%</span>
          </div>
        </div>
        <div class="bar-labels">
          <span>0% DISAGREE</span>
          <span>100% AGREE</span>
        </div>
      </div>

      <!-- Score breakdown -->
      <div class="scores-list">
        {#each sortedScores as entry, i}
          <div class="score-entry" class:perfect={entry.perfect}>
            <span class="se-rank">
              {#if entry.perfect}👑{:else}#{i + 1}{/if}
            </span>
            <span class="se-name">{entry.name}</span>
            <span class="se-guess">guessed {entry.guess}%</span>
            <span class="se-dist">{entry.distance}% off</span>
            <span class="se-pts">+{entry.points}</span>
          </div>
        {/each}
        {#if sortedScores.length === 0}
          <p class="no-guesses">No guesses were submitted!</p>
        {/if}
      </div>

      <div class="result-actions">
        {#if speakersLeft > 0}
          <button class="btn-action fire" on:click={nextSpeaker}>
            NEXT SPEAKER ({speakersLeft} left)
          </button>
        {:else}
          <p class="all-done-msg">All speakers have gone!</p>
        {/if}
        <button class="btn-action secondary" on:click={endGame}>END GAME</button>
      </div>
    </div>

  {:else if state.phase === 'done'}
    <!-- ALL SPEAKERS DONE -->
    <div class="result-view">
      <div class="hero-sm">
        <div class="fire-icon-spectrum">🎯</div>
        <h1 class="logo">COMPLETE!</h1>
      </div>
      <p class="all-done-msg">All {state.usedSpeakers?.length || 0} speakers have been revealed.</p>
      <button class="btn-action fire" on:click={endGame}>FINAL SCORES</button>
    </div>
  {/if}
</div>

<style>
  .spectrum {
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
  .logo.sm { font-size: 3rem; }
  .tagline {
    font-family: var(--font-body);
    font-weight: 700;
    font-size: 1rem;
    letter-spacing: 0.3em;
    color: var(--cream-dim);
    margin-top: 0.5rem;
    text-transform: uppercase;
  }

  /* ── Title / How to Play ── */
  .fire-icon-spectrum {
    font-size: 3.5rem;
    filter: drop-shadow(0 0 12px rgba(232, 93, 38, 0.6));
    animation: pop 0.5s ease-out;
  }
  .how-to-play {
    margin: 1.5rem auto;
    max-width: 500px;
    text-align: left;
    background: rgba(0, 0, 0, 0.2);
    border: 3px dashed var(--accent-orange);
    border-radius: 16px;
    padding: 1.5rem;
  }
  .how-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .how-list li {
    font-family: var(--font-comic);
    font-size: 1rem;
    color: var(--cream);
    line-height: 1.4;
    padding-left: 1.5rem;
    position: relative;
  }
  .how-list li::before {
    content: '🎯';
    position: absolute;
    left: 0;
    font-size: 0.85rem;
  }

  /* ── Lobby / Progress ── */
  .lobby-view { padding: 1rem 0; }
  .section-title {
    font-family: var(--font-hero);
    font-size: 1.3rem;
    color: var(--accent-orange);
    letter-spacing: 0.08em;
    margin-bottom: 1rem;
  }
  .progress-section {
    margin: 2rem 0;
  }
  .progress-ring {
    width: 140px;
    height: 140px;
    border-radius: 50%;
    border: 6px solid var(--accent-yellow);
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto;
    background: rgba(0, 0, 0, 0.4);
    box-shadow: 0 0 30px rgba(242, 183, 5, 0.2);
    gap: 0.1rem;
  }
  .progress-num {
    font-family: var(--font-hero);
    font-size: 3rem;
    color: var(--accent-yellow);
    text-shadow: 2px 2px 0 var(--charcoal);
  }
  .progress-sep {
    font-family: var(--font-hero);
    font-size: 2rem;
    color: var(--cream-dim);
    margin: 0 0.1rem;
  }
  .progress-den {
    font-family: var(--font-hero);
    font-size: 2rem;
    color: var(--cream-dim);
  }
  .progress-label {
    font-family: var(--font-hero);
    font-size: 1rem;
    color: var(--cream-dim);
    letter-spacing: 0.2em;
    margin-top: 0.75rem;
  }

  /* ── Defend pool ── */
  .defend-section { margin: 1.5rem 0; }
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

  /* ── Speaker Reveal ── */
  .match-view { padding: 1rem 0; }
  .match-header {
    font-family: var(--font-hero);
    font-size: 2.5rem;
    color: var(--accent-yellow);
    text-shadow: 2px 2px 0 var(--charcoal);
    margin-bottom: 1rem;
    animation: pop 0.4s ease-out;
  }
  .speaker-card {
    background: rgba(242, 183, 5, 0.15);
    border: 3px solid var(--accent-yellow);
    border-radius: 16px;
    padding: 1.5rem 2rem;
    margin: 0 auto 1.5rem;
    max-width: 400px;
    box-shadow: 6px 6px 0 var(--charcoal);
    animation: pop 0.5s ease-out;
  }
  .speaker-icon {
    font-size: 3rem;
    margin-bottom: 0.5rem;
  }
  .speaker-name {
    font-family: var(--font-hero);
    font-size: 3rem;
    color: var(--accent-yellow);
    text-shadow: 2px 2px 0 var(--charcoal);
    text-transform: uppercase;
    display: block;
  }
  .statement-card {
    background: rgba(0, 0, 0, 0.3);
    border: 3px solid var(--charcoal);
    border-radius: 12px;
    padding: 1.5rem 2rem;
    margin: 0 auto 1.5rem;
    max-width: 600px;
    box-shadow: 4px 4px 0 var(--charcoal);
  }
  .statement-card.compact { padding: 1rem 1.5rem; margin-bottom: 1rem; }
  .statement-text {
    font-family: var(--font-comic);
    font-size: 1.4rem;
    color: var(--cream);
    line-height: 1.4;
    font-style: italic;
    margin: 0;
  }
  .statement-text.sm { font-size: 1.1rem; }
  .match-prompt {
    font-family: var(--font-comic);
    font-size: 1.2rem;
    color: var(--cream-dim);
    font-style: italic;
    margin-bottom: 1rem;
  }

  /* ── Guessing phase ── */
  .duel-view { padding: 1rem 0; }
  .timer {
    margin: 1.5rem auto;
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
  .speaker-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    margin: 1rem 0;
  }
  .speaker-badge-icon { font-size: 1.5rem; }
  .speaker-badge-name {
    font-family: var(--font-hero);
    font-size: 1.8rem;
    color: var(--accent-yellow);
    text-shadow: 1px 1px 0 var(--charcoal);
    text-transform: uppercase;
  }
  .guess-progress { margin: 1rem 0; }
  .guess-count {
    font-family: var(--font-body);
    font-size: 1.1rem;
    color: var(--cream-dim);
    font-weight: 700;
  }
  .finish-btn { margin-top: 1.5rem; }

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

  /* Answer bar */
  .answer-bar-section {
    max-width: 500px;
    margin: 1.5rem auto;
  }
  .speaker-answer-label {
    font-family: var(--font-hero);
    font-size: 1.1rem;
    color: var(--accent-yellow);
    margin-bottom: 0.75rem;
    text-transform: uppercase;
  }
  .speaker-answer-icon { margin-right: 0.3rem; }
  .answer-bar {
    height: 40px;
    background: rgba(0, 0, 0, 0.4);
    border: 3px solid var(--charcoal);
    border-radius: 20px;
    position: relative;
    overflow: visible;
  }
  .answer-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--no-red), var(--accent-yellow), var(--yes-green));
    border-radius: 17px;
    transition: width 1s ease-out;
  }
  .answer-marker {
    position: absolute;
    top: -12px;
    transform: translateX(-50%);
    transition: left 1s ease-out;
  }
  .marker-label {
    background: var(--accent-yellow);
    color: var(--charcoal);
    font-family: var(--font-hero);
    font-size: 1.2rem;
    padding: 0.2rem 0.6rem;
    border-radius: 6px;
    border: 2px solid var(--charcoal);
    box-shadow: 2px 2px 0 var(--charcoal);
    white-space: nowrap;
  }
  .bar-labels {
    display: flex;
    justify-content: space-between;
    margin-top: 0.5rem;
    font-family: var(--font-body);
    font-size: 0.75rem;
    color: var(--cream-dim);
    font-weight: 700;
    letter-spacing: 0.05em;
  }

  /* Score list */
  .scores-list {
    margin: 1.5rem 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .score-entry {
    display: flex;
    align-items: center;
    padding: 0.6rem 1rem;
    background: rgba(0, 0, 0, 0.3);
    border: 2px solid var(--charcoal);
    border-radius: 8px;
    font-family: var(--font-body);
    font-size: 1rem;
    font-weight: 600;
    gap: 0.5rem;
  }
  .score-entry.perfect {
    background: rgba(242, 183, 5, 0.2);
    border-color: var(--accent-yellow);
    box-shadow: 0 0 15px rgba(242, 183, 5, 0.15);
  }
  .se-rank { min-width: 2rem; text-align: center; color: var(--cream-dim); }
  .score-entry.perfect .se-rank { font-size: 1.3rem; }
  .se-name { flex: 1; text-align: left; color: var(--cream); text-transform: uppercase; }
  .se-guess { color: var(--cream-dim); font-size: 0.85rem; }
  .se-dist { color: var(--accent-orange); font-size: 0.85rem; }
  .se-pts {
    font-family: var(--font-hero);
    font-size: 1.1rem;
    color: var(--accent-yellow);
    min-width: 4rem;
    text-align: right;
  }
  .no-guesses {
    font-family: var(--font-comic);
    color: var(--cream-dim);
    font-style: italic;
  }
  .all-done-msg {
    font-family: var(--font-comic);
    font-size: 1.3rem;
    color: var(--cream);
    margin: 1rem 0;
  }
  .result-actions {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    margin-top: 1rem;
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
  }
  .btn-action.secondary:hover {
    color: var(--cream);
    border-color: var(--cream);
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
