<script>
  export let data;
  export let isHost = false;
</script>

<div class="draw">
  <div class="round-badge">Round {data.round}/{data.total} — Draw</div>
  <h2>🎨 {data.prompt}</h2>
  {#if isHost}
    <p class="hint">Players are drawing on their phones...</p>
  {/if}
</div>

<style>
  .draw { text-align: center; }
  .round-badge {
    background: #00cec9;
    display: inline-block;
    padding: 0.3rem 1rem;
    border-radius: 20px;
    font-size: 0.9rem;
    font-weight: 700;
    margin-bottom: 1.5rem;
  }
  h2 {
    font-size: 1.8rem;
    max-width: 500px;
    margin: 0 auto;
  }
  .hint {
    color: #aaa;
    margin-top: 2rem;
    font-style: italic;
  }
</style>
