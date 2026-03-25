<script>
  import { onMount, onDestroy } from 'svelte';
  import socket from '../lib/socket.js';
  import { phase, roundData, scoreboard, myScore, reveal, debateState, spectrumState } from '../lib/store.js';

  let playerName = '';
  let joined = false;
  let error = '';
  let selectedAnswer = null;
  let submitted = false;
  let reason = '';
  let reasonSent = false;

  // Stage 1 reasons feed (comments from other players)
  let reasonsFeed = [];

  // Debate state
  let debateOptedIn = false;

  // Spectrum state
  let spectrumStatements = [];
  let spectrumSelected = null; // index of chosen statement
  let spectrumSlider = 50;
  let spectrumSubmitted = false;
  let spectrumDefendChosen = false;
  let spectrumGuess = 50;
  let spectrumGuessSubmitted = false;

  onMount(() => {
    socket.on('phase', (p) => {
      phase.set(p);
      if (p === 'question') {
        selectedAnswer = null;
        submitted = false;
        reason = '';
        reasonSent = false;
        reasonsFeed = [];
      }
    });
    socket.on('yesno-reason', (r) => {
      reasonsFeed = [...reasonsFeed, { ...r, thumbedByMe: false }];
    });
    socket.on('yesno-thumbsup-update', ({ id, thumbsUp }) => {
      reasonsFeed = reasonsFeed.map(r => r.id === id ? { ...r, thumbsUp } : r);
    });
    socket.on('yesno-reasons-reset', () => {
      reasonsFeed = [];
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
    socket.on('spectrum-state', (s) => {
      spectrumState.update(old => {
        // Reset player-side state when picking phase starts
        if (old?.phase !== s.phase && s.phase === 'picking') {
          spectrumSelected = null;
          spectrumSlider = 50;
          spectrumSubmitted = false;
          spectrumDefendChosen = false;
        }
        // Reset guess state for each new speaker round
        if (old?.phase !== s.phase && (s.phase === 'guessing' || s.phase === 'speaker-reveal')) {
          spectrumGuess = 50;
          spectrumGuessSubmitted = false;
        }
        return s;
      });
    });
    socket.on('spectrum-timer', (t) => {
      spectrumState.update(s => s ? { ...s, timeLeft: t } : s);
    });
    socket.on('spectrum-your-statements', (stmts) => {
      spectrumStatements = stmts;
      spectrumSelected = null;
    });
  });

  onDestroy(() => {
    socket.off('phase');
    socket.off('round-data');
    socket.off('scoreboard');
    socket.off('reveal');
    socket.off('debate-state');
    socket.off('debate-timer');
    socket.off('spectrum-state');
    socket.off('spectrum-timer');
    socket.off('spectrum-your-statements');
    socket.off('yesno-reason');
    socket.off('yesno-thumbsup-update');
    socket.off('yesno-reasons-reset');
  });

  function join() {
    error = '';
    if (!playerName.trim()) { error = 'Enter your name'; return; }
    socket.emit('join-room', { name: playerName }, (res) => {
      if (res.error) { error = res.error; }
      else {
        joined = true;
        // Restore score immediately (important for reconnecting players)
        if (res.score) myScore.set(res.score);
      }
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

  function thumbsUpReason(reasonId) {
    const r = reasonsFeed.find(r => r.id === reasonId);
    if (!r || r.thumbedByMe || r.name === playerName) return;
    r.thumbedByMe = true;
    reasonsFeed = reasonsFeed;
    socket.emit('yesno-thumbsup', { reasonId });
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

  // Spectrum functions
  function spectrumReroll() {
    socket.emit('spectrum-reroll');
  }
  function spectrumSubmit() {
    if (spectrumSelected === null || spectrumSubmitted) return;
    spectrumSubmitted = true;
    socket.emit('spectrum-submit', {
      statement: spectrumStatements[spectrumSelected],
      value: Math.round(spectrumSlider),
    });
  }
  function spectrumDefend(willDefend) {
    if (spectrumDefendChosen) return;
    spectrumDefendChosen = true;
    socket.emit('spectrum-defend', { willDefend });
  }
  function spectrumSubmitGuess() {
    if (spectrumGuessSubmitted) return;
    spectrumGuessSubmitted = true;
    socket.emit('spectrum-guess', { value: Math.round(spectrumGuess) });
  }

  $: isSpeaker = $spectrumState?.currentSpeaker === playerName;

  $: isDebater = $debateState?.player1?.name === playerName || $debateState?.player2?.name === playerName;
  $: myDebateRole = $debateState?.player1?.name === playerName ? 'player1' : ($debateState?.player2?.name === playerName ? 'player2' : null);
  $: myStance = myDebateRole === 'player1' ? $debateState?.player1 : (myDebateRole === 'player2' ? $debateState?.player2 : null);
</script>

<div class="phone">
  {#if joined}
    <div class="score-bar">
      <span class="score-bar-name">{playerName}</span>
      <span class="score-bar-divider">·</span>
      <span class="score-bar-pts">{$myScore}</span>
      <span class="score-bar-label">PTS</span>
    </div>
  {/if}
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

  {:else if $phase === 'waiting'}
    <div class="waiting-screen">
      <div class="fire-icon">🔥</div>
      <h2 class="hero-title sm">YOU'RE IN!</h2>
      <p class="waiting-text">Waiting on host to start the next round...</p>
      <div class="pulse-ring"></div>
    </div>

  {:else if $phase === 'title1'}
    <div class="title-screen">
      <div class="fire-icon">🔥</div>
      <h2 class="hero-title">FANNING THE FLAMES</h2>
      <p class="title-stage">STAGE 1</p>
      <p class="title-desc">A series of hot-take YES or NO questions. Pick your side and defend your opinion!</p>
    </div>

  {:else if $phase === 'title2'}
    <div class="title-screen">
      <div class="fire-icon">🎤</div>
      <h2 class="hero-title">THE HOT MIC DUEL</h2>
      <p class="title-stage">STAGE 2</p>
      <p class="title-desc">Two players go head-to-head in a live debate! The audience votes with thumbs-up to crown the winner.</p>
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
          {#if reasonsFeed.filter(r => r.name !== playerName).length > 0}
            <div class="reasons-feed">
              <p class="feed-label">HOT TAKES</p>
              {#each reasonsFeed.filter(r => r.name !== playerName) as r (r.id)}
                <div class="feed-card" class:feed-yes={r.answer === 'yes'} class:feed-no={r.answer === 'no'}>
                  <div class="feed-top">
                    <span class="feed-name">{r.name}</span>
                    <span class="feed-vote">{r.answer === 'yes' ? 'YES' : 'NO'}</span>
                  </div>
                  <p class="feed-reason">"{r.reason}"</p>
                  <button
                    class="feed-thumb"
                    class:feed-thumb-done={r.thumbedByMe}
                    on:click={() => thumbsUpReason(r.id)}
                    disabled={r.thumbedByMe}
                  >
                    👍 {r.thumbsUp > 0 ? r.thumbsUp : ''}
                  </button>
                </div>
              {/each}
            </div>
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
      {#if reasonsFeed.filter(r => r.name !== playerName).length > 0}
        <div class="reasons-feed">
          <p class="feed-label">HOT TAKES</p>
          {#each reasonsFeed.filter(r => r.name !== playerName) as r (r.id)}
            <div class="feed-card" class:feed-yes={r.answer === 'yes'} class:feed-no={r.answer === 'no'}>
              <div class="feed-top">
                <span class="feed-name">{r.name}</span>
                <span class="feed-vote">{r.answer === 'yes' ? 'YES' : 'NO'}</span>
              </div>
              <p class="feed-reason">"{r.reason}"</p>
              <button
                class="feed-thumb"
                class:feed-thumb-done={r.thumbedByMe}
                on:click={() => thumbsUpReason(r.id)}
                disabled={r.thumbedByMe}
              >
                👍 {r.thumbsUp > 0 ? r.thumbsUp : ''}
              </button>
            </div>
          {/each}
        </div>
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
      {#if !$debateState || $debateState.phase === 'title'}
        <!-- Title screen -->
        <div class="fire-icon">🎤</div>
        <h2 class="hero-title sm">THE HOT MIC DUEL</h2>
        <p class="title-stage">STAGE 2</p>
        <p class="title-desc">Two players debate head-to-head while the audience votes with thumbs-up!</p>

      {:else if $debateState.phase === 'lobby'}
        <!-- Opt-in screen (before topic is picked) -->
        <div class="fire-icon">🔥</div>
        <h2 class="hero-title sm">THE HOT MIC DUEL</h2>
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
        <h2 class="hero-title sm">THE HOT MIC DUEL</h2>
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
            <span class="stance-side">{myDebateRole === 'player1' ? 'PLAYER 1' : 'PLAYER 2'}</span>
            <p class="stance-big">You're debating!</p>
          </div>
          <p class="waiting-text">Host is picking a topic...</p>
        {:else}
          <p class="debate-info">{$debateState.player1?.name} vs {$debateState.player2?.name}</p>
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
            <span class="stance-side">{myDebateRole === 'player1' ? 'PLAYER 1' : 'PLAYER 2'}</span>
            <p class="stance-big">"{myStance?.stance}"</p>
          </div>
        {:else}
          <p class="debate-info">{$debateState.player1?.name} vs {$debateState.player2?.name}</p>
          <p class="waiting-text">Duel is about to begin!</p>
        {/if}

      {:else if $debateState.phase === 'duel'}
        <!-- During the duel -->
        <div class="phone-timer" class:timer-danger={$debateState.timeLeft <= 30}>
          <span class="phone-timer-digits">{formatTime($debateState.timeLeft)}</span>
        </div>
        {#if isDebater}
          <div class="stance-reveal compact" class:pro-bg={myDebateRole === 'player1'} class:con-bg={myDebateRole === 'player2'}>
            <span class="stance-side">{myDebateRole === 'player1' ? 'PLAYER 1' : 'PLAYER 2'}</span>
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

  {:else if $phase === 'title3'}
    <div class="title-screen">
      <div class="fire-icon">🎯</div>
      <h2 class="hero-title">THE SPECTRUM</h2>
      <p class="title-stage">STAGE 3</p>
      <p class="title-desc">Pick a statement, rate it, and see if anyone can guess your answer!</p>
    </div>

  {:else if $phase === 'spectrum'}
    <div class="question-screen">
      {#if !$spectrumState || $spectrumState.phase === 'title'}
        <!-- Title screen -->
        <div class="fire-icon">🎯</div>
        <h2 class="hero-title sm">THE SPECTRUM</h2>
        <p class="title-stage">STAGE 3</p>
        <p class="title-desc">Pick a statement, rate it on a slider, and see if anyone can guess your answer!</p>

      {:else if $spectrumState.phase === 'picking' && !spectrumSubmitted}
        <!-- PHASE 1: Statement selection + slider -->
        <h3 class="spectrum-heading">PICK A STATEMENT</h3>
        <div class="statement-choices">
          {#each spectrumStatements as stmt, i}
            <button
              class="stmt-card"
              class:stmt-selected={spectrumSelected === i}
              on:click={() => spectrumSelected = i}
            >
              {stmt}
            </button>
          {/each}
        </div>
        <button class="reroll-btn" on:click={spectrumReroll}>🔀 REROLL</button>

        {#if spectrumSelected !== null}
          <div class="slider-section">
            <p class="slider-label">How much do you agree?</p>
            <div class="slider-track-container">
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                bind:value={spectrumSlider}
                class="spectrum-slider"
              />
              <div class="slider-value-display">{Math.round(spectrumSlider)}%</div>
            </div>
            <div class="slider-labels">
              <span>0% DISAGREE</span>
              <span>100% AGREE</span>
            </div>
            <button class="btn-submit-spectrum" on:click={spectrumSubmit}>
              LOCK IT IN 🔒
            </button>
          </div>
        {/if}

      {:else if $spectrumState.phase === 'picking' && spectrumSubmitted && !spectrumDefendChosen}
        <!-- PHASE 1: Defend opt-in -->
        <div class="defend-prompt">
          <h3 class="spectrum-heading">WANT TO DEFEND THIS?</h3>
          <p class="defend-desc">If you say YES, you could be picked as the Speaker and everyone guesses YOUR answer.</p>
          <div class="defend-buttons">
            <button class="defend-btn defend-yes" on:click={() => spectrumDefend(true)}>
              YES, I'M IN 🎤
            </button>
            <button class="defend-btn defend-no" on:click={() => spectrumDefend(false)}>
              NO, I'LL WATCH 👀
            </button>
          </div>
        </div>

      {:else if $spectrumState.phase === 'picking' && spectrumSubmitted && spectrumDefendChosen}
        <!-- PHASE 1: Waiting for host -->
        <div class="waiting-screen-inner">
          <div class="fire-icon">✅</div>
          <h3 class="spectrum-heading">LOCKED IN!</h3>
          <p class="waiting-text">Waiting for Host...</p>
          <div class="pulse-ring"></div>
        </div>

      {:else if $spectrumState.phase === 'speaker-reveal'}
        <!-- Speaker reveal -->
        {#if isSpeaker}
          <div class="speaker-you">
            <div class="fire-icon">🎤</div>
            <h3 class="spectrum-heading">YOU ARE THE SPEAKER!</h3>
            <p class="speaker-you-desc">Watch them sweat.</p>
          </div>
        {:else}
          <h3 class="spectrum-heading">THE SPEAKER</h3>
          <div class="speaker-reveal-name">{$spectrumState.currentSpeaker}</div>
          <p class="waiting-text">Get ready to guess...</p>
        {/if}

      {:else if $spectrumState.phase === 'guessing'}
        <!-- Guessing phase -->
        {#if isSpeaker}
          <div class="speaker-you">
            <div class="phone-timer" class:timer-danger={$spectrumState.timeLeft <= 30}>
              <span class="phone-timer-digits">{formatTime($spectrumState.timeLeft)}</span>
            </div>
            <h3 class="spectrum-heading">YOU ARE THE SPEAKER!</h3>
            <p class="speaker-you-desc">Watch them sweat. 😈</p>
          </div>
        {:else}
          <!-- Audience: guess the slider -->
          <div class="phone-timer" class:timer-danger={$spectrumState.timeLeft <= 30}>
            <span class="phone-timer-digits">{formatTime($spectrumState.timeLeft)}</span>
          </div>
          <div class="guess-statement">
            <p class="guess-stmt-text">"{$spectrumState.currentStatement}"</p>
          </div>
          <p class="guess-prompt">Where did <strong>{$spectrumState.currentSpeaker}</strong> place their slider?</p>
          {#if !spectrumGuessSubmitted}
            <div class="slider-section">
              <div class="slider-track-container">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  bind:value={spectrumGuess}
                  class="spectrum-slider"
                />
                <div class="slider-value-display">{Math.round(spectrumGuess)}%</div>
              </div>
              <div class="slider-labels">
                <span>0% DISAGREE</span>
                <span>100% AGREE</span>
              </div>
              <button class="btn-submit-spectrum" on:click={spectrumSubmitGuess}>
                SUBMIT GUESS 🎯
              </button>
            </div>
          {:else}
            <div class="guess-locked">
              <span class="guess-locked-value">{Math.round(spectrumGuess)}%</span>
              <span class="guess-locked-label">GUESS LOCKED IN ✓</span>
            </div>
          {/if}
        {/if}

      {:else if $spectrumState.phase === 'results'}
        <!-- Results on phone -->
        <h3 class="spectrum-heading">THE ANSWER</h3>
        <div class="result-answer-badge">{$spectrumState.speakerValue}%</div>
        {#if $spectrumState.scores && $spectrumState.scores[playerName]}
          <div class="my-result">
            <span class="my-result-label">Your guess: {$spectrumState.scores[playerName].guess}%</span>
            <span class="my-result-dist">{$spectrumState.scores[playerName].distance}% off</span>
            <span class="my-result-pts">+{$spectrumState.scores[playerName].points} PTS</span>
            {#if $spectrumState.scores[playerName].perfect}
              <span class="perfect-badge">👑 PERFECT MATCH!</span>
            {/if}
          </div>
        {:else if isSpeaker}
          <p class="speaker-you-desc">You were the Speaker this round!</p>
        {:else}
          <p class="waiting-text">No guess submitted</p>
        {/if}

      {:else if $spectrumState.phase === 'done'}
        <div class="fire-icon">🎯</div>
        <h3 class="spectrum-heading">ALL SPEAKERS DONE!</h3>
        <p class="waiting-text">Waiting for final scores...</p>
      {/if}
    </div>

  {:else if $phase === 'gameover'}
    <div class="score-screen">
      <div class="fire-icon">🏆</div>
      <h2 class="hero-title sm">GAME OVER</h2>
      {#if $scoreboard.length > 0 && $scoreboard[0].name === playerName}
        <p class="winner-me">👑 YOU WON! 👑</p>
      {:else if $scoreboard.length > 0}
        <p class="winner-label-phone">Winner: <strong>{$scoreboard[0].name}</strong> — {$scoreboard[0].score} PTS</p>
      {/if}
      <div class="score-circle final">
        <span class="my-score">{$myScore}</span>
        <span class="pts-label">PTS</span>
      </div>
      <p class="total-pts-label">YOUR TOTAL</p>
      <div class="phone-scoreboard">
        {#each $scoreboard as entry, i}
          <div class="phone-score-row" class:phone-first={i === 0} class:phone-me={entry.name === playerName}>
            <span class="phone-rank">
              {#if i === 0}👑{:else if i === 1}🥈{:else if i === 2}🥉{:else}#{i + 1}{/if}
            </span>
            <span class="phone-sname">{entry.name}</span>
            <span class="phone-spts">{entry.score}</span>
          </div>
        {/each}
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
    padding-top: 3.5rem;
  }

  /* ── Persistent Score Bar ── */
  .score-bar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.3rem;
    padding: 0.4rem 0;
    background: rgba(0, 0, 0, 0.6);
    border-bottom: 2px solid var(--accent-yellow);
    z-index: 100;
    backdrop-filter: blur(6px);
  }
  .score-bar-name {
    font-family: var(--font-hero);
    font-size: 0.85rem;
    color: var(--cream-dim);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    max-width: 100px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .score-bar-divider {
    color: var(--cream-dim);
    opacity: 0.4;
    font-size: 1rem;
  }
  .score-bar-pts {
    font-family: var(--font-hero);
    font-size: 1.3rem;
    color: var(--accent-yellow);
    text-shadow: 1px 1px 0 var(--charcoal);
  }
  .score-bar-label {
    font-family: var(--font-hero);
    font-size: 0.8rem;
    color: var(--cream-dim);
    letter-spacing: 0.15em;
  }
  .join-screen, .waiting-screen, .question-screen, .score-screen, .gameover-screen, .title-screen {
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
  .title-stage {
    font-family: var(--font-hero);
    font-size: 1.1rem;
    color: var(--accent-orange);
    letter-spacing: 0.3em;
    margin-bottom: 1rem;
  }
  .title-desc {
    font-family: var(--font-comic);
    font-size: 1.1rem;
    color: var(--cream);
    line-height: 1.5;
  }

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

  /* ── Spectrum Phone Styles ── */
  .spectrum-heading {
    font-family: var(--font-hero);
    font-size: 2rem;
    color: var(--accent-yellow);
    text-shadow: 2px 2px 0 var(--charcoal);
    margin-bottom: 1rem;
    line-height: 1.1;
  }
  .statement-choices {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    margin-bottom: 0.75rem;
  }
  .stmt-card {
    background: rgba(0, 0, 0, 0.3);
    border: 3px solid var(--charcoal);
    border-radius: 10px;
    padding: 0.9rem 1rem;
    font-family: var(--font-body);
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--cream);
    text-align: left;
    cursor: pointer;
    line-height: 1.3;
    box-shadow: 3px 3px 0 var(--charcoal);
    transition: transform 0.1s, box-shadow 0.1s, border-color 0.15s, background 0.15s;
  }
  .stmt-card:active {
    transform: translate(2px, 2px);
    box-shadow: 1px 1px 0 var(--charcoal);
  }
  .stmt-card.stmt-selected {
    border-color: var(--accent-yellow);
    background: rgba(242, 183, 5, 0.15);
    box-shadow: 0 0 12px rgba(242, 183, 5, 0.2);
  }
  .reroll-btn {
    background: transparent;
    color: var(--cream-dim);
    border: 2px solid var(--cream-dim);
    padding: 0.5rem 1.5rem;
    border-radius: 8px;
    font-family: var(--font-hero);
    font-size: 1rem;
    cursor: pointer;
    margin-bottom: 1rem;
    transition: color 0.15s, border-color 0.15s;
  }
  .reroll-btn:hover {
    color: var(--cream);
    border-color: var(--cream);
  }
  .reroll-btn:active {
    transform: translate(1px, 1px);
  }
  .slider-section {
    margin-top: 1rem;
  }
  .slider-label {
    font-family: var(--font-body);
    font-weight: 700;
    font-size: 1rem;
    color: var(--cream);
    margin-bottom: 0.5rem;
  }
  .slider-track-container {
    position: relative;
    padding: 0.5rem 0;
  }
  .spectrum-slider {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 16px;
    border-radius: 8px;
    background: linear-gradient(90deg, var(--no-red), var(--accent-yellow), var(--yes-green));
    outline: none;
    border: 3px solid var(--charcoal);
  }
  .spectrum-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--cream);
    border: 4px solid var(--charcoal);
    cursor: pointer;
    box-shadow: 2px 2px 0 var(--charcoal);
  }
  .spectrum-slider::-moz-range-thumb {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--cream);
    border: 4px solid var(--charcoal);
    cursor: pointer;
    box-shadow: 2px 2px 0 var(--charcoal);
  }
  .slider-value-display {
    font-family: var(--font-hero);
    font-size: 2.5rem;
    color: var(--accent-yellow);
    text-shadow: 2px 2px 0 var(--charcoal);
    margin-top: 0.25rem;
  }
  .slider-labels {
    display: flex;
    justify-content: space-between;
    font-family: var(--font-body);
    font-size: 0.7rem;
    color: var(--cream-dim);
    font-weight: 700;
    letter-spacing: 0.03em;
    margin-top: 0.25rem;
    margin-bottom: 0.75rem;
  }
  .btn-submit-spectrum {
    background: var(--accent-orange);
    color: var(--cream);
    border: 4px solid var(--charcoal);
    padding: 1.2rem 2rem;
    border-radius: 12px;
    font-family: var(--font-hero);
    font-size: 1.4rem;
    letter-spacing: 0.05em;
    cursor: pointer;
    box-shadow: 5px 5px 0 var(--charcoal);
    transition: transform 0.1s, box-shadow 0.1s;
    width: 100%;
    text-shadow: 1px 1px 0 var(--charcoal);
  }
  .btn-submit-spectrum:active {
    transform: translate(3px, 3px);
    box-shadow: 2px 2px 0 var(--charcoal);
  }

  /* Defend prompt */
  .defend-prompt { text-align: center; }
  .defend-desc {
    font-family: var(--font-comic);
    font-size: 1rem;
    color: var(--cream-dim);
    margin-bottom: 1.2rem;
    line-height: 1.4;
  }
  .defend-buttons {
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
  }
  .defend-btn {
    padding: 1.5rem;
    border: 4px solid var(--charcoal);
    border-radius: 12px;
    font-family: var(--font-hero);
    font-size: 1.5rem;
    cursor: pointer;
    box-shadow: 5px 5px 0 var(--charcoal);
    transition: transform 0.1s, box-shadow 0.1s;
    text-shadow: 1px 1px 0 var(--charcoal);
  }
  .defend-btn:active {
    transform: translate(3px, 3px);
    box-shadow: 2px 2px 0 var(--charcoal);
  }
  .defend-yes {
    background: var(--yes-green);
    color: var(--cream);
  }
  .defend-no {
    background: rgba(0, 0, 0, 0.3);
    color: var(--cream-dim);
    border-color: var(--cream-dim);
    text-shadow: none;
  }

  /* Waiting screen inner */
  .waiting-screen-inner { text-align: center; }

  /* Speaker you */
  .speaker-you { text-align: center; }
  .speaker-you-desc {
    font-family: var(--font-comic);
    font-size: 1.3rem;
    color: var(--cream-dim);
    font-style: italic;
    margin-top: 0.5rem;
  }
  .speaker-reveal-name {
    font-family: var(--font-hero);
    font-size: 3rem;
    color: var(--accent-yellow);
    text-shadow: 2px 2px 0 var(--charcoal);
    text-transform: uppercase;
    animation: pop 0.5s ease-out;
    margin-bottom: 0.5rem;
  }

  /* Guessing */
  .guess-statement {
    background: rgba(0, 0, 0, 0.3);
    border: 3px solid var(--charcoal);
    border-radius: 12px;
    padding: 1rem;
    margin: 0.75rem 0;
  }
  .guess-stmt-text {
    font-family: var(--font-comic);
    font-size: 1.1rem;
    color: var(--cream);
    font-style: italic;
    line-height: 1.3;
    margin: 0;
  }
  .guess-prompt {
    font-family: var(--font-body);
    font-size: 1rem;
    color: var(--cream);
    margin-bottom: 0.5rem;
  }
  .guess-prompt strong {
    color: var(--accent-yellow);
  }
  .guess-locked {
    background: rgba(45, 147, 108, 0.25);
    border: 3px solid var(--yes-green);
    padding: 1.5rem;
    border-radius: 12px;
    margin-top: 1rem;
    text-align: center;
  }
  .guess-locked-value {
    font-family: var(--font-hero);
    font-size: 3rem;
    color: var(--accent-yellow);
    text-shadow: 2px 2px 0 var(--charcoal);
    display: block;
  }
  .guess-locked-label {
    font-family: var(--font-hero);
    font-size: 1.2rem;
    color: var(--yes-green);
    letter-spacing: 0.1em;
  }

  /* Results on phone */
  .result-answer-badge {
    font-family: var(--font-hero);
    font-size: 4rem;
    color: var(--accent-yellow);
    text-shadow: 3px 3px 0 var(--charcoal);
    animation: pop 0.5s ease-out;
    margin: 0.5rem 0;
  }
  .my-result {
    background: rgba(0, 0, 0, 0.3);
    border: 3px solid var(--charcoal);
    border-radius: 12px;
    padding: 1.2rem;
    margin-top: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    text-align: center;
  }
  .my-result-label {
    font-family: var(--font-body);
    font-size: 1rem;
    color: var(--cream);
    font-weight: 700;
  }
  .my-result-dist {
    font-family: var(--font-body);
    font-size: 0.9rem;
    color: var(--accent-orange);
    font-weight: 700;
  }
  .my-result-pts {
    font-family: var(--font-hero);
    font-size: 2rem;
    color: var(--accent-yellow);
    text-shadow: 1px 1px 0 var(--charcoal);
  }
  .perfect-badge {
    font-family: var(--font-hero);
    font-size: 1.3rem;
    color: var(--accent-yellow);
    animation: pop 0.5s ease-out;
  }

  /* ── Reasons Feed (Stage 1 thumbs-up) ── */
  .reasons-feed {
    margin-top: 1.2rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .feed-label {
    font-family: var(--font-hero);
    font-size: 1rem;
    color: var(--accent-orange);
    letter-spacing: 0.15em;
    margin-bottom: 0.2rem;
  }
  .feed-card {
    background: rgba(0, 0, 0, 0.3);
    border: 2px solid var(--charcoal);
    border-radius: 10px;
    padding: 0.6rem 0.8rem;
    text-align: left;
  }
  .feed-card.feed-yes { border-left: 4px solid var(--yes-green); }
  .feed-card.feed-no  { border-left: 4px solid var(--no-red); }
  .feed-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.2rem;
  }
  .feed-name {
    font-family: var(--font-body);
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--cream-dim);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .feed-vote {
    font-family: var(--font-hero);
    font-size: 0.7rem;
    letter-spacing: 0.1em;
  }
  .feed-yes .feed-vote { color: var(--yes-green); }
  .feed-no .feed-vote  { color: var(--no-red); }
  .feed-reason {
    font-family: var(--font-comic);
    font-size: 0.95rem;
    color: var(--cream);
    line-height: 1.3;
    margin: 0 0 0.4rem 0;
  }
  .feed-thumb {
    background: rgba(255, 255, 255, 0.08);
    border: 2px solid var(--charcoal);
    border-radius: 6px;
    padding: 0.3rem 0.8rem;
    font-size: 0.9rem;
    cursor: pointer;
    color: var(--cream);
    transition: background 0.15s, transform 0.1s;
  }
  .feed-thumb:active {
    transform: scale(0.95);
  }
  .feed-thumb-done {
    background: rgba(45, 147, 108, 0.25);
    border-color: var(--yes-green);
    cursor: default;
  }

  /* ── Phone Game Over Scoreboard ── */
  .winner-me {
    font-family: var(--font-hero);
    font-size: 2rem;
    color: var(--accent-yellow);
    text-shadow: 2px 2px 0 var(--charcoal);
    letter-spacing: 0.1em;
    animation: pop 0.5s ease-out;
  }
  .winner-label-phone {
    font-family: var(--font-body);
    font-size: 1rem;
    color: var(--cream-dim);
    margin-bottom: 0.25rem;
  }
  .winner-label-phone strong {
    color: var(--accent-yellow);
  }
  .total-pts-label {
    font-family: var(--font-hero);
    font-size: 0.8rem;
    color: var(--cream-dim);
    letter-spacing: 0.2em;
    margin-top: -0.75rem;
    margin-bottom: 0.75rem;
  }
  .phone-scoreboard {
    margin: 1rem 0;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .phone-score-row {
    display: flex;
    align-items: center;
    padding: 0.5rem 0.8rem;
    background: rgba(0, 0, 0, 0.3);
    border: 2px solid var(--charcoal);
    border-radius: 8px;
    font-family: var(--font-body);
    font-size: 0.95rem;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--cream);
  }
  .phone-score-row.phone-first {
    background: var(--accent-yellow);
    color: var(--charcoal);
    border-color: var(--charcoal);
    font-weight: 900;
    box-shadow: 3px 3px 0 var(--charcoal);
  }
  .phone-score-row.phone-me:not(.phone-first) {
    border-color: var(--accent-yellow);
    background: rgba(242, 183, 5, 0.12);
  }
  .phone-rank {
    min-width: 2rem;
    text-align: left;
  }
  .phone-sname {
    flex: 1;
    text-align: left;
    margin-left: 0.3rem;
  }
  .phone-spts {
    font-family: var(--font-hero);
    font-size: 1.1rem;
    letter-spacing: 0.05em;
  }
  .phone-first .phone-spts { color: var(--charcoal); }

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
  @keyframes pop {
    from { transform: scale(0.7); opacity: 0; }
    to   { transform: scale(1);   opacity: 1; }
  }
</style>
