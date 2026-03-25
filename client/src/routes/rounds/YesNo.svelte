<script>
  export let data;
  export let results = { yes: [], no: [] };
  export let reasons = [];
</script>

<div class="yesno">
  <div class="round-badge">ROUND {data.round}/{data.total} — YES OR NO</div>
  <h2 class="question">{data.question}</h2>

  <div class="split">
    <div class="side yes-side">
      <div class="side-label">YES</div>
      <div class="side-count">{results.yes.length}</div>
      <div class="names">
        {#each results.yes as name}
          <div class="name-tag yes-tag">{name}</div>
        {/each}
      </div>
    </div>

    <div class="divider">
      <span class="vs">VS</span>
    </div>

    <div class="side no-side">
      <div class="side-label">NO</div>
      <div class="side-count">{results.no.length}</div>
      <div class="names">
        {#each results.no as name}
          <div class="name-tag no-tag">{name}</div>
        {/each}
      </div>
    </div>
  </div>

  <!-- Floating speech bubble reasons (contained area so they don't cover buttons) -->
  {#if reasons.length > 0}
    <div class="bubbles-container">
      {#each reasons as r}
        <div
          class="speech-bubble"
          class:bubble-yes={r.answer === 'yes'}
          class:bubble-no={r.answer === 'no'}
          style="left:{r.x}%; top:{r.y}%; animation-duration:{r.dur}s; animation-delay:{r.delay}s"
        >
          <span class="bubble-name">{r.name}</span>
          <span class="bubble-text">"{r.reason}"</span>
          <div class="bubble-tail" class:tail-yes={r.answer === 'yes'} class:tail-no={r.answer === 'no'}></div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .yesno {
    text-align: center;
    width: 100%;
    position: relative;
  }
  .round-badge {
    background: var(--charcoal);
    border: 2px solid var(--accent-yellow);
    display: inline-block;
    padding: 0.35rem 1.2rem;
    border-radius: 6px;
    font-family: var(--font-hero);
    font-size: 1rem;
    letter-spacing: 0.1em;
    color: var(--accent-yellow);
    margin-bottom: 1.5rem;
  }
  .question {
    font-family: var(--font-body);
    font-size: 2rem;
    font-weight: 900;
    margin-bottom: 2rem;
    max-width: 600px;
    margin-left: auto;
    margin-right: auto;
    line-height: 1.3;
    color: var(--cream);
    text-transform: uppercase;
  }

  /* ── Split view ── */
  .split {
    display: flex;
    gap: 0;
    min-height: 240px;
    border-radius: 12px;
    overflow: hidden;
    border: 3px solid var(--charcoal);
    box-shadow: 6px 6px 0 var(--charcoal);
  }
  .side {
    flex: 1;
    padding: 1.5rem 1rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.6rem;
  }
  .yes-side { background: rgba(45, 147, 108, 0.2); }
  .no-side  { background: rgba(214, 64, 69, 0.2); }
  .divider {
    width: 4px;
    background: var(--charcoal);
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }
  .vs {
    position: absolute;
    background: var(--charcoal);
    color: var(--accent-yellow);
    font-family: var(--font-hero);
    font-size: 1.2rem;
    padding: 0.4rem 0.6rem;
    border-radius: 6px;
    border: 2px solid var(--accent-yellow);
    z-index: 2;
  }
  .side-label {
    font-family: var(--font-hero);
    font-size: 2.2rem;
    letter-spacing: 0.1em;
    text-shadow: 2px 2px 0 var(--charcoal);
  }
  .yes-side .side-label { color: var(--yes-green); }
  .no-side  .side-label { color: var(--no-red); }
  .side-count {
    font-family: var(--font-hero);
    font-size: 3rem;
    line-height: 1;
    color: var(--cream);
    text-shadow: 2px 2px 0 var(--charcoal);
  }
  .names {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    width: 100%;
    align-items: center;
    margin-top: 0.5rem;
  }
  .name-tag {
    padding: 0.35rem 1rem;
    border-radius: 6px;
    font-family: var(--font-body);
    font-weight: 700;
    font-size: 0.95rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border: 2px solid var(--charcoal);
    animation: pop 0.3s ease-out;
  }
  .yes-tag {
    background: rgba(45, 147, 108, 0.35);
    color: var(--cream);
    border-color: var(--yes-green);
  }
  .no-tag {
    background: rgba(214, 64, 69, 0.35);
    color: var(--cream);
    border-color: var(--no-red);
  }

  /* ── Speech bubble floating reasons ── */
  .bubbles-container {
    position: relative;
    width: 100%;
    min-height: 180px;
    margin-top: 1.5rem;
    pointer-events: none;
  }
  .speech-bubble {
    position: absolute;
    max-width: 220px;
    padding: 0.7rem 1rem;
    border-radius: 16px;
    border: 3px solid var(--charcoal);
    font-family: var(--font-comic);
    font-size: 0.9rem;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    pointer-events: none;
    animation: float ease-in-out infinite alternate;
    z-index: 10;
    box-shadow: 3px 3px 0 var(--charcoal);
  }
  .bubble-yes {
    background: var(--yes-green);
    color: var(--cream);
  }
  .bubble-no {
    background: var(--no-red);
    color: var(--cream);
  }
  .bubble-name {
    font-weight: 700;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    opacity: 0.85;
  }
  .bubble-text {
    font-style: italic;
    line-height: 1.3;
  }

  /* Speech bubble tail */
  .bubble-tail {
    position: absolute;
    bottom: -10px;
    left: 20px;
    width: 0;
    height: 0;
    border-left: 10px solid transparent;
    border-right: 4px solid transparent;
  }
  .tail-yes { border-top: 12px solid var(--yes-green); }
  .tail-no  { border-top: 12px solid var(--no-red); }

  /* ── Animations ── */
  @keyframes pop {
    from { transform: scale(0.7) rotate(-3deg); opacity: 0; }
    to   { transform: scale(1)   rotate(0deg);  opacity: 1; }
  }
  @keyframes float {
    from { transform: translateY(0px) rotate(-2deg); }
    to   { transform: translateY(-20px) rotate(2deg); }
  }
</style>
