<script>
  import { onMount, onDestroy } from 'svelte';
  import socket from '../lib/socket.js';
  import { players, phase, roundData, scoreboard, yesnoResults, yesnoReasons } from '../lib/store.js';
  import YesNo from './rounds/YesNo.svelte';

  let roomCode = '';

  onMount(() => {
    socket.emit('join-host');

    socket.on('room-code', (code) => roomCode = code);
    socket.on('player-list', (list) => players.set(list));
    socket.on('phase', (p) => phase.set(p));
    socket.on('round-data', (data) => roundData.set(data));
    socket.on('scoreboard', (sb) => scoreboard.set(sb));
    socket.on('yesno-results', (r) => yesnoResults.set(r));
    socket.on('yesno-reason', (r) => yesnoReasons.update(arr => {
      // assign random float position once on arrival
      return [...arr, { ...r, x: 5 + Math.random() * 70, y: 5 + Math.random() * 70, dur: 6 + Math.random() * 6, delay: Math.random() * 2 }];
    }));
    socket.on('yesno-reasons-reset', () => yesnoReasons.set([]));
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
  });

  function startGame() { socket.emit('start-game'); }
  function nextRound() { socket.emit('next-round'); }
  function showScoreboard() { socket.emit('show-scoreboard'); }
  function voteFor(name) { socket.emit('vote', { playerName: name }); }
</script>

<div class="host">
  {#if $phase === 'lobby'}
    <div class="lobby">
      <h1>Party Blitz</h1>
      <div class="code-display">
        <span class="label">Room Code</span>
        <span class="code">{roomCode}</span>
      </div>
      <img src="/api/qr" alt="QR Code" class="qr" />
      <div class="player-list">
        <h3>Players ({$players.length})</h3>
        {#each $players as name}
          <div class="player-tag">{name}</div>
        {/each}
        {#if $players.length === 0}
          <p class="waiting">Waiting for players to join...</p>
        {/if}
      </div>
      {#if $players.length >= 1}
        <button class="btn-start" on:click={startGame}>Start Game</button>
      {/if}
    </div>

  {:else if $phase === 'question'}
    <div class="round-display">
      {#if $roundData?.type === 'yesno'}
        <YesNo data={$roundData} results={$yesnoResults} reasons={$yesnoReasons} />
      {/if}
    </div>

  {:else if $phase === 'reveal'}
    <div class="reveal-screen">
      {#if $roundData?.type === 'yesno'}
        <YesNo data={$roundData} results={$yesnoResults} reasons={$yesnoReasons} />
      {/if}
      <button class="btn-next" on:click={nextRound}>Next Question</button>
    </div>

  {:else if $phase === 'scoreboard'}
    <div class="scoreboard-screen">
      <h2>Scoreboard</h2>
      <div class="scores">
        {#each $scoreboard as entry, i}
          <div class="score-row" class:first={i === 0}>
            <span class="rank">#{i + 1}</span>
            <span class="name">{entry.name}</span>
            <span class="pts">{entry.score}</span>
          </div>
        {/each}
      </div>
      <button class="btn-next" on:click={nextRound}>Next Round</button>
    </div>

  {:else if $phase === 'gameover'}
    <div class="gameover-screen">
      <h1>Game Over!</h1>
      {#if $scoreboard.length > 0}
        <div class="winner">
          <span class="trophy">🏆</span>
          <h2>{$scoreboard[0].name}</h2>
          <p>{$scoreboard[0].score} points</p>
        </div>
      {/if}
      <div class="scores">
        {#each $scoreboard as entry, i}
          <div class="score-row">
            <span>#{i + 1} {entry.name}</span>
            <span>{entry.score}</span>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .host {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
  }
  .lobby, .round-display, .reveal-screen, .scoreboard-screen, .gameover-screen {
    text-align: center;
    width: 100%;
    max-width: 600px;
  }
  .code-display { margin: 1.5rem 0; }
  .label { display: block; color: #aaa; font-size: 0.9rem; margin-bottom: 0.25rem; }
  .code { font-size: 4rem; font-weight: 900; letter-spacing: 0.3em; color: #6c5ce7; }
  .qr {
    width: 180px;
    height: 180px;
    margin: 1rem auto;
    display: block;
    background: white;
    padding: 8px;
    border-radius: 12px;
  }
  .player-list { margin: 1.5rem 0; }
  .player-tag {
    display: inline-block;
    background: #1a1a2e;
    padding: 0.5rem 1rem;
    border-radius: 20px;
    margin: 0.25rem;
    font-weight: 600;
  }
  .waiting { color: #666; font-style: italic; }
  .btn-start {
    background: #00b894;
    color: white;
    border: none;
    padding: 1rem 3rem;
    border-radius: 12px;
    font-size: 1.3rem;
    font-weight: 700;
    cursor: pointer;
    margin-top: 1rem;
  }
  .btn-start:hover { background: #00a381; }
  .btn-next {
    background: #6c5ce7;
    color: white;
    border: none;
    padding: 0.8rem 2rem;
    border-radius: 10px;
    font-size: 1rem;
    font-weight: 700;
    cursor: pointer;
    margin-top: 1.5rem;
  }
  .scores { margin: 1.5rem 0; }
  .score-row {
    display: flex;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    background: #1a1a2e;
    border-radius: 10px;
    margin: 0.4rem 0;
    font-size: 1.1rem;
  }
  .score-row.first { background: #6c5ce7; font-weight: 700; }
  .winner { margin: 2rem 0; }
  .trophy { font-size: 4rem; }
</style>
