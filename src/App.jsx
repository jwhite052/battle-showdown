import React, { useMemo, useState } from "react";
import { Dice5, Swords, RotateCcw, Trophy, Sparkles } from "lucide-react";
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

function makePlayers(count) {
  return characters.slice(0, count).map((c) => ({
    ...c,
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
  const [players, setPlayers] = useState(() => makePlayers(4));
  const [current, setCurrent] = useState(0);
  const [dice, setDice] = useState(null);
  const [message, setMessage] = useState("Choose players, then roll to begin Battle Showdown!");
  const [log, setLog] = useState(["Welcome to Battle Showdown!"]);
  const [winner, setWinner] = useState(null);

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
    setPlayers(makePlayers(count));
    setCurrent(0);
    setDice(null);
    setWinner(null);
    setMessage("Roll to begin Battle Showdown!");
    setLog(["New game started!"]);
  }

  function changeCount(count) {
    setPlayerCount(count);
    reset(count);
  }

  function nextTurn(updatedPlayers = players) {
    let next = (current + 1) % updatedPlayers.length;
    setCurrent(next);
  }

  function handleRoll() {
    if (winner) return;

    let updated = [...players];
    let p = { ...updated[current] };

    if (p.skip) {
      p.skip = false;
      updated[current] = p;
      setPlayers(updated);
      setMessage(`${p.name} had to skip this turn.`);
      addLog(`${p.emoji} ${p.name} skipped a turn.`);
      nextTurn(updated);
      return;
    }

    const d = roll();
    setDice(d);

    let newPosition = Math.min(p.position + d, board.length - 1);
    p.position = newPosition;
    let type = board[newPosition];

    let turnMessage = `${p.name} rolled ${d} and moved to space ${newPosition}.`;

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

    const opponents = updated.filter((x, i) => i !== current && x.position === p.position);
    if (board[p.position] === "battle" || opponents.length > 0) {
      const opponent = opponents[0] || updated.filter((_, i) => i !== current)[roll(updated.length - 1) - 1];
      const opponentIndex = updated.findIndex((x) => x.id === opponent.id);

      const playerScore = roll(10) + p.power + p.trophies;
      const opponentScore = roll(10) + opponent.power + opponent.trophies;

      if (playerScore >= opponentScore) {
        p.trophies += 1;
        updated[current] = p;
        updated[opponentIndex] = {
          ...opponent,
          position: Math.max(opponent.position - 2, 0)
        };
        turnMessage += ` Battle! ${p.name} beat ${opponent.name} ${playerScore}-${opponentScore} and won a trophy.`;
      } else {
        updated[current] = {
          ...p,
          position: Math.max(p.position - 2, 0)
        };
        updated[opponentIndex] = {
          ...opponent,
          trophies: opponent.trophies + 1
        };
        turnMessage += ` Battle! ${opponent.name} beat ${p.name} ${opponentScore}-${playerScore}. ${p.name} moves back 2.`;
      }
    }

    if (p.position >= board.length - 1) {
      const finalScore = roll(20) + p.trophies + p.power;
      const finalWinner = { ...p, finalScore };
      setWinner(finalWinner);
      setMessage(`${p.name} reached the Final Battle and wins Battle Showdown! Final score: ${finalScore}`);
      addLog(`🏆 ${p.name} wins Battle Showdown!`);
      setPlayers(updated);
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
          <Trophy /> {winner.emoji} {winner.name} wins Battle Showdown!
        </div>
      )}

      <main className="layout">
        <section className="panel board-panel">
          <div className="turn-card">
            <div>
              <span>Current Turn</span>
              <strong style={{ color: currentPlayer.color }}>{currentPlayer.emoji} {currentPlayer.name}</strong>
            </div>
            <button className="roll" onClick={handleRoll}>
              <Dice5 /> Roll Dice
            </button>
          </div>

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
                    <span key={p.id} title={p.name} style={{ background: p.color }}>
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
                <strong>{p.name}</strong>
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
    </div>
  );
}
