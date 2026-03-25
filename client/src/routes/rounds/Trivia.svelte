<script>
  export let data;
  export let isHost = false;
</script>

<div class="trivia">
  <div class="round-badge">Round {data.round}/{data.total} — Trivia</div>
  <h2>{data.question}</h2>
  {#if isHost}
    <div class="options-grid">
      {#each data.options as opt, i}
        <div class="option-display">{opt}</div>
      {/each}
    </div>
    <p class="hint">Players are answering on their phones...</p>
  {/if}
</div>

<style>
  .trivia { text-align: center; }
  .round-badge {
    background: #6c5ce7;
    display: inline-block;
    padding: 0.3rem 1rem;
    border-radius: 20px;
    font-size: 0.9rem;
    font-weight: 700;
    margin-bottom: 1.5rem;
  }
  h2 { font-size: 2rem; margin-bottom: 2rem; }
  .options-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    max-width: 500px;
    margin: 0 auto;
  }
  .option-display {
    background: #1a1a2e;
    padding: 1.5rem;
    border-radius: 12px;
    font-size: 1.2rem;
    font-weight: 600;
  }
  .hint {
    color: #aaa;
    margin-top: 2rem;
    font-style: italic;
  }
</style>
