import React, { useMemo, useState } from "react";
import { Dice5, Swords, RotateCcw, Trophy, Sparkles, Play } from "lucide-react";
import "./styles.css";

const characters = [
  { id: "bronto", name: "Bronto", emoji: "🦕", power: 2, color: "#60a5fa" },
  { id: "axel", name: "Axel", emoji: "🦎", power: 3, color: "#34d399" },
  { id: "luna", name: "Luna", emoji: "🌙", power: 2, color: "#f472b6" },
  { id: "blaze", name: "Blaze", emoji: "🔥", power: 4, color: "#fb923c" },
];

const board = [
  "start", "normal", "battle", "boost", "normal", "trap",
  "battle", "normal", "mystery", "normal", "battle", "boost",
  "normal", "trap", "battle", "normal", "mystery", "normal",
  "battle", "boost", "normal", "trap", "battle", "final"
];

const spaceLabels = {
  start: "START",
  normal: "",
  battle: "BATTLE",
  boost: "+2",
  trap: "-2",
  mystery: "?"
};

function makePlayers(count, customNames = {}) {
  return characters.slice(0, count).map((c) => ({
    ...c,
    customName: customNames[c.id] || c.name,
    position: 0,
    trophies: 0,
    skip: false,
  }));
}

function roll(sides = 6) {
  return Math.floor(Math.random() * sides) + 1;
}

export default function App() {
  const [playerCount, setPlayerCount] = useState(4);
  const [customNames, setCustomNames] = useState(() =>
    Object.fromEntries(characters.map(c => [c.id, c.name]))
  );
  const [players, setPlayers] = useState(() => makePlayers(4));
  const [current, setCurrent] = useState(0);
  const [dice, setDice] = useState(null);
  const [message, setMessage] = useState("Choose players, then roll to begin Battle Showdown!");
  const [log, setLog] = useState(["Welcome to Battle Showdown!"]);
  const [winner, setWinner] = useState(null);
  const [gameStarted, setGameStarted] = useState(false);

  // Battle state
  const [battleMode, setBattleMode] = useState(false);
  const [battleAttacker, setBattleAttacker] = useState(null);
  const [battleDefender, setBattleDefender] = useState(null);
  const [attackerRoll, setAttackerRoll] = useState(null);
  const [defenderRoll, setDefenderRoll] = useState(null);
  const [battlePhase, setBattlePhase] = useState(null); // 'attacker' or 'defender'

  const currentPlayer = players[current];

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
    setPlayers(makePlayers(count, customNames));
    setCurrent(0);
    setDice(null);
    setWinner(null);
    setGameStarted(false);
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
    setPlayers(makePlayers(playerCount, customNames));
    setGameStarted(true);
    setLog(["Game started!"]);
  }

  function updateName(id, name) {
    setCustomNames(prev => ({ ...prev, [id]: name || characters.find(c => c.id === id)?.name }));
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

  function handleBattleRoll() {
    let updated = [...players];

    if (battlePhase === 'attacker') {
      const d = roll(10);
      setAttackerRoll(d);
      const totalScore = d + battleAttacker.power + battleAttacker.trophies;
      setMessage(`${battleAttacker.customName} rolled ${d} + ${battleAttacker.power} power + ${battleAttacker.trophies} trophies = ${totalScore}. ${battleDefender.customName}'s turn to roll!`);
      setBattlePhase('defender');
    } else if (battlePhase === 'defender') {
      const d = roll(10);
      setDefenderRoll(d);
      const defenderScore = d + battleDefender.power + battleDefender.trophies;
      const attackerScore = (attackerRoll || 0) + battleAttacker.power + battleAttacker.trophies;

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
      setBattleMode(false);
      setBattleAttacker(null);
      setBattleDefender(null);
      setAttackerRoll(null);
      setDefenderRoll(null);
      setBattlePhase(null);
    }
  }

  function handleRoll() {
    if (winner || battleMode) return;

    let updated = [...players];
    let p = { ...updated[current] };

    if (p.skip) {
      p.skip = false;
      updated[current] = p;
      setPlayers(updated);
      setMessage(`${p.customName} had to skip this turn.`);
      addLog(`${p.emoji} ${p.customName} skipped a turn.`);
      nextTurn(updated);
      return;
    }

    const d = roll();
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

    updated[current] = p;
    setPlayers(updated);

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
        </div>
      </header>

      {winner && (
        <div className="winner">
          <Trophy /> {winner.emoji} {winner.customName} wins Battle Showdown!
        </div>
      )}

      {!gameStarted ? (
        <main className="layout">
          <section className="panel board-panel">
            <h2>Customize Your Players</h2>
            <div className="name-setup">
              {characters.slice(0, playerCount).map((c) => (
                <div key={c.id} className="name-input-row">
                  <div className="avatar" style={{ background: c.color }}>{c.emoji}</div>
                  <input
                    type="text"
                    placeholder={c.name}
                    value={customNames[c.id] || ""}
                    onChange={(e) => updateName(c.id, e.target.value)}
                    className="name-input"
                  />
                  <span className="power-badge">Power +{c.power}</span>
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
              <span>Current Turn</span>
              <strong style={{ color: currentPlayer.color }}>{currentPlayer.emoji} {currentPlayer.customName}</strong>
            </div>
            {battleMode ? (
              <button className="roll battle-btn" onClick={handleBattleRoll}>
                <Dice5 /> {battlePhase === 'attacker' ? "Attack Roll" : "Defend Roll"}
              </button>
            ) : (
              <button className="roll" onClick={handleRoll}>
                <Dice5 /> Roll Dice
              </button>
            )}
          </div>

          {battleMode && (
            <div className="battle-display">
              <div className="battle-player attacker">
                <div className="avatar" style={{ background: battleAttacker.color }}>{battleAttacker.emoji}</div>
                <span>{battleAttacker.customName}</span>
                {attackerRoll !== null && (
                  <div className="battle-score">
                    {attackerRoll} + {battleAttacker.power} + {battleAttacker.trophies} = {attackerRoll + battleAttacker.power + battleAttacker.trophies}
                  </div>
                )}
              </div>
              <div className="battle-vs">VS</div>
              <div className="battle-player defender">
                <div className="avatar" style={{ background: battleDefender.color }}>{battleDefender.emoji}</div>
                <span>{battleDefender.customName}</span>
                {defenderRoll !== null && (
                  <div className="battle-score">
                    {defenderRoll} + {battleDefender.power} + {battleDefender.trophies} = {defenderRoll + battleDefender.power + battleDefender.trophies}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="dice-row">
            <div className="dice">{dice || "?"}</div>
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
                      {p.emoji}
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
              <div className="avatar" style={{ background: p.color }}>{p.emoji}</div>
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
