<script>
  import { onMount, onDestroy } from 'svelte';
  import socket from '../lib/socket.js';
  import { phase, roundData, scoreboard, myScore, reveal, debateState } from '../lib/store.js';

  let playerName = '';
  let joined = false;
  let error = '';
  let selectedAnswer = null;
  let submitted = false;
  let reason = '';
  let reasonSent = false;

  // Debate state
  let debateOptedIn = false;

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
    socket.on('debate-state', (s) => {
      // Reset opt-in flag when phase changes to lobby (new topic or new players)
      debateState.update(old => {
        if (old?.phase !== s.phase && s.phase === 'lobby') {
          debateOptedIn = false;
        }
        return s;
      });
    });
    socket.on('debate-timer', (t) => {
      debateState.update(s => s ? { ...s, timeLeft: t } : s);
    });
  });

  onDestroy(() => {
    socket.off('phase');
    socket.off('round-data');
    socket.off('scoreboard');
    socket.off('reveal');
    socket.off('debate-state');
    socket.off('debate-timer');
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

  function debateOptIn() {
    if (debateOptedIn) return;
    debateOptedIn = true;
    socket.emit('debate-opt-in');
  }

  function sendThumbsUp(side) {
    socket.emit('debate-thumbsup', { side });
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  $: isDebater = $debateState?.player1?.name === playerName || $debateState?.player2?.name === playerName;
  $: myDebateRole = $debateState?.player1?.name === playerName ? 'player1' : ($debateState?.player2?.name === playerName ? 'player2' : null);
  $: myStance = myDebateRole === 'player1' ? $debateState?.player1 : (myDebateRole === 'player2' ? $debateState?.player2 : null);
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

  {:else if $phase === 'debate'}
    <div class="question-screen">
      {#if !$debateState || $debateState.phase === 'lobby'}
        <!-- Opt-in screen (before topic is picked) -->
        <div class="fire-icon">🔥</div>
        <h2 class="hero-title sm">DEBATE DUEL</h2>
        <p class="debate-prompt">Ready to Debate? Check the box to enter the raffle!</p>
        {#if !debateOptedIn}
          <button class="debate-optin-btn" on:click={debateOptIn}>
            <span class="checkbox-icon">[ ]</span> I'M GAME!
          </button>
        {:else}
          <div class="debate-opted">
            <span class="checkbox-icon checked">[x]</span> YOU'RE IN THE RAFFLE!
          </div>
        {/if}
        <p class="opt-count">{$debateState?.optedIn?.length || 0} player{($debateState?.optedIn?.length || 0) !== 1 ? 's' : ''} opted in</p>

      {:else if $debateState.phase === 'grid'}
        <!-- Host is picking a topic -->
        <div class="fire-icon">🔥</div>
        <h2 class="hero-title sm">DEBATE DUEL</h2>
        <div class="debate-opted">
          <span class="checkbox-icon checked">[x]</span> YOU'RE IN!
        </div>
        <p class="waiting-text">Host is picking a topic...</p>
        <div class="pulse-ring"></div>

      {:else if $debateState.phase === 'match'}
        <!-- Players picked, no topic yet -->
        <h3 class="debate-heading">THE MATCHUP</h3>
        {#if isDebater}
          <div class="stance-reveal" class:pro-bg={myDebateRole === 'player1'} class:con-bg={myDebateRole === 'player2'}>
            <span class="stance-side">{myStance?.side}</span>
            <p class="stance-big">You're debating!</p>
          </div>
          <p class="waiting-text">Host is picking a topic...</p>
        {:else}
          <p class="debate-info">{$debateState.player1?.name} (PRO) vs {$debateState.player2?.name} (CON)</p>
          <p class="waiting-text">Host is picking a topic...</p>
        {/if}

      {:else if $debateState.phase === 'grid'}
        <!-- Host picking topic -->
        <h3 class="debate-heading">{$debateState.player1?.name} vs {$debateState.player2?.name}</h3>
        <p class="waiting-text">Host is picking a topic...</p>
        <div class="pulse-ring"></div>

      {:else if $debateState.phase === 'armed'}
        <!-- Topic assigned, about to duel -->
        <h3 class="debate-heading">GET READY!</h3>
        <div class="topic-badge-phone">{$debateState.currentTopic?.title}</div>
        {#if isDebater}
          <div class="stance-reveal" class:pro-bg={myDebateRole === 'player1'} class:con-bg={myDebateRole === 'player2'}>
            <span class="stance-side">{myStance?.side}</span>
            <p class="stance-big">"{myStance?.stance}"</p>
          </div>
        {:else}
          <p class="debate-info">{$debateState.player1?.name} (PRO) vs {$debateState.player2?.name} (CON)</p>
          <p class="waiting-text">Duel is about to begin!</p>
        {/if}

      {:else if $debateState.phase === 'duel'}
        <!-- During the duel -->
        <div class="phone-timer" class:timer-danger={$debateState.timeLeft <= 30}>
          <span class="phone-timer-digits">{formatTime($debateState.timeLeft)}</span>
        </div>
        {#if isDebater}
          <div class="stance-reveal compact" class:pro-bg={myDebateRole === 'player1'} class:con-bg={myDebateRole === 'player2'}>
            <span class="stance-side">{myStance?.side}</span>
            <p class="stance-big">"{myStance?.stance}"</p>
          </div>
        {:else}
          <!-- AUDIENCE: Two big thumbs-up buttons -->
          <div class="thumbs-buttons">
            <button class="thumb-btn pro-thumb" on:click={() => sendThumbsUp('player1')}>
              <span class="thumb-emoji">👍</span>
              <span class="thumb-name">{$debateState.player1?.name}</span>
            </button>
            <button class="thumb-btn con-thumb" on:click={() => sendThumbsUp('player2')}>
              <span class="thumb-emoji">👍</span>
              <span class="thumb-name">{$debateState.player2?.name}</span>
            </button>
          </div>
        {/if}

      {:else if $debateState.phase === 'result'}
        <!-- Results -->
        <h3 class="debate-heading">
          {#if $debateState.winner === 'TIE'}
            IT'S A TIE!
          {:else if $debateState.winner === playerName}
            YOU WON! +1000 PTS
          {:else}
            {$debateState.winner} WINS!
          {/if}
        </h3>
        <div class="result-summary">
          <span>{$debateState.player1?.name}: 👍 {$debateState.thumbsUp?.player1 || 0}</span>
          <span>{$debateState.player2?.name}: 👍 {$debateState.thumbsUp?.player2 || 0}</span>
        </div>
      {/if}
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

  /* ── Debate Phone Styles ── */
  .topic-badge-phone {
    background: var(--charcoal);
    border: 2px solid var(--accent-yellow);
    display: inline-block;
    padding: 0.3rem 1rem;
    border-radius: 6px;
    font-family: var(--font-hero);
    font-size: 1rem;
    letter-spacing: 0.1em;
    color: var(--accent-yellow);
    margin-bottom: 1rem;
  }
  .debate-prompt {
    font-family: var(--font-body);
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--cream);
    margin-bottom: 1.2rem;
    line-height: 1.4;
  }
  .debate-optin-btn {
    background: var(--accent-orange);
    color: var(--cream);
    border: 4px solid var(--charcoal);
    padding: 1.5rem 2rem;
    border-radius: 12px;
    font-family: var(--font-hero);
    font-size: 1.6rem;
    letter-spacing: 0.05em;
    cursor: pointer;
    box-shadow: 5px 5px 0 var(--charcoal);
    transition: transform 0.1s, box-shadow 0.1s;
    width: 100%;
  }
  .debate-optin-btn:active {
    transform: translate(3px, 3px);
    box-shadow: 2px 2px 0 var(--charcoal);
  }
  .checkbox-icon {
    font-family: var(--font-body);
    font-size: 1.4rem;
    margin-right: 0.3rem;
  }
  .checkbox-icon.checked { color: var(--yes-green); }
  .debate-opted {
    background: rgba(45, 147, 108, 0.25);
    border: 3px solid var(--yes-green);
    padding: 1.2rem;
    border-radius: 12px;
    font-family: var(--font-hero);
    font-size: 1.4rem;
    color: var(--yes-green);
    text-shadow: 1px 1px 0 var(--charcoal);
  }
  .opt-count {
    font-family: var(--font-comic);
    font-size: 1rem;
    color: var(--cream-dim);
    margin-top: 1rem;
  }
  .debate-heading {
    font-family: var(--font-hero);
    font-size: 2.2rem;
    color: var(--accent-yellow);
    text-shadow: 2px 2px 0 var(--charcoal);
    margin-bottom: 1.2rem;
    line-height: 1.1;
  }
  .debate-info {
    font-family: var(--font-body);
    font-weight: 700;
    font-size: 1rem;
    color: var(--cream);
    margin-top: 0.8rem;
  }
  .stance-reveal {
    padding: 1.5rem;
    border-radius: 12px;
    border: 4px solid var(--charcoal);
    margin-bottom: 1rem;
    box-shadow: 4px 4px 0 var(--charcoal);
  }
  .stance-reveal.compact { padding: 1rem; }
  .stance-reveal.pro-bg { background: rgba(45, 147, 108, 0.3); }
  .stance-reveal.con-bg { background: rgba(214, 64, 69, 0.3); }
  .stance-side {
    font-family: var(--font-hero);
    font-size: 1.4rem;
    letter-spacing: 0.15em;
    display: block;
    margin-bottom: 0.3rem;
  }
  .pro-bg .stance-side { color: var(--yes-green); }
  .con-bg .stance-side { color: var(--no-red); }
  .stance-big {
    font-family: var(--font-body);
    font-size: 1.3rem;
    font-weight: 700;
    color: var(--cream);
    line-height: 1.3;
    margin: 0;
  }
  .stance-reveal.compact .stance-big { font-size: 1.1rem; }

  /* Phone timer */
  .phone-timer {
    width: 140px;
    height: 140px;
    border-radius: 50%;
    border: 5px solid var(--accent-yellow);
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 1.2rem;
    background: rgba(0, 0, 0, 0.4);
    box-shadow: 0 0 25px rgba(242, 183, 5, 0.2);
    transition: border-color 0.3s;
  }
  .phone-timer.timer-danger {
    border-color: var(--no-red);
    box-shadow: 0 0 25px rgba(214, 64, 69, 0.4);
    animation: pulse 0.8s ease-in-out infinite;
  }
  .phone-timer-digits {
    font-family: var(--font-hero);
    font-size: 2.8rem;
    color: var(--cream);
    text-shadow: 2px 2px 0 var(--charcoal);
  }
  .phone-timer.timer-danger .phone-timer-digits { color: var(--no-red); }

  /* Thumbs-up spam buttons */
  .thumbs-buttons {
    display: flex;
    gap: 1rem;
    margin-top: 0.5rem;
  }
  .thumb-btn {
    flex: 1;
    padding: 1.5rem 0.5rem;
    border: 4px solid var(--charcoal);
    border-radius: 16px;
    cursor: pointer;
    box-shadow: 4px 4px 0 var(--charcoal);
    transition: transform 0.05s, box-shadow 0.05s;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
    -webkit-tap-highlight-color: transparent;
    user-select: none;
  }
  .thumb-btn:active {
    transform: translate(3px, 3px) scale(0.95);
    box-shadow: 1px 1px 0 var(--charcoal);
  }
  .pro-thumb { background: var(--yes-green); }
  .con-thumb { background: var(--no-red); }
  .thumb-emoji {
    font-size: 3.5rem;
    line-height: 1;
    filter: drop-shadow(0 2px 3px rgba(0,0,0,0.3));
  }
  .thumb-name {
    font-family: var(--font-hero);
    font-size: 1.3rem;
    color: var(--cream);
    text-shadow: 1px 1px 0 var(--charcoal);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  /* Result summary */
  .result-summary {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    font-family: var(--font-body);
    font-weight: 700;
    font-size: 1.1rem;
    color: var(--cream);
    margin-top: 0.5rem;
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
