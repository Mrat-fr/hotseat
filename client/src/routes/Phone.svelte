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
      <h2>Party Blitz</h2>
      <input
        type="text"
        bind:value={playerName}
        placeholder="Your Name"
        maxlength="16"
        class="input"
      />
      <button class="btn" on:click={join}>Join</button>
      {#if error}<p class="error">{error}</p>{/if}
    </div>

  {:else if $phase === 'lobby'}
    <div class="waiting-screen">
      <h2>You're in!</h2>
      <p>Waiting for the host to start...</p>
      <div class="pulse"></div>
    </div>

  {:else if $phase === 'question' && $roundData}
    <div class="question-screen">
      <div class="round-badge">Round {$roundData.round}/{$roundData.total}</div>

      {#if $roundData.type === 'yesno'}
        <h3>{$roundData.question}</h3>
        {#if !submitted}
          <div class="yesno-buttons">
            <button class="yesno-btn yes-btn" on:click={() => submitYesNo('yes')}>YES</button>
            <button class="yesno-btn no-btn"  on:click={() => submitYesNo('no')}>NO</button>
          </div>
        {:else}
          <div class="voted-msg" class:voted-yes={selectedAnswer === 'yes'} class:voted-no={selectedAnswer === 'no'}>
            {selectedAnswer === 'yes' ? 'YES ✓' : 'NO ✓'}
          </div>
          {#if !reasonSent}
            <div class="reason-box">
              <textarea
                bind:value={reason}
                placeholder="Why? (optional)"
                maxlength="80"
                class="reason-input"
              ></textarea>
              <button class="reason-btn" on:click={sendReason}>Send</button>
            </div>
          {:else}
            <p class="reason-sent">Message sent!</p>
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
            placeholder="Why? (optional)"
            maxlength="80"
            class="reason-input"
          ></textarea>
          <button class="reason-btn" on:click={sendReason}>Send</button>
        </div>
      {:else}
        <p class="reason-sent">Message sent!</p>
      {/if}
    </div>

  {:else if $phase === 'scoreboard'}
    <div class="score-screen">
      <div class="my-score">{$myScore}</div>
      <p>pts</p>
    </div>

  {:else if $phase === 'gameover'}
    <div class="gameover-screen">
      <h2>Game Over!</h2>
      <div class="my-score final">{$myScore}</div>
      <p>pts — thanks for playing!</p>
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
  h2 { font-size: 1.8rem; margin-bottom: 1.5rem; }
  .input {
    display: block;
    width: 100%;
    padding: 0.8rem 1rem;
    border-radius: 10px;
    border: 2px solid #333;
    background: #1a1a2e;
    color: white;
    font-size: 1rem;
    text-align: center;
    margin-bottom: 0.75rem;
  }
  .btn {
    background: #6c5ce7;
    color: white;
    border: none;
    padding: 0.8rem 2rem;
    border-radius: 10px;
    font-size: 1rem;
    font-weight: 700;
    cursor: pointer;
    width: 100%;
  }
  .btn:hover { background: #5a4bd1; }
  .error { color: #ff6b6b; margin-top: 0.5rem; }
  .round-badge {
    background: #6c5ce7;
    display: inline-block;
    padding: 0.3rem 1rem;
    border-radius: 20px;
    font-size: 0.85rem;
    font-weight: 700;
    margin-bottom: 1rem;
  }
  h3 { font-size: 1.3rem; margin-bottom: 1.5rem; }
  .yesno-buttons {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-top: 1.5rem;
  }
  .yesno-btn {
    padding: 2rem;
    border: none;
    border-radius: 16px;
    font-size: 2rem;
    font-weight: 900;
    letter-spacing: 0.1em;
    cursor: pointer;
    transition: transform 0.1s;
  }
  .yesno-btn:active { transform: scale(0.97); }
  .yes-btn { background: #00b894; color: white; }
  .no-btn  { background: #ff6b6b; color: white; }
  .voted-msg {
    margin-top: 2rem;
    font-size: 3rem;
    font-weight: 900;
    padding: 1.5rem;
    border-radius: 16px;
  }
  .voted-yes { background: rgba(0,184,148,0.2); color: #00b894; }
  .voted-no  { background: rgba(255,107,107,0.2); color: #ff6b6b; }
  .reason-box {
    margin-top: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .reason-input {
    width: 100%;
    padding: 0.75rem;
    border-radius: 10px;
    border: 2px solid #333;
    background: #1a1a2e;
    color: white;
    font-size: 1rem;
    resize: none;
    min-height: 70px;
  }
  .reason-btn {
    background: #6c5ce7;
    color: white;
    border: none;
    padding: 0.7rem;
    border-radius: 10px;
    font-size: 1rem;
    font-weight: 700;
    cursor: pointer;
  }
  .reason-sent { color: #00b894; font-weight: 600; margin-top: 0.75rem; }

  .my-score { font-size: 4rem; font-weight: 900; color: #fdcb6e; margin: 1rem 0; }
  .my-score.final { font-size: 5rem; }
  .pulse {
    width: 20px;
    height: 20px;
    background: #00b894;
    border-radius: 50%;
    margin: 2rem auto;
    animation: pulse 1.5s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.5); opacity: 0.5; }
  }
</style>
