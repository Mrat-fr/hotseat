<script>
  import { onMount, onDestroy } from 'svelte';
  import socket from '../lib/socket.js';
  import { phase, roundData, scoreboard, myScore, reveal } from '../lib/store.js';

  let playerName = '';
  let joined = false;
  let error = '';
  let selectedAnswer = null;
  let textAnswer = '';
  let submitted = false;

  onMount(() => {
    socket.on('phase', (p) => {
      phase.set(p);
      if (p === 'question') {
        selectedAnswer = null;
        textAnswer = '';
        submitted = false;
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

  function submitTrivia(index) {
    if (submitted) return;
    selectedAnswer = index;
    submitted = true;
    socket.emit('trivia-answer', { answerIndex: index });
  }

  function submitText() {
    if (submitted || !textAnswer.trim()) return;
    submitted = true;
    socket.emit('submit-answer', { answer: textAnswer });
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

      {#if $roundData.type === 'trivia'}
        <h3>{$roundData.question}</h3>
        <div class="options">
          {#each $roundData.options as opt, i}
            <button
              class="option"
              class:selected={selectedAnswer === i}
              class:disabled={submitted}
              on:click={() => submitTrivia(i)}
            >{opt}</button>
          {/each}
        </div>

      {:else if $roundData.type === 'creative' || $roundData.type === 'draw'}
        <h3>{$roundData.prompt}</h3>
        <textarea
          bind:value={textAnswer}
          placeholder="Type your answer..."
          class="text-input"
          disabled={submitted}
        ></textarea>
        {#if !submitted}
          <button class="btn" on:click={submitText}>Submit</button>
        {:else}
          <p class="submitted-msg">Submitted!</p>
        {/if}
      {/if}
    </div>

  {:else if $phase === 'reveal' || $phase === 'scoreboard'}
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
  .options { display: flex; flex-direction: column; gap: 0.6rem; }
  .option {
    padding: 1rem;
    border: 2px solid #333;
    border-radius: 12px;
    background: #1a1a2e;
    color: white;
    font-size: 1.1rem;
    cursor: pointer;
    transition: all 0.15s;
  }
  .option:hover:not(.disabled) { border-color: #6c5ce7; }
  .option.selected { background: #6c5ce7; border-color: #6c5ce7; }
  .option.disabled { opacity: 0.6; cursor: default; }
  .text-input {
    width: 100%;
    min-height: 120px;
    padding: 1rem;
    border-radius: 12px;
    border: 2px solid #333;
    background: #1a1a2e;
    color: white;
    font-size: 1rem;
    resize: vertical;
    margin-bottom: 0.75rem;
  }
  .submitted-msg { color: #00b894; font-weight: 700; font-size: 1.2rem; }
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
