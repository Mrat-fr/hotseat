<script>
  export let data;
  export let isHost = false;
</script>

<div class="creative">
  <div class="round-badge">Round {data.round}/{data.total} — Creative</div>
  <h2>{data.prompt}</h2>
  {#if isHost}
    <p class="hint">Players are typing their answers...</p>
  {/if}
</div>

<style>
  .creative { text-align: center; }
  .round-badge {
    background: #e17055;
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
    line-height: 1.4;
  }
  .hint {
    color: #aaa;
    margin-top: 2rem;
    font-style: italic;
  }
</style>
