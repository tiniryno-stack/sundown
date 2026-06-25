/* Sundown — fixture data + PlayerView builder.
   Fixtures are the real PlayerView payloads from the backend (seed "fixtures").
   The app renders entirely from these; the live client would swap buildView()
   for a poll of GET /games/:id/state. */
(function () {
  const PLAYERS = [
    { id: "p_abcaecbe", name: "Alice", alive: true },
    { id: "p_54fb4b29", name: "Bob", alive: true },
    { id: "p_0882b207", name: "Cara", alive: true },
    { id: "p_ee7e4561", name: "Dave", alive: true },
    { id: "p_fe908fdd", name: "Eve", alive: true },
    { id: "p_a4998377", name: "Finn", alive: true },
    { id: "p_a2291120", name: "Gwen", alive: true },
  ];

  // The shared task deck (GET /games/:id/tasks). Trimmed of internal `source`.
  const TASKS = [
    { id: "t0", prompt: "Take a selfie with someone you haven't talked to yet today", tier: "light", points: 1, kind: "social", group: false, availableAtMinute: 0 },
    { id: "t1", prompt: "Get a cheers going with at least two people", tier: "light", points: 1, kind: "social", group: false, availableAtMinute: 0 },
    { id: "t2", prompt: "Give an honest compliment to someone", tier: "light", points: 1, kind: "social", group: false, availableAtMinute: 0 },
    { id: "t7", prompt: "Covertly mirror someone's posture for two minutes", tier: "light", points: 1, kind: "covert", group: false, availableAtMinute: 0 },
    { id: "t8", prompt: "Get someone to high-five you without asking directly", tier: "light", points: 1, kind: "covert", group: false, availableAtMinute: 0 },
    { id: "t9", prompt: "Toast to the host and take a sip", tier: "light", points: 1, kind: "social", group: false, availableAtMinute: 0 },
    { id: "t12", prompt: "Take a shot with someone", tier: "standard", points: 2, kind: "social", group: false, availableAtMinute: 55 },
    { id: "t14", prompt: "Covertly get someone to refill your drink for you", tier: "standard", points: 2, kind: "covert", group: false, availableAtMinute: 0 },
    { id: "t15", prompt: "Convince someone to swap drinks with you for a round", tier: "standard", points: 2, kind: "covert", group: false, availableAtMinute: 0 },
    { id: "t16", prompt: "Lead a two-truths-and-a-lie round with three people", tier: "standard", points: 2, kind: "social", group: false, availableAtMinute: 0 },
    { id: "t19", prompt: "Covertly plant a silly phrase and get someone to repeat it", tier: "standard", points: 2, kind: "covert", group: false, availableAtMinute: 0, proof: { q: "What phrase did you plant?", placeholder: "the phrase you slipped in" } },
    { id: "t26", prompt: "Shotgun a beer with a buddy", tier: "heavy", points: 3, kind: "social", group: false, availableAtMinute: 0 },
    { id: "t27", prompt: "Invent a fake house rule and get someone to follow it", tier: "heavy", points: 3, kind: "covert", group: false, availableAtMinute: 0, proof: { q: "What was the fake rule?", placeholder: "the rule you made up" } },
    { id: "t28", prompt: "Give a heartfelt 60-second toast to the group", tier: "heavy", points: 3, kind: "social", group: false, availableAtMinute: 0 },
    { id: "t30", prompt: "Covertly get someone to say a secret word you chose", tier: "heavy", points: 3, kind: "covert", group: false, availableAtMinute: 0, proof: { q: "What was your secret word?", placeholder: "e.g. pineapple" } },
    { id: "t34", prompt: "Organize a group round of shots", tier: "group", points: 4, kind: "social", group: true, availableAtMinute: 0 },
  ];
  const INTENSITY_SWAP = "Not drinking? Swap in a beer-shaped soda or mime it — counts the same.";

  // A deep reserve the day keeps drawing from. When a task is completed it's
  // replaced by a fresh one of the same tier pulled from here (cycling), so the
  // list never empties — there's always more than what's on screen.
  const TASK_POOL = {
    light: [
      "Learn one new thing about someone you just met",
      "Start a conversation with a question, not a statement",
      "Get the room to agree on a song to play next",
      "Find out everyone's go-to comfort snack",
      "Swap seats with someone and keep the chat going",
      "Pay someone a compliment they won't see coming",
      "Get a group of three laughing within a minute",
    ],
    standard: [
      "Get someone to tell a story they've never told this group",
      "Start a debate about something gloriously trivial",
      "Trade a secret (small one) with someone you trust",
      "Convince two people to do a synchronized toast",
      "Get someone to teach you a useless skill on the spot",
      "Quietly start a rumor that you have a twin",
    ],
    heavy: [
      "Get the whole room to do a ten-second freeze",
      "Make a toast so sincere someone has to look away",
      "Orchestrate a dramatic entrance for someone else",
      "Convince three people you're definitely innocent",
      "Lead a chant that catches on for one full round",
    ],
    group: [
      "Get everyone to vote on the best snack in the room",
      "Run a 30-second group dance break",
      "Organize a circle and pass a single compliment around",
      "Get the whole table to share their first impression of you",
    ],
  };

  // Anonymized current suggestions (GET /killer/context) — target ids only, no identity.
  const KILL_CONTEXT = { canKillNow: false, suggestions: ["p_abcaecbe"] };

  // A riddly ambient event feed (events[] from PlayerView). Deliberately vague,
  // delayed, never forensic. Newest-first is handled in the UI.
  const FEED_ACTIVE = [
    { at: 12, kind: "start", title: "The day has begun", note: "Everyone's in. Do tasks, mingle, and start working out who the killers are." },
    { at: 34, kind: "task", title: "Tasks are rolling", note: "People around the room are completing tasks — good cover for everyone, guilty or not." },
    { at: 58, kind: "calm", title: "All quiet so far", note: "No one has been eliminated yet. The day is calm… for now." },
  ];
  const FEED_STRAINED = [
    ...FEED_ACTIVE,
    { at: 96, kind: "mood", title: "The mood is slipping", note: "Tension is rising across the group. Something feels off." },
    { at: 118, kind: "death", title: "A player was eliminated", note: "One of you is out of the game — but no one knows who's behind it." },
  ];
  const FEED_CRITICAL = [
    ...FEED_STRAINED,
    { at: 138, kind: "death", title: "Another player is gone", note: "The killers are still among you. Don't trust anyone too quickly." },
    { at: 150, kind: "vote", title: "A group vote is coming", note: "Soon everyone will vote on who to eliminate. Start making your case." },
  ];

  const base = (over) => Object.assign({
    gameId: "g_6cae1fd9",
    phase: "active",
    roundIndex: 0,
    nowMinute: 30,
    finaleMinute: 780,
    bar: "healthy",
    livingCount: 7,
    players: PLAYERS.map((p) => ({ ...p })),
    events: [],
    vote: { open: false, index: null, closesAtMinute: null, youVoted: false },
    result: null,
  }, over);

  const YOU = {
    town:   { id: "p_abcaecbe", name: "Alice", role: "townsperson", team: "town", alive: true, isGhost: false },
    killer: { id: "p_ee7e4561", name: "Dave",  role: "killer", team: "killer", alive: true, isGhost: false,
              killer: { meterPoints: 10, killCost: 10, canKillNow: true, teamMoveCharges: 0, maxMoves: 2 } },
    cop:    { id: "p_54fb4b29", name: "Bob",   role: "cop", team: "town", alive: true, isGhost: false,
              cop: { investigations: 1 } },
    medic:  { id: "p_0882b207", name: "Cara",  role: "medic", team: "town", alive: true, isGhost: false,
              medic: { shields: 1 } },
    ghost:  { id: "p_fe908fdd", name: "Eve",   role: "townsperson", team: "killer", alive: false, isGhost: true,
              killer: { meterPoints: 0, killCost: 10, canKillNow: false, teamMoveCharges: 0, maxMoves: 2 } },
  };

  // Illustrative final roles for the game-over reveal. The real recap comes from a
  // host-only recap endpoint (roles are NEVER in the player PlayerView mid-game).
  const REVEAL = {
    p_abcaecbe: "townsperson", p_54fb4b29: "cop",       p_0882b207: "medic",
    p_ee7e4561: "killer",      p_fe908fdd: "killer",    p_a4998377: "townsperson",
    p_a2291120: "townsperson",
  };

  // Build a PlayerView from the tweak knobs (role / bar / phase).
  function buildView({ role = "town", bar = "healthy", phase = "active" }) {
    const you = JSON.parse(JSON.stringify(YOU[role] || YOU.town));

    if (phase === "lobby" || phase === "join") {
      return base({ phase, nowMinute: 0, bar: "unknown",
        you: { id: you.id, name: you.name, role: "townsperson", team: "town", alive: true, isGhost: false } });
    }

    if (phase === "over") {
      const v = base({
        phase: "resolved", nowMinute: 785, bar: "unknown", livingCount: 6,
        you, players: PLAYERS.map((p) => ({ ...p, alive: p.id !== "p_fe908fdd" })),
        events: [
          { at: 156, kind: "voteResolved", message: "Something's afoot. A switch, perhaps." },
          { at: 196, kind: "gameOver", message: "It is over. (collapse)" },
        ],
        result: { winner: "killer", reason: "collapse", at: 196 },
      });
      return v;
    }

    // active / vote
    const feed = bar === "critical" ? FEED_CRITICAL : bar === "strained" ? FEED_STRAINED : FEED_ACTIVE;
    const livingCount = role === "ghost" ? 6 : 7;
    const players = PLAYERS.map((p) => ({ ...p, alive: role === "ghost" ? p.id !== "p_fe908fdd" : true }));
    const v = base({
      you, bar, livingCount, players,
      nowMinute: bar === "critical" ? 152 : bar === "strained" ? 110 : 42,
      events: feed.slice(),
    });
    if (phase === "vote") {
      v.vote = { open: true, index: 0, closesAtMinute: v.nowMinute + 6, youVoted: false };
    } else if (phase === "result") {
      // The vote has closed and a result is settling in — anonymously.
      v.vote = { open: false, resolved: true, index: 0, closesAtMinute: v.nowMinute - 3, youVoted: true, result: { at: v.nowMinute - 3 } };
    }
    return v;
  }

  window.SD = {
    PLAYERS, TASKS, TASK_POOL, INTENSITY_SWAP, KILL_CONTEXT, REVEAL, YOU, buildView,
    nameOf: (id) => (PLAYERS.find((p) => p.id === id) || {}).name || "Someone",
  };
})();
