import React, { useEffect, useMemo, useRef, useState } from "react";
import { Dice5, Swords, RotateCcw, Trophy, Sparkles, Play, Moon, Sun, Droplets, Flame, Zap, Leaf, HelpCircle, X, GripVertical, Volume2, VolumeX } from "lucide-react";
import "./styles.css";

const elementTypes = [
  { id: "water", name: "Water", icon: Droplets, power: 1, color: "#2563eb" },
  { id: "fire", name: "Fire", icon: Flame, power: 1, color: "#dc2626" },
  { id: "lightning", name: "Lightning", icon: Zap, power: 1, color: "#eab308" },
  { id: "leaf", name: "Leaf", icon: Leaf, power: 1, color: "#16a34a" },
];
const characters = elementTypes.map(element => ({ ...element, defaultElementId: element.id }));
const defaultCharacterOrder = characters.map(c => c.id);

const board = [
  "start", "normal", "battle", "boost", "normal", "trap",
  "battle", "normal", "mystery", "normal", "battle", "boost",
  "normal", "trap", "battle", "normal", "mystery", "restart",
  "battle", "boost", "normal", "trap", "battle", "final"
];

const INTRO_DURATION = 2800;
const MOVE_STEP_DURATION = 260;
const TROPHY_WIN_COUNT = 4;
const ELEMENT_ADVANTAGE_BONUS = 1;
const MUSIC_SRC = "/audio/choose-your-player.mp3";
const elementStrengths = {
  water: "fire",
  fire: "leaf",
  leaf: "lightning",
  lightning: "water"
};
const elementById = Object.fromEntries(elementTypes.map(element => [element.id, element]));

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

function getOrderedCharacters(order = defaultCharacterOrder) {
  return order
    .map(id => characters.find(c => c.id === id))
    .filter(Boolean);
}

function getSelectedElement(character, customElements = {}) {
  return elementById[customElements[character.id]] || elementById[character.defaultElementId];
}

function getPlayerConfig(character, customElements = {}) {
  const element = getSelectedElement(character, customElements);
  return {
    ...character,
    elementId: element.id,
    elementName: element.name,
    icon: element.icon,
    color: element.color
  };
}

function makePlayers(count, customNames = {}, customPowers = {}, playerOrder = defaultCharacterOrder, customElements = {}) {
  return getOrderedCharacters(playerOrder).slice(0, count).map((c) => ({
    ...getPlayerConfig(c, customElements),
    customName: customNames[c.id] || getSelectedElement(c, customElements).name,
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
  return elementStrengths[player.elementId] === opponent.elementId ? ELEMENT_ADVANTAGE_BONUS : 0;
}

function getBattleScore(rollValue, player, opponent) {
  return rollValue + player.power + player.trophies + getElementBonus(player, opponent);
}

function getMovementPath(from, to) {
  if (from === to) return [];

  const direction = to > from ? 1 : -1;
  const path = [];
  for (let position = from + direction; direction > 0 ? position <= to : position >= to; position += direction) {
    path.push(position);
  }
  return path;
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
  const [customElements, setCustomElements] = useState(() =>
    Object.fromEntries(characters.map(c => [c.id, c.defaultElementId]))
  );
  const [playerOrder, setPlayerOrder] = useState(defaultCharacterOrder);
  const [draggedPlayerId, setDraggedPlayerId] = useState(null);
  const [players, setPlayers] = useState(() => makePlayers(
    2,
    {},
    Object.fromEntries(characters.map(c => [c.id, 1])),
    defaultCharacterOrder,
    Object.fromEntries(characters.map(c => [c.id, c.defaultElementId]))
  ));
  const [current, setCurrent] = useState(0);
  const [dice, setDice] = useState(null);
  const [rolling, setRolling] = useState(false);
  const [rollingValue, setRollingValue] = useState(null);
  const [moving, setMoving] = useState(false);
  const [message, setMessage] = useState("Choose players, then roll to begin Battle Showdown!");
  const [log, setLog] = useState(["Welcome to Battle Showdown!"]);
  const [winner, setWinner] = useState(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [introActive, setIntroActive] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [musicOn, setMusicOn] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [hoppingPlayerIds, setHoppingPlayerIds] = useState([]);
  const hopTimeoutRef = useRef(null);
  const moveTimeoutsRef = useRef([]);
  const musicRef = useRef(null);
  const sfxContextRef = useRef(null);
  const soundOnRef = useRef(true);

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
  const setupCharacters = useMemo(
    () => getOrderedCharacters(playerOrder).map(c => getPlayerConfig(c, customElements)),
    [playerOrder, customElements]
  );

  useEffect(() => {
    document.body.dataset.theme = theme;
    localStorage.setItem("battle-showdown-theme", theme);
  }, [theme]);

  useEffect(() => {
    soundOnRef.current = soundOn;
  }, [soundOn]);

  useEffect(() => {
    if (!introActive) return undefined;

    const timeout = window.setTimeout(() => {
      setIntroActive(false);
    }, INTRO_DURATION);

    return () => window.clearTimeout(timeout);
  }, [introActive]);

  useEffect(() => {
    return () => {
      window.clearTimeout(hopTimeoutRef.current);
      moveTimeoutsRef.current.forEach(timeout => window.clearTimeout(timeout));
      musicRef.current?.pause();
      sfxContextRef.current?.close();
    };
  }, []);

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

  function triggerTokenHop(playerIds) {
    const ids = playerIds.filter(Boolean);
    if (!ids.length) return;

    playSfx("hop");
    window.clearTimeout(hopTimeoutRef.current);
    setHoppingPlayerIds(ids);
    hopTimeoutRef.current = window.setTimeout(() => {
      setHoppingPlayerIds([]);
    }, 720);
  }

  function animatePlayerMovement(playerId, path, finalPlayers, onComplete) {
    moveTimeoutsRef.current.forEach(timeout => window.clearTimeout(timeout));
    moveTimeoutsRef.current = [];

    if (!path.length) {
      setPlayers(finalPlayers);
      onComplete();
      return;
    }

    setMoving(true);

    path.forEach((position, index) => {
      const timeout = window.setTimeout(() => {
        setPlayers(prev => prev.map(player => (
          player.id === playerId ? { ...player, position } : player
        )));
        triggerTokenHop([playerId]);

        if (index === path.length - 1) {
          const finalTimeout = window.setTimeout(() => {
            setPlayers(finalPlayers);
            setMoving(false);
            onComplete();
          }, MOVE_STEP_DURATION);
          moveTimeoutsRef.current.push(finalTimeout);
        }
      }, MOVE_STEP_DURATION * index);
      moveTimeoutsRef.current.push(timeout);
    });
  }

  function reset(count = playerCount) {
    setPlayers(makePlayers(count, customNames, customPowers, playerOrder, customElements));
    setCurrent(0);
    setDice(null);
    setMoving(false);
    setHoppingPlayerIds([]);
    moveTimeoutsRef.current.forEach(timeout => window.clearTimeout(timeout));
    moveTimeoutsRef.current = [];
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
    setPlayers(makePlayers(playerCount, customNames, customPowers, playerOrder, customElements));
    setGameStarted(true);
    setIntroActive(true);
    setLog(["Game started!"]);
    playSfx("start");
  }

  function updateName(id, name) {
    const character = characters.find(c => c.id === id);
    setCustomNames(prev => ({ ...prev, [id]: name || getSelectedElement(character, customElements).name }));
  }

  function updatePower(id, power) {
    setCustomPowers(prev => ({ ...prev, [id]: clampPower(power) }));
  }

  function cycleElement(id) {
    const previousElement = elementById[customElements[id]] || elementTypes[0];
    const previousIndex = elementTypes.findIndex(element => element.id === previousElement.id);
    const nextElement = elementTypes[(previousIndex + 1) % elementTypes.length];

    setCustomElements(prev => ({ ...prev, [id]: nextElement.id }));
    setCustomNames(prev => {
      if ((prev[id] || previousElement.name) !== previousElement.name) return prev;
      return { ...prev, [id]: nextElement.name };
    });
  }

  function reorderPlayers(targetId) {
    if (!draggedPlayerId || draggedPlayerId === targetId) return;

    setPlayerOrder(prev => {
      const next = [...prev];
      const fromIndex = next.indexOf(draggedPlayerId);
      const toIndex = next.indexOf(targetId);
      if (fromIndex === -1 || toIndex === -1) return prev;

      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
    setDraggedPlayerId(null);
  }

  function toggleTheme() {
    setTheme(prev => prev === "dark" ? "light" : "dark");
  }

  async function startMusic() {
    if (!musicRef.current) return;

    musicRef.current.volume = 0.2;
    musicRef.current.loop = true;

    try {
      await musicRef.current.play();
      setMusicOn(true);
    } catch {
      setMusicOn(false);
    }
  }

  function stopMusic() {
    musicRef.current?.pause();
    setMusicOn(false);
  }

  function toggleMusic() {
    if (musicOn) {
      stopMusic();
      return;
    }

    startMusic();
  }

  async function startSound() {
    const context = resumeSfxContext();
    if (!context) return;

    try {
      if (context.state === "suspended") {
        await context.resume();
      }
      soundOnRef.current = true;
      setSoundOn(true);
      playSfx("start");
    } catch {
      soundOnRef.current = false;
      setSoundOn(false);
    }
  }

  function stopSound() {
    soundOnRef.current = false;
    setSoundOn(false);
  }

  function toggleSound() {
    if (soundOn) {
      stopSound();
      return;
    }

    startSound();
  }

  function resumeSfxContext() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;

    if (!sfxContextRef.current || sfxContextRef.current.state === "closed") {
      sfxContextRef.current = new AudioContext();
    }

    return sfxContextRef.current;
  }

  function playTone(context, frequency, start, duration, volume = 0.08, type = "sine") {
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  function playNoise(context, start, duration, volume = 0.045) {
    const buffer = context.createBuffer(1, context.sampleRate * duration, context.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }

    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(gain);
    gain.connect(context.destination);
    source.start(start);
  }

  function playSfx(kind) {
    if (!soundOnRef.current) return;

    const context = resumeSfxContext();
    if (!context) return;
    if (context.state === "suspended") {
      context.resume();
    }

    const now = context.currentTime;
    const effectVolume = kind === "hop" ? 0.055 : kind === "dice" ? 0.065 : 0.085;
    const sequences = {
      start: [[392, 0, 0.08], [523, 0.09, 0.08], [784, 0.18, 0.14]],
      dice: [[220, 0, 0.04], [330, 0.06, 0.04], [260, 0.12, 0.05], [440, 0.18, 0.05]],
      hop: [[560, 0, 0.06]],
      boost: [[440, 0, 0.06], [660, 0.07, 0.07], [880, 0.15, 0.1]],
      trap: [[300, 0, 0.08], [220, 0.09, 0.08], [140, 0.18, 0.12]],
      mystery: [[392, 0, 0.06], [587, 0.07, 0.06], [494, 0.14, 0.06], [740, 0.21, 0.08]],
      battleStart: [[196, 0, 0.12], [392, 0.13, 0.1], [196, 0.25, 0.12]],
      battleWin: [[523, 0, 0.08], [659, 0.09, 0.08], [784, 0.18, 0.14]],
      trophy: [[659, 0, 0.08], [784, 0.08, 0.08], [988, 0.17, 0.16]],
      win: [[523, 0, 0.1], [659, 0.1, 0.1], [784, 0.2, 0.1], [1047, 0.32, 0.2]],
    };

    if (kind === "trap" || kind === "battleStart") {
      playNoise(context, now, 0.12, kind === "trap" ? 0.035 : 0.05);
    }

    (sequences[kind] || []).forEach(([frequency, offset, duration]) => {
      playTone(context, frequency, now + offset, duration, effectVolume, kind === "hop" ? "sine" : "triangle");
    });
  }

  function animateRoll(sides, onComplete) {
    if (rolling) return;

    playSfx("dice");
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
    playSfx("win");
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
    const previousBattlePositions = {
      [battleAttacker.id]: updated[attackerIndex].position,
      [battleDefender.id]: updated[defenderIndex].position
    };

    const battleResult = resolveBattle(
      attackerScore,
      defenderScore,
      battleAttacker,
      battleDefender,
      attackerIndex,
      defenderIndex,
      updated
    );
    const movedBattlePlayers = [updated[attackerIndex], updated[defenderIndex]]
      .filter(p => p.position !== previousBattlePositions[p.id])
      .map(p => p.id);

    const afterBattleMove = () => {
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
    };

    const movedPlayerId = movedBattlePlayers[0];
    if (movedPlayerId) {
      const movedPlayer = updated.find(p => p.id === movedPlayerId);
      animatePlayerMovement(
        movedPlayerId,
        getMovementPath(previousBattlePositions[movedPlayerId], movedPlayer.position),
        updated,
        afterBattleMove
      );
    } else {
      setPlayers(updated);
      afterBattleMove();
    }
  }

  function handleBattleRoll() {
    if (rolling || moving) return;

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
        playSfx("battleWin");
        const leader = battleLeader.customName;
        const bonusText = defenderBonus > 0 ? ` + ${defenderBonus} element advantage` : "";
        setMessage(`${battleDefender.customName} rolled ${d} + ${battleDefender.power} power + ${battleDefender.trophies} trophies${bonusText} = ${defenderScore}. ${leader} wins the battle!`);
        setBattlePhase('result');
      });
    }
  }

  function handleRoll() {
    if (winner || battleMode || rolling || moving) return;

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

      const startPosition = p.position;
      let newPosition = Math.min(p.position + d, board.length - 1);
      p.position = newPosition;
      let type = board[newPosition];
      let movementPath = getMovementPath(startPosition, newPosition);

      let turnMessage = `${p.customName} rolled ${d} and moved to space ${newPosition}.`;

      if (type === "boost") {
        playSfx("boost");
        const effectStart = p.position;
        p.position = Math.min(p.position + 2, board.length - 1);
        movementPath = [...movementPath, ...getMovementPath(effectStart, p.position)];
        turnMessage += " Boost! Move forward 2.";
      }

      if (type === "trap") {
        playSfx("trap");
        const effectStart = p.position;
        p.position = Math.max(p.position - 2, 0);
        movementPath = [...movementPath, ...getMovementPath(effectStart, p.position)];
        turnMessage += " Trap! Move back 2.";
      }

      if (type === "mystery") {
        playSfx("mystery");
        const effects = [
          () => {
            const effectStart = p.position;
            p.position = Math.min(p.position + 3, board.length - 1);
            movementPath = [...movementPath, ...getMovementPath(effectStart, p.position)];
            return "Mystery power! Move forward 3.";
          },
          () => {
            const effectStart = p.position;
            p.position = Math.max(p.position - 3, 0);
            movementPath = [...movementPath, ...getMovementPath(effectStart, p.position)];
            return "Oops! Move back 3.";
          },
          () => { p.trophies += 1; return "Lucky find! Gain 1 trophy."; },
          () => { p.skip = true; return "Sticky slime! Skip your next turn."; }
        ];
        turnMessage += " " + effects[roll(4) - 1]();
      }

      if (type === "restart") {
        playSfx("trap");
        const effectStart = p.position;
        p.position = 0;
        movementPath = [...movementPath, ...getMovementPath(effectStart, p.position)];
        turnMessage += " Back to start!";
      }

      updated[current] = p;
      animatePlayerMovement(p.id, movementPath, updated, () => {
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
          playSfx("battleStart");

          setMessage(`⚔️ BATTLE! ${p.customName} landed on a battle space vs ${opponent.customName}! ${p.customName}, roll for battle!`);
          addLog(`⚔️ Battle! ${p.customName} vs ${opponent.customName}`);
          return;
        }

        if (p.position >= board.length - 1) {
          const finalScore = roll(20) + p.trophies + p.power;
          const finalWinner = { ...p, finalScore };
          playSfx("win");
          setWinner(finalWinner);
          setMessage(`${p.customName} reached the Final Battle and wins Battle Showdown! Final score: ${finalScore}`);
          addLog(`🏆 ${p.customName} wins Battle Showdown!`);
          return;
        }

        setMessage(turnMessage);
        addLog(turnMessage);
        nextTurn(updated);
      });
    });
  }

  return (
    <div className="app">
      <audio ref={musicRef} src={MUSIC_SRC} preload="auto" loop />
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
          <button className="rules-toggle" onClick={() => setRulesOpen(true)}>
            <HelpCircle size={18} /> Rules
          </button>
          <button className="music-toggle" onClick={toggleMusic} aria-label={musicOn ? "Turn music off" : "Turn music on"}>
            {musicOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
            {musicOn ? "Music On" : "Music Off"}
          </button>
          <button className="sound-toggle" onClick={toggleSound} aria-label={soundOn ? "Turn sound effects off" : "Turn sound effects on"}>
            {soundOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
            {soundOn ? "SFX On" : "SFX Off"}
          </button>
          <button className="theme-toggle" onClick={toggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}>
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            {theme === "dark" ? "Light" : "Dark"}
          </button>
        </div>
      </header>

      {rulesOpen && (
        <div className="modal-layer" role="dialog" aria-modal="true" aria-labelledby="rules-title">
          <button className="modal-backdrop" aria-label="Close rules" onClick={() => setRulesOpen(false)} />
          <section className="rules-modal">
            <div className="modal-header">
              <div>
                <p className="intro-kicker">Rule Book</p>
                <h2 id="rules-title">How to Play</h2>
              </div>
              <button className="modal-close" aria-label="Close rules" onClick={() => setRulesOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="rules-grid">
              <article>
                <h3>Goal</h3>
                <p>Reach the finish space or collect 4 trophies. Either one wins the game immediately.</p>
              </article>

              <article>
                <h3>Turn Order</h3>
                <p>Players take turns in numbered order. Drag players on the setup screen before starting to change the order.</p>
              </article>

              <article>
                <h3>Movement</h3>
                <p>Roll a 6-sided die, then hop space by space. Space effects resolve after the piece finishes moving.</p>
              </article>

              <article>
                <h3>Spaces</h3>
                <ul>
                  <li><b>BATTLE:</b> start a battle.</li>
                  <li><b>+2:</b> move forward 2 more spaces.</li>
                  <li><b>-2:</b> move back 2 spaces.</li>
                  <li><b>?:</b> random mystery effect.</li>
                  <li><b>RESTART:</b> go back to start.</li>
                  <li><b>FINISH:</b> win the game.</li>
                </ul>
              </article>

              <article>
                <h3>Battles</h3>
                <p>The current player is the attacker and rolls first. The defender rolls second. Highest total wins; ties go to the attacker.</p>
                <p className="score-rule">Battle total = die + power + trophies + element advantage.</p>
              </article>

              <article>
                <h3>Choosing Opponents</h3>
                <p>If you land on another player, you battle that player. If you land on an empty battle space, another player is chosen at random.</p>
              </article>

              <article>
                <h3>Battle Rewards</h3>
                <p>The battle winner gains 1 trophy. The loser moves back 2 spaces. A player wins instantly when they reach 4 trophies.</p>
              </article>

              <article>
                <h3>Elements</h3>
                <ul>
                  <li>Water beats Fire.</li>
                  <li>Fire beats Leaf.</li>
                  <li>Leaf beats Lightning.</li>
                  <li>Lightning beats Water.</li>
                </ul>
                <p>Element advantage adds +1 to the battle total.</p>
              </article>

              <article>
                <h3>Mystery Effects</h3>
                <ul>
                  <li>Move forward 3.</li>
                  <li>Move back 3.</li>
                  <li>Gain 1 trophy.</li>
                  <li>Skip your next turn.</li>
                </ul>
              </article>
            </div>
          </section>
        </div>
      )}

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
              {setupCharacters.slice(0, playerCount).map((c, index) => (
                <div
                  key={c.id}
                  className={`name-input-row ${draggedPlayerId === c.id ? "dragging" : ""}`}
                  draggable
                  onDragStart={() => setDraggedPlayerId(c.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => reorderPlayers(c.id)}
                  onDragEnd={() => setDraggedPlayerId(null)}
                >
                  <span className="order-badge">{index + 1}</span>
                  <span className="drag-handle" aria-label="Drag to reorder">
                    <GripVertical size={18} />
                  </span>
                  <button
                    type="button"
                    className="avatar element-button"
                    style={{ background: c.color }}
                    onClick={() => cycleElement(c.id)}
                    title={`Change element: ${c.elementName}`}
                  >
                    <PlayerIcon player={c} />
                    <span>{c.elementName}</span>
                  </button>
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
              <button className={`roll battle-btn ${battlePhase === 'result' ? "continue-btn" : ""}`} onClick={handleBattleRoll} disabled={rolling || moving}>
                {battleRoller ? <PlayerIcon player={battleRoller} size={20} /> : <Dice5 />}
                {rolling && battlePhase !== 'result' ? "Rolling..." : battleButtonLabel}
              </button>
            ) : (
              <button className="roll" onClick={handleRoll} disabled={rolling || moving}>
                <Dice5 /> {rolling ? "Rolling..." : moving ? "Moving..." : "Roll Dice"}
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
                    <span
                      key={p.id}
                      title={p.customName}
                      className={hoppingPlayerIds.includes(p.id) ? "token-hop" : ""}
                      style={{ background: p.color }}
                    >
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
              <span className="order-badge">{index + 1}</span>
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
