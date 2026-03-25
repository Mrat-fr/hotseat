<script>
  import { push } from 'svelte-spa-router';
  import socket from '../lib/socket.js';

  let joinCode = '';
  let playerName = '';
  let error = '';

  function hostGame() {
    socket.emit('create-room', ({ code }) => {
      push(`/host`);
      // Host component will pick up the room code
      window.__PARTY_ROOM_CODE = code;
    });
  }

  function joinGame() {
    error = '';
    if (!joinCode.trim() || !playerName.trim()) {
      error = 'Enter a room code and your name';
      return;
    }
    socket.emit('join-room', { code: joinCode.toUpperCase(), name: playerName }, (res) => {
      if (res.error) {
        error = res.error;
      } else {
        push(`/play/${joinCode.toUpperCase()}`);
      }
    });
  }
</script>

<div class="landing">
  <h1>🎉 Party Blitz</h1>
  <p class="subtitle">The party game that fits in your pocket</p>

  <div class="actions">
    <button class="btn-host" on:click={hostGame}>Host a Game</button>

    <div class="divider">or join one</div>

    <input
      type="text"
      bind:value={joinCode}
      placeholder="Room Code"
      maxlength="4"
      class="input"
    />
    <input
      type="text"
      bind:value={playerName}
      placeholder="Your Name"
      maxlength="16"
      class="input"
    />
    <button class="btn-join" on:click={joinGame}>Join</button>

    {#if error}
      <p class="error">{error}</p>
    {/if}
  </div>
</div>

<style>
  .landing {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 2rem;
    text-align: center;
  }
  h1 {
    font-size: 3rem;
    margin-bottom: 0.5rem;
  }
  .subtitle {
    color: #aaa;
    margin-bottom: 2rem;
    font-size: 1.1rem;
  }
  .actions {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    width: 100%;
    max-width: 320px;
  }
  .btn-host {
    background: #6c5ce7;
    color: white;
    border: none;
    padding: 1rem;
    border-radius: 12px;
    font-size: 1.2rem;
    font-weight: 700;
    cursor: pointer;
  }
  .btn-host:hover { background: #5a4bd1; }
  .btn-join {
    background: #00b894;
    color: white;
    border: none;
    padding: 0.8rem;
    border-radius: 12px;
    font-size: 1rem;
    font-weight: 700;
    cursor: pointer;
  }
  .btn-join:hover { background: #00a381; }
  .input {
    padding: 0.8rem 1rem;
    border-radius: 10px;
    border: 2px solid #333;
    background: #1a1a2e;
    color: white;
    font-size: 1rem;
    text-align: center;
    text-transform: uppercase;
  }
  .input::placeholder { text-transform: none; }
  .divider {
    color: #666;
    font-size: 0.9rem;
    margin: 0.5rem 0;
  }
  .error {
    color: #ff6b6b;
    font-size: 0.9rem;
  }
</style>
