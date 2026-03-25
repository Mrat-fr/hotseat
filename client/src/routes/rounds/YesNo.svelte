<script>
  export let data;
  export let results = { yes: [], no: [] };
  export let reasons = [];
</script>

<div class="yesno">
  <div class="round-badge">Round {data.round}/{data.total} — Yes or No</div>
  <h2>{data.question}</h2>

  <div class="split">
    <div class="side yes-side">
      <div class="side-label">YES</div>
      <div class="names">
        {#each results.yes as name}
          <div class="name-tag yes-tag">{name}</div>
        {/each}
      </div>
    </div>

    <div class="divider"></div>

    <div class="side no-side">
      <div class="side-label">NO</div>
      <div class="names">
        {#each results.no as name}
          <div class="name-tag no-tag">{name}</div>
        {/each}
      </div>
    </div>
  </div>

  <!-- Floating reason messages -->
  {#each reasons as r}
    <div
      class="float-msg"
      class:float-yes={r.answer === 'yes'}
      class:float-no={r.answer === 'no'}
      style="left:{r.x}%; top:{r.y}%; animation-duration:{r.dur}s; animation-delay:{r.delay}s"
    >
      <span class="float-name">{r.name}</span>
      <span class="float-text">"{r.reason}"</span>
    </div>
  {/each}
</div>

<style>
  .yesno { text-align: center; width: 100%; position: relative; }
  .round-badge {
    background: #6c5ce7;
    display: inline-block;
    padding: 0.3rem 1rem;
    border-radius: 20px;
    font-size: 0.9rem;
    font-weight: 700;
    margin-bottom: 1.5rem;
  }
  h2 {
    font-size: 2rem;
    margin-bottom: 2rem;
    max-width: 600px;
    margin-left: auto;
    margin-right: auto;
    line-height: 1.3;
  }
  .split {
    display: flex;
    gap: 0;
    min-height: 220px;
    border-radius: 16px;
    overflow: hidden;
  }
  .side {
    flex: 1;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
  }
  .yes-side { background: rgba(0, 184, 148, 0.15); }
  .no-side  { background: rgba(255, 107, 107, 0.15); }
  .divider { width: 2px; background: #333; flex-shrink: 0; }
  .side-label {
    font-size: 1.8rem;
    font-weight: 900;
    letter-spacing: 0.1em;
  }
  .yes-side .side-label { color: #00b894; }
  .no-side  .side-label { color: #ff6b6b; }
  .names {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    width: 100%;
    align-items: center;
  }
  .name-tag {
    padding: 0.4rem 1rem;
    border-radius: 20px;
    font-weight: 600;
    font-size: 1rem;
    animation: pop 0.2s ease-out;
  }
  .yes-tag { background: rgba(0, 184, 148, 0.3); color: #00b894; }
  .no-tag  { background: rgba(255, 107, 107, 0.3); color: #ff6b6b; }

  /* Floating reason messages */
  .float-msg {
    position: fixed;
    max-width: 220px;
    padding: 0.6rem 0.9rem;
    border-radius: 12px;
    font-size: 0.85rem;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    pointer-events: none;
    animation: bob ease-in-out infinite alternate;
    z-index: 10;
  }
  .float-yes {
    background: rgba(0, 184, 148, 0.2);
    border: 1px solid rgba(0, 184, 148, 0.4);
    color: #00b894;
  }
  .float-no {
    background: rgba(255, 107, 107, 0.2);
    border: 1px solid rgba(255, 107, 107, 0.4);
    color: #ff6b6b;
  }
  .float-name { font-weight: 700; font-size: 0.75rem; opacity: 0.8; }
  .float-text { font-style: italic; line-height: 1.3; }

  @keyframes pop {
    from { transform: scale(0.7); opacity: 0; }
    to   { transform: scale(1);   opacity: 1; }
  }
  @keyframes bob {
    from { transform: translateY(0px) rotate(-1deg); }
    to   { transform: translateY(-18px) rotate(1deg); }
  }
</style>
