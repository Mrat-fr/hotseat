<script>
  import { onMount, onDestroy } from 'svelte';
  import socket from '../lib/socket.js';
  import { phase, roundData, scoreboard, myScore, reveal } from '../lib/store.js';

  let playerName = '';
  let joined = false;
  let error = '';
  let selectedAnswer = null;
  let submitted = false;
  let reason = '';
  let reasonSent = false;

  onMount(() => {
    socket.on('phase', (p) => {
      phase.set(p);
      if (p === 'question') {
        selectedAnswer = null;
        submitted = false;
        reason = '';
        reasonSent = false;
      }
    });
    socket.on('round-data', (data) => roundData.set(data));
    socket.on('scoreboard', (sb) => {
      scoreboard.set(sb);
      const me = sb.find(e => e.name === playerName);
      if (me) myScore.set(me.score);
    });
    socket.on('reveal', (r) => reveal.set(r));
  });

  onDestroy(() => {
    socket.off('phase');
    socket.off('round-data');
    socket.off('scoreboard');
    socket.off('reveal');
  });

  function join() {
    error = '';
    if (!playerName.trim()) { error = 'Enter your name'; return; }
    socket.emit('join-room', { name: playerName }, (res) => {
      if (res.error) { error = res.error; }
      else { joined = true; }
    });
  }

  function submitYesNo(answer) {
    if (submitted) return;
    selectedAnswer = answer;
    submitted = true;
    socket.emit('yesno-answer', { answer });
  }

  function sendReason() {
    if (reasonSent || !reason.trim()) return;
    reasonSent = true;
    socket.emit('yesno-reason', { reason });
  }
</script>

<div class="phone">
  {#if !joined}
    <div class="join-screen">
      <div class="fire-icon">🔥</div>
      <h2 class="hero-title">THE HOT SEAT</h2>
      <div class="join-form">
        <input
          type="text"
          bind:value={playerName}
          placeholder="YOUR NAME"
          maxlength="16"
          class="input"
          on:keydown={(e) => e.key === 'Enter' && join()}
        />
        <button class="btn-join" on:click={join}>TAKE A SEAT</button>
      </div>
      {#if error}<p class="error">{error}</p>{/if}
    </div>

  {:else if $phase === 'lobby'}
    <div class="waiting-screen">
      <div class="fire-icon">🔥</div>
      <h2 class="hero-title sm">YOU'RE IN!</h2>
      <p class="waiting-text">The heat is building...</p>
      <div class="pulse-ring"></div>
    </div>

  {:else if $phase === 'question' && $roundData}
    <div class="question-screen">
      <div class="round-badge">ROUND {$roundData.round}/{$roundData.total}</div>

      {#if $roundData.type === 'yesno'}
        <h3 class="question-text">{$roundData.question}</h3>
        {#if !submitted}
          <div class="yesno-buttons">
            <button class="yesno-btn yes-btn" on:click={() => submitYesNo('yes')}>
              <span class="btn-label">YES</span>
            </button>
            <button class="yesno-btn no-btn" on:click={() => submitYesNo('no')}>
              <span class="btn-label">NO</span>
            </button>
          </div>
        {:else}
          <div class="voted-msg" class:voted-yes={selectedAnswer === 'yes'} class:voted-no={selectedAnswer === 'no'}>
            {selectedAnswer === 'yes' ? 'YES ✓' : 'NO ✓'}
          </div>
          {#if !reasonSent}
            <div class="reason-box">
              <textarea
                bind:value={reason}
                placeholder="Defend yourself... (optional)"
                maxlength="80"
                class="reason-input"
              ></textarea>
              <button class="reason-btn" on:click={sendReason}>SEND IT 🔥</button>
            </div>
          {:else}
            <p class="reason-sent">OPINION LAUNCHED!</p>
          {/if}
        {/if}
      {/if}
    </div>

  {:else if $phase === 'reveal'}
    <div class="question-screen">
      <div class="voted-msg" class:voted-yes={selectedAnswer === 'yes'} class:voted-no={selectedAnswer === 'no'}>
        {selectedAnswer === 'yes' ? 'YES ✓' : 'NO ✓'}
      </div>
      {#if !reasonSent}
        <div class="reason-box">
          <textarea
            bind:value={reason}
            placeholder="Defend yourself... (optional)"
            maxlength="80"
            class="reason-input"
          ></textarea>
          <button class="reason-btn" on:click={sendReason}>SEND IT 🔥</button>
        </div>
      {:else}
        <p class="reason-sent">OPINION LAUNCHED!</p>
      {/if}
    </div>

  {:else if $phase === 'scoreboard'}
    <div class="score-screen">
      <div class="score-circle">
        <span class="my-score">{$myScore}</span>
        <span class="pts-label">PTS</span>
      </div>
    </div>

  {:else if $phase === 'gameover'}
    <div class="gameover-screen">
      <div class="fire-icon">🔥</div>
      <h2 class="hero-title sm">GAME OVER</h2>
      <div class="score-circle final">
        <span class="my-score">{$myScore}</span>
        <span class="pts-label">PTS</span>
      </div>
      <p class="thanks">Thanks for playing!</p>
    </div>
  {/if}
</div>

<style>
  .phone {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
  }
  .join-screen, .waiting-screen, .question-screen, .score-screen, .gameover-screen {
    text-align: center;
    width: 100%;
    max-width: 400px;
  }

  /* ── Hero elements ── */
  .fire-icon {
    font-size: 3rem;
    filter: drop-shadow(0 0 10px rgba(232, 93, 38, 0.5));
    animation: flicker 1.5s ease-in-out infinite alternate;
  }
  .hero-title {
    font-family: var(--font-hero);
    font-size: 3rem;
    color: var(--accent-yellow);
    text-shadow: 2px 2px 0 var(--charcoal);
    letter-spacing: 0.05em;
    margin-bottom: 1.5rem;
    line-height: 1;
  }
  .hero-title.sm { font-size: 2.5rem; }

  /* ── Join Form ── */
  .join-form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .input {
    display: block;
    width: 100%;
    padding: 0.9rem 1rem;
    border-radius: 8px;
    border: 3px solid var(--charcoal);
    background: rgba(0, 0, 0, 0.3);
    color: var(--cream);
    font-family: var(--font-body);
    font-size: 1.1rem;
    font-weight: 700;
    text-align: center;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }
  .input::placeholder {
    color: var(--cream-dim);
    opacity: 0.6;
  }
  .btn-join {
    background: var(--accent-orange);
    color: var(--cream);
    border: 3px solid var(--charcoal);
    padding: 0.9rem 2rem;
    border-radius: 8px;
    font-family: var(--font-hero);
    font-size: 1.5rem;
    letter-spacing: 0.05em;
    cursor: pointer;
    box-shadow: 4px 4px 0 var(--charcoal);
    transition: transform 0.1s, box-shadow 0.1s;
  }
  .btn-join:active {
    transform: translate(2px, 2px);
    box-shadow: 2px 2px 0 var(--charcoal);
  }
  .error {
    color: var(--no-red);
    font-weight: 700;
    margin-top: 0.5rem;
    font-family: var(--font-body);
  }

  /* ── Waiting ── */
  .waiting-text {
    font-family: var(--font-comic);
    font-size: 1.2rem;
    color: var(--cream-dim);
    font-style: italic;
  }
  .pulse-ring {
    width: 24px;
    height: 24px;
    background: var(--accent-orange);
    border-radius: 50%;
    margin: 2rem auto;
    border: 3px solid var(--charcoal);
    animation: pulse 1.5s ease-in-out infinite;
  }

  /* ── Question ── */
  .round-badge {
    background: var(--charcoal);
    border: 2px solid var(--accent-yellow);
    display: inline-block;
    padding: 0.3rem 1.2rem;
    border-radius: 6px;
    font-family: var(--font-hero);
    font-size: 1rem;
    letter-spacing: 0.1em;
    color: var(--accent-yellow);
    margin-bottom: 1.2rem;
  }
  .question-text {
    font-family: var(--font-body);
    font-size: 1.3rem;
    font-weight: 700;
    margin-bottom: 1.5rem;
    line-height: 1.4;
    color: var(--cream);
  }

  /* ── Yes/No Buttons ── */
  .yesno-buttons {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-top: 1rem;
  }
  .yesno-btn {
    padding: 1.8rem;
    border: 4px solid var(--charcoal);
    border-radius: 12px;
    font-size: 2.2rem;
    cursor: pointer;
    transition: transform 0.1s, box-shadow 0.1s;
    box-shadow: 5px 5px 0 var(--charcoal);
  }
  .yesno-btn:active {
    transform: translate(3px, 3px);
    box-shadow: 2px 2px 0 var(--charcoal);
  }
  .btn-label {
    font-family: var(--font-hero);
    letter-spacing: 0.15em;
  }
  .yes-btn { background: var(--yes-green); color: var(--cream); }
  .no-btn  { background: var(--no-red); color: var(--cream); }

  /* ── Voted state ── */
  .voted-msg {
    margin-top: 1.5rem;
    font-family: var(--font-hero);
    font-size: 3rem;
    padding: 1.2rem;
    border-radius: 12px;
    border: 3px solid var(--charcoal);
    text-shadow: 2px 2px 0 var(--charcoal);
  }
  .voted-yes { background: rgba(45, 147, 108, 0.25); color: var(--yes-green); }
  .voted-no  { background: rgba(214, 64, 69, 0.25); color: var(--no-red); }

  /* ── Reason box ── */
  .reason-box {
    margin-top: 1.2rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .reason-input {
    width: 100%;
    padding: 0.75rem;
    border-radius: 8px;
    border: 3px solid var(--charcoal);
    background: rgba(0, 0, 0, 0.3);
    color: var(--cream);
    font-family: var(--font-comic);
    font-size: 1rem;
    resize: none;
    min-height: 70px;
  }
  .reason-input::placeholder {
    color: var(--cream-dim);
    opacity: 0.5;
  }
  .reason-btn {
    background: var(--accent-yellow);
    color: var(--charcoal);
    border: 3px solid var(--charcoal);
    padding: 0.7rem;
    border-radius: 8px;
    font-family: var(--font-hero);
    font-size: 1.2rem;
    letter-spacing: 0.05em;
    cursor: pointer;
    box-shadow: 3px 3px 0 var(--charcoal);
    transition: transform 0.1s, box-shadow 0.1s;
  }
  .reason-btn:active {
    transform: translate(2px, 2px);
    box-shadow: 1px 1px 0 var(--charcoal);
  }
  .reason-sent {
    color: var(--accent-yellow);
    font-family: var(--font-hero);
    font-size: 1.2rem;
    letter-spacing: 0.1em;
    margin-top: 1rem;
  }

  /* ── Score display ── */
  .score-circle {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 160px;
    height: 160px;
    margin: 2rem auto;
    border: 4px solid var(--accent-yellow);
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.3);
    box-shadow: 0 0 30px rgba(242, 183, 5, 0.2);
  }
  .score-circle.final {
    width: 200px;
    height: 200px;
    border-width: 5px;
    box-shadow: 0 0 40px rgba(242, 183, 5, 0.3);
  }
  .my-score {
    font-family: var(--font-hero);
    font-size: 4rem;
    color: var(--accent-yellow);
    text-shadow: 2px 2px 0 var(--charcoal);
    line-height: 1;
  }
  .score-circle.final .my-score { font-size: 5rem; }
  .pts-label {
    font-family: var(--font-hero);
    font-size: 1.2rem;
    color: var(--cream-dim);
    letter-spacing: 0.2em;
  }
  .thanks {
    font-family: var(--font-comic);
    font-size: 1.1rem;
    color: var(--cream-dim);
    margin-top: 1rem;
  }

  /* ── Animations ── */
  @keyframes pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.5); opacity: 0.5; }
  }
  @keyframes flicker {
    0% { transform: scale(1) rotate(-2deg); }
    50% { transform: scale(1.05) rotate(1deg); }
    100% { transform: scale(1) rotate(-1deg); }
  }
</style>
