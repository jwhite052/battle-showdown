import React, { useEffect, useMemo, useState } from "react";
import { Dice5, Swords, RotateCcw, Trophy, Sparkles, Play, Moon, Sun, Droplets, Flame, Zap, Leaf } from "lucide-react";
import "./styles.css";

const characters = [
  { id: "water", name: "Water", icon: Droplets, power: 1, color: "#2563eb" },
  { id: "fire", name: "Fire", icon: Flame, power: 1, color: "#dc2626" },
  { id: "lightning", name: "Lightning", icon: Zap, power: 1, color: "#eab308" },
  { id: "leaf", name: "Leaf", icon: Leaf, power: 1, color: "#16a34a" },
];

const board = [
  "start", "normal", "battle", "boost", "normal", "trap",
  "battle", "normal", "mystery", "normal", "battle", "boost",
  "normal", "trap", "battle", "normal", "mystery", "restart",
  "battle", "boost", "normal", "trap", "battle", "final"
];

const INTRO_DURATION = 2800;
const TROPHY_WIN_COUNT = 4;
const ELEMENT_ADVANTAGE_BONUS = 1;
const elementStrengths = {
  water: "fire",
  fire: "leaf",
  leaf: "lightning",
  lightning: "water"
};

const spaceLabels = {
  start: "START",
  normal: "",
  battle: "BATTLE",
  boost: "+2",
  trap: "-2",
  mystery: "?",
  restart: "RESTART",
  final: "FINISH"
};

function makePlayers(count, customNames = {}, customPowers = {}) {
  return characters.slice(0, count).map((c) => ({
    ...c,
    customName: customNames[c.id] || c.name,
    power: customPowers[c.id] || 1,
    position: 0,
    trophies: 0,
    skip: false,
  }));
}

function roll(sides = 6) {
  return Math.floor(Math.random() * sides) + 1;
}

function clampPower(value) {
  const power = Number(value);
  if (!Number.isFinite(power)) return 1;
  return Math.min(Math.max(power, 1), 10);
}

function PlayerIcon({ player, size = 26 }) {
  const Icon = player.icon;
  return <Icon size={size} strokeWidth={2.6} aria-hidden="true" />;
}

function getElementBonus(player, opponent) {
  return elementStrengths[player.id] === opponent.id ? ELEMENT_ADVANTAGE_BONUS : 0;
}

function getBattleScore(rollValue, player, opponent) {
  return rollValue + player.power + player.trophies + getElementBonus(player, opponent);
}

function DiceFace({ value }) {
  if (!value) return "?";

  return (
    <div className={`dice-face pip-count-${value}`} aria-label={`Rolled ${value}`}>
      {Array.from({ length: value }, (_, index) => (
        <span key={index} className="pip" />
      ))}
    </div>
  );
}

function BattleScore({ rollValue, player, opponent, isWinner = false }) {
  const elementBonus = getElementBonus(player, opponent);
  const total = getBattleScore(rollValue, player, opponent);

  return (
    <div className={`battle-score ${isWinner ? "winner-score" : ""}`}>
      <span className="score-formula">
        {rollValue} + {player.power} + {player.trophies}
        {elementBonus > 0 && <> + {elementBonus}</>}
      </span>
      <span className="score-total">{total}</span>
      {elementBonus > 0 && <span className="element-bonus">Advantage +{elementBonus}</span>}
    </div>
  );
}

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem("battle-showdown-theme") || "dark");
  const [playerCount, setPlayerCount] = useState(2);
  const [customNames, setCustomNames] = useState(() =>
    Object.fromEntries(characters.map(c => [c.id, c.name]))
  );
  const [customPowers, setCustomPowers] = useState(() =>
    Object.fromEntries(characters.map(c => [c.id, 1]))
  );
  const [players, setPlayers] = useState(() => makePlayers(2, {}, Object.fromEntries(characters.map(c => [c.id, 1]))));
  const [current, setCurrent] = useState(0);
  const [dice, setDice] = useState(null);
  const [rolling, setRolling] = useState(false);
  const [rollingValue, setRollingValue] = useState(null);
  const [message, setMessage] = useState("Choose players, then roll to begin Battle Showdown!");
  const [log, setLog] = useState(["Welcome to Battle Showdown!"]);
  const [winner, setWinner] = useState(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [introActive, setIntroActive] = useState(false);

  // Battle state
  const [battleMode, setBattleMode] = useState(false);
  const [battleAttacker, setBattleAttacker] = useState(null);
  const [battleDefender, setBattleDefender] = useState(null);
  const [attackerRoll, setAttackerRoll] = useState(null);
  const [defenderRoll, setDefenderRoll] = useState(null);
  const [battleWinnerId, setBattleWinnerId] = useState(null);
  const [battlePhase, setBattlePhase] = useState(null); // 'attacker', 'defender', or 'result'

  const currentPlayer = players[current];
  const battleButtonLabel = {
    attacker: "Attack Roll",
    defender: "Defend Roll",
    result: "Continue"
  }[battlePhase] || "Battle Roll";
  const battleRoller = battleMode && battlePhase !== 'result'
    ? (battlePhase === 'attacker' ? battleAttacker : battleDefender)
    : null;
  const turnDisplayPlayer = battleRoller || currentPlayer;
  const turnLabel = battleRoller ? "Battle Turn" : "Current Turn";

  useEffect(() => {
    document.body.dataset.theme = theme;
    localStorage.setItem("battle-showdown-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!introActive) return undefined;

    const timeout = window.setTimeout(() => {
      setIntroActive(false);
    }, INTRO_DURATION);

    return () => window.clearTimeout(timeout);
  }, [introActive]);

  const playerBySpace = useMemo(() => {
    const map = {};
    players.forEach((p) => {
      map[p.position] = [...(map[p.position] || []), p];
    });
    return map;
  }, [players]);

  function addLog(line) {
    setLog((old) => [line, ...old].slice(0, 8));
  }

  function reset(count = playerCount) {
    setPlayers(makePlayers(count, customNames, customPowers));
    setCurrent(0);
    setDice(null);
    setWinner(null);
    setGameStarted(false);
    setIntroActive(false);
    setBattleMode(false);
    setBattleAttacker(null);
    setBattleDefender(null);
    setAttackerRoll(null);
    setDefenderRoll(null);
    setBattlePhase(null);
    setMessage("Choose players, then roll to begin Battle Showdown!");
    setLog(["New game started!"]);
  }

  function changeCount(count) {
    setPlayerCount(count);
    reset(count);
  }

  function startGame() {
    setPlayers(makePlayers(playerCount, customNames, customPowers));
    setGameStarted(true);
    setIntroActive(true);
    setLog(["Game started!"]);
  }

  function updateName(id, name) {
    setCustomNames(prev => ({ ...prev, [id]: name || characters.find(c => c.id === id)?.name }));
  }

  function updatePower(id, power) {
    setCustomPowers(prev => ({ ...prev, [id]: clampPower(power) }));
  }

  function toggleTheme() {
    setTheme(prev => prev === "dark" ? "light" : "dark");
  }

  function animateRoll(sides, onComplete) {
    if (rolling) return;

    setRolling(true);
    setRollingValue(roll(sides));

    const interval = window.setInterval(() => {
      setRollingValue(roll(sides));
    }, 70);

    window.setTimeout(() => {
      window.clearInterval(interval);
      const finalRoll = roll(sides);
      setRollingValue(finalRoll);

      window.setTimeout(() => {
        onComplete(finalRoll);
        setRolling(false);
        setRollingValue(null);
      }, 180);
    }, 700);
  }

  function nextTurn(updatedPlayers = players) {
    let next = (current + 1) % updatedPlayers.length;
    setCurrent(next);
  }

  function resolveBattle(attackerScore, defenderScore, attackerPlayer, defenderPlayer, attackerIndex, defenderIndex, updated) {
    let turnMessage = "";

    if (attackerScore >= defenderScore) {
      updated[attackerIndex] = {
        ...updated[attackerIndex],
        trophies: updated[attackerIndex].trophies + 1
      };
      updated[defenderIndex] = {
        ...updated[defenderIndex],
        position: Math.max(updated[defenderIndex].position - 2, 0)
      };
      turnMessage = `Battle! ${attackerPlayer.customName} beat ${defenderPlayer.customName} ${attackerScore}-${defenderScore} and won a trophy!`;
    } else {
      updated[attackerIndex] = {
        ...updated[attackerIndex],
        position: Math.max(updated[attackerIndex].position - 2, 0)
      };
      updated[defenderIndex] = {
        ...updated[defenderIndex],
        trophies: updated[defenderIndex].trophies + 1
      };
      turnMessage = `Battle! ${defenderPlayer.customName} beat ${attackerPlayer.customName} ${defenderScore}-${attackerScore}. ${attackerPlayer.customName} moves back 2.`;
    }

    return turnMessage;
  }

  function clearBattleState() {
    setBattleMode(false);
    setBattleAttacker(null);
    setBattleDefender(null);
    setAttackerRoll(null);
    setDefenderRoll(null);
    setBattleWinnerId(null);
    setBattlePhase(null);
  }

  function setTrophyWinner(player) {
    const finalScore = roll(20) + player.trophies + player.power;
    setWinner({ ...player, finalScore });
    setMessage(`${player.customName} collected ${TROPHY_WIN_COUNT} trophies and wins Battle Showdown! Final score: ${finalScore}`);
    addLog(`🏆 ${player.customName} wins Battle Showdown with ${TROPHY_WIN_COUNT} trophies!`);
  }

  function finishBattle() {
    if (attackerRoll === null || defenderRoll === null) return;

    setDice(null);

    const updated = [...players];
    const defenderScore = getBattleScore(defenderRoll, battleDefender, battleAttacker);
    const attackerScore = getBattleScore(attackerRoll, battleAttacker, battleDefender);

    const attackerIndex = updated.findIndex(p => p.id === battleAttacker.id);
    const defenderIndex = updated.findIndex(p => p.id === battleDefender.id);

    const battleResult = resolveBattle(
      attackerScore,
      defenderScore,
      battleAttacker,
      battleDefender,
      attackerIndex,
      defenderIndex,
      updated
    );

    setPlayers(updated);
    setMessage(battleResult);
    addLog(battleResult);

    const trophyWinner = updated.find(p => p.trophies >= TROPHY_WIN_COUNT);
    if (trophyWinner) {
      setTrophyWinner(trophyWinner);
      clearBattleState();
      return;
    }

    // Check for winner after battle
    if (updated[attackerIndex].position >= board.length - 1) {
      const finalScore = roll(20) + updated[attackerIndex].trophies + updated[attackerIndex].power;
      setWinner({ ...updated[attackerIndex], finalScore });
      setMessage(`${updated[attackerIndex].customName} reached the Final Battle and wins!`);
      addLog(`🏆 ${updated[attackerIndex].customName} wins Battle Showdown!`);
    } else if (updated[defenderIndex].position >= board.length - 1) {
      const finalScore = roll(20) + updated[defenderIndex].trophies + updated[defenderIndex].power;
      setWinner({ ...updated[defenderIndex], finalScore });
      setMessage(`${updated[defenderIndex].customName} reached the Final Battle and wins!`);
      addLog(`🏆 ${updated[defenderIndex].customName} wins Battle Showdown!`);
    } else {
      // Continue game - next player's turn
      nextTurn(updated);
    }

    // Reset battle state
    clearBattleState();
  }

  function handleBattleRoll() {
    if (rolling) return;

    if (battlePhase === 'result') {
      finishBattle();
      return;
    }

    if (battlePhase === 'attacker') {
      animateRoll(6, (d) => {
        setDice(d);
        setAttackerRoll(d);
        setBattleWinnerId(null);
        const elementBonus = getElementBonus(battleAttacker, battleDefender);
        const totalScore = getBattleScore(d, battleAttacker, battleDefender);
        const bonusText = elementBonus > 0 ? ` + ${elementBonus} element advantage` : "";
        setMessage(`${battleAttacker.customName} rolled ${d} + ${battleAttacker.power} power + ${battleAttacker.trophies} trophies${bonusText} = ${totalScore}. ${battleDefender.customName}'s turn to roll!`);
        setBattlePhase('defender');
      });
    } else if (battlePhase === 'defender') {
      animateRoll(6, (d) => {
        setDice(d);
        setDefenderRoll(d);
        const defenderBonus = getElementBonus(battleDefender, battleAttacker);
        const defenderScore = getBattleScore(d, battleDefender, battleAttacker);
        const attackerScore = getBattleScore(attackerRoll || 0, battleAttacker, battleDefender);
        const battleLeader = attackerScore >= defenderScore ? battleAttacker : battleDefender;
        setBattleWinnerId(battleLeader.id);
        const leader = battleLeader.customName;
        const bonusText = defenderBonus > 0 ? ` + ${defenderBonus} element advantage` : "";
        setMessage(`${battleDefender.customName} rolled ${d} + ${battleDefender.power} power + ${battleDefender.trophies} trophies${bonusText} = ${defenderScore}. ${leader} wins the battle!`);
        setBattlePhase('result');
      });
    }
  }

  function handleRoll() {
    if (winner || battleMode || rolling) return;

    let updated = [...players];
    let p = { ...updated[current] };

    if (p.skip) {
      p.skip = false;
      updated[current] = p;
      setPlayers(updated);
      setMessage(`${p.customName} had to skip this turn.`);
      addLog(`${p.customName} skipped a turn.`);
      nextTurn(updated);
      return;
    }

    animateRoll(6, (d) => {
      setDice(d);

      let newPosition = Math.min(p.position + d, board.length - 1);
      p.position = newPosition;
      let type = board[newPosition];

      let turnMessage = `${p.customName} rolled ${d} and moved to space ${newPosition}.`;

      if (type === "boost") {
        p.position = Math.min(p.position + 2, board.length - 1);
        turnMessage += " Boost! Move forward 2.";
      }

      if (type === "trap") {
        p.position = Math.max(p.position - 2, 0);
        turnMessage += " Trap! Move back 2.";
      }

      if (type === "mystery") {
        const effects = [
          () => { p.position = Math.min(p.position + 3, board.length - 1); return "Mystery power! Move forward 3."; },
          () => { p.position = Math.max(p.position - 3, 0); return "Oops! Move back 3."; },
          () => { p.trophies += 1; return "Lucky find! Gain 1 trophy."; },
          () => { p.skip = true; return "Sticky slime! Skip your next turn."; }
        ];
        turnMessage += " " + effects[roll(4) - 1]();
      }

      if (type === "restart") {
        p.position = 0;
        turnMessage += " Back to start!";
      }

      updated[current] = p;
      setPlayers(updated);

      if (p.trophies >= TROPHY_WIN_COUNT) {
        setTrophyWinner(p);
        return;
      }

      // Check for battle
      const opponents = updated.filter((x, i) => i !== current && x.position === p.position);
      if (board[p.position] === "battle" || opponents.length > 0) {
        const opponent = opponents[0] || updated.filter((_, i) => i !== current)[roll(updated.length - 1) - 1];

        setBattleMode(true);
        setBattleAttacker(p);
        setBattleDefender(opponent);
        setBattlePhase('attacker');
        setAttackerRoll(null);
        setDefenderRoll(null);
        setDice(null);

        setMessage(`⚔️ BATTLE! ${p.customName} landed on a battle space vs ${opponent.customName}! ${p.customName}, roll for battle!`);
        addLog(`⚔️ Battle! ${p.customName} vs ${opponent.customName}`);
        return;
      }

      if (p.position >= board.length - 1) {
        const finalScore = roll(20) + p.trophies + p.power;
        const finalWinner = { ...p, finalScore };
        setWinner(finalWinner);
        setMessage(`${p.customName} reached the Final Battle and wins Battle Showdown! Final score: ${finalScore}`);
        addLog(`🏆 ${p.customName} wins Battle Showdown!`);
        return;
      }

      setPlayers(updated);
      setMessage(turnMessage);
      addLog(turnMessage);
      nextTurn(updated);
    });
  }

  return (
    <div className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">Race • Battle • Power Up</p>
          <h1>Battle Showdown!</h1>
          <p className="subtitle">Roll the dice, move across the board, battle rivals, and reach the Final Battle first.</p>
        </div>
        <div className="controls">
          <label>Players</label>
          <select value={playerCount} onChange={(e) => changeCount(Number(e.target.value))}>
            <option value={2}>2</option>
            <option value={3}>3</option>
            <option value={4}>4</option>
          </select>
          <button className="secondary" onClick={() => reset()}>
            <RotateCcw size={18} /> Reset
          </button>
          <button className="theme-toggle" onClick={toggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}>
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            {theme === "dark" ? "Light" : "Dark"}
          </button>
        </div>
      </header>

      {introActive && (
        <div className="intro-layer" role="status" aria-live="polite">
          <div className="intro-card">
            <div className="intro-burst">
              <Swords size={34} />
            </div>
            <p className="intro-kicker">Element Clash</p>
            <h2>Let the battle begin!</h2>
            <div className="intro-roster">
              {players.map((p, index) => (
                <div className="intro-player" style={{ "--player-color": p.color }} key={p.id}>
                  <div className="avatar intro-avatar" style={{ background: p.color }}>
                    <PlayerIcon player={p} size={30} />
                  </div>
                  <strong>{p.customName}</strong>
                  {index < players.length - 1 && <span className="intro-vs">VS</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {winner && (
        <div className="intro-layer victory-layer" role="status" aria-live="polite">
          <div className="intro-card victory-card">
            <div className="victory-confetti" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
            <div className="intro-burst victory-burst">
              <Trophy size={38} />
            </div>
            <p className="intro-kicker">Battle Complete</p>
            <h2>{winner.customName} wins!</h2>
            <div className="victory-player" style={{ "--player-color": winner.color }}>
              <div className="avatar victory-avatar" style={{ background: winner.color }}>
                <PlayerIcon player={winner} size={44} />
              </div>
              <div>
                <strong>{winner.customName}</strong>
                <p>{winner.trophies} trophies • Final score {winner.finalScore}</p>
              </div>
            </div>
            <button className="roll victory-reset" onClick={() => reset()}>
              <RotateCcw size={20} /> Play Again
            </button>
          </div>
        </div>
      )}

      {winner && (
        <div className="winner">
          <Trophy /> <PlayerIcon player={winner} /> {winner.customName} wins Battle Showdown!
        </div>
      )}

      {!gameStarted ? (
        <main className="layout">
          <section className="panel board-panel">
            <h2>Customize Your Players</h2>
            <div className="name-setup">
              {characters.slice(0, playerCount).map((c) => (
                <div key={c.id} className="name-input-row">
                  <div className="avatar" style={{ background: c.color }}>
                    <PlayerIcon player={c} />
                  </div>
                  <input
                    type="text"
                    placeholder={c.name}
                    value={customNames[c.id] || ""}
                    onChange={(e) => updateName(c.id, e.target.value)}
                    className="name-input"
                  />
                  <label className="power-control">
                    <span>Power</span>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={customPowers[c.id] || 1}
                      onChange={(e) => updatePower(c.id, e.target.value)}
                      className="power-input"
                    />
                  </label>
                </div>
              ))}
            </div>
            <button className="roll start-btn" onClick={startGame}>
              <Play /> Start Game
            </button>
          </section>
        </main>
      ) : (
      <main className="layout">
        <section className="panel board-panel">
          <div className="turn-card">
            <div>
              <span>{turnLabel}</span>
              <strong className="turn-player" style={{ color: turnDisplayPlayer.color }}>
                <PlayerIcon player={turnDisplayPlayer} size={24} /> {turnDisplayPlayer.customName}
              </strong>
            </div>
            {battleMode ? (
              <button className={`roll battle-btn ${battlePhase === 'result' ? "continue-btn" : ""}`} onClick={handleBattleRoll} disabled={rolling}>
                {battleRoller ? <PlayerIcon player={battleRoller} size={20} /> : <Dice5 />}
                {rolling && battlePhase !== 'result' ? "Rolling..." : battleButtonLabel}
              </button>
            ) : (
              <button className="roll" onClick={handleRoll} disabled={rolling}>
                <Dice5 /> {rolling ? "Rolling..." : "Roll Dice"}
              </button>
            )}
          </div>

          {battleMode && (
            <div className={`battle-display ${battleWinnerId ? "battle-has-winner" : ""}`}>
              {battleWinnerId && (
                <div className="battle-confetti" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
              )}
              <div className={`battle-player attacker ${battleWinnerId === battleAttacker.id ? "battle-winner" : ""} ${battleRoller?.id === battleAttacker.id ? "battle-roller" : ""}`}>
                <div className="avatar" style={{ background: battleAttacker.color }}>
                  <PlayerIcon player={battleAttacker} />
                </div>
                <span>{battleAttacker.customName}</span>
                {battleRoller?.id === battleAttacker.id && <strong className="battle-roll-label">Roll now</strong>}
                {battleWinnerId === battleAttacker.id && <strong className="battle-win-label">Battle winner</strong>}
                {attackerRoll !== null && (
                  <BattleScore rollValue={attackerRoll} player={battleAttacker} opponent={battleDefender} isWinner={battleWinnerId === battleAttacker.id} />
                )}
              </div>
              <div className="battle-vs">VS</div>
              <div className={`battle-player defender ${battleWinnerId === battleDefender.id ? "battle-winner" : ""} ${battleRoller?.id === battleDefender.id ? "battle-roller" : ""}`}>
                <div className="avatar" style={{ background: battleDefender.color }}>
                  <PlayerIcon player={battleDefender} />
                </div>
                <span>{battleDefender.customName}</span>
                {battleRoller?.id === battleDefender.id && <strong className="battle-roll-label">Roll now</strong>}
                {battleWinnerId === battleDefender.id && <strong className="battle-win-label">Battle winner</strong>}
                {defenderRoll !== null && (
                  <BattleScore rollValue={defenderRoll} player={battleDefender} opponent={battleAttacker} isWinner={battleWinnerId === battleDefender.id} />
                )}
              </div>
            </div>
          )}

          <div className="dice-row">
            <div className={`dice ${rolling ? "rolling" : ""}`}>
              <DiceFace value={rollingValue || dice} />
            </div>
            <p>{message}</p>
          </div>

          <div className="board">
            {board.map((type, index) => (
              <div key={index} className={`space ${type}`}>
                <span className="space-index">{index}</span>
                <strong>{spaceLabels[type]}</strong>
                <div className="tokens">
                  {(playerBySpace[index] || []).map((p) => (
                    <span key={p.id} title={p.customName} style={{ background: p.color }}>
                      <PlayerIcon player={p} size={18} />
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside className="panel side">
          <h2><Swords size={20}/> Players</h2>
          {players.map((p, index) => (
            <div className={`player ${index === current ? "active" : ""}`} key={p.id}>
              <div className="avatar" style={{ background: p.color }}>
                <PlayerIcon player={p} />
              </div>
              <div>
                <strong>{p.customName}</strong>
                <p>Space {p.position} • Power +{p.power}</p>
              </div>
              <div className="trophies">🏆 {p.trophies}</div>
            </div>
          ))}

          <h2><Sparkles size={20}/> Game Log</h2>
          <div className="log">
            {log.map((line, i) => <p key={i}>{line}</p>)}
          </div>

          <div className="rules">
            <h3>Spaces</h3>
            <p><b>Battle:</b> roll + power + trophies. Winner gets a trophy.</p>
            <p><b>Elements:</b> Water beats Fire, Fire beats Leaf, Leaf beats Lightning, Lightning beats Water. Advantage gives +1.</p>
            <p><b>Trophies:</b> collect 4 to win instantly.</p>
            <p><b>+2:</b> move forward two spaces.</p>
            <p><b>-2:</b> move back two spaces.</p>
            <p><b>?:</b> random mystery effect.</p>
          </div>
        </aside>
      </main>
      )}
    </div>
  );
}
