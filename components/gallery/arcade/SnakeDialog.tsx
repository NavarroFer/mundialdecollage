'use client'

import { useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { canTurn, newGame, SIZE, step, type Direction, type SnakeGame } from './snake'
import { useArcadeStore } from './store'
import styles from './snake.module.css'

export function SnakeDialog() {
  const open = useArcadeStore((state) => state.open)
  return <Dialog open={open} onOpenChange={(value) => useArcadeStore.getState().setOpen(value)}>{open && <SnakeScreen />}</Dialog>
}
function SnakeScreen() {
  const [game, setGame] = useState<SnakeGame | null>(null)
  const [labyrinth, setLabyrinth] = useState(false)
  const [difficulty, setDifficulty] = useState(1)
  const [paused, setPaused] = useState(false)
  const [best, setBest] = useState(() => { try { return Number(localStorage.getItem('mdc-snake-best')) || 0 } catch { return 0 } })
  const direction = useRef<Direction>('right')
  const queued = useRef(false)
  const gameRef = useRef(game)
  const start = () => { const next = newGame(labyrinth); direction.current = 'right'; queued.current = false; gameRef.current = next; setGame(next); setPaused(false) }
  const turn = (next: Direction) => {
    const current = gameRef.current
    if (!current || queued.current || !canTurn(current.direction, next)) return
    direction.current = next; queued.current = true
  }
  useEffect(() => {
    if (!game || game.status !== 'playing' || paused) return
    const timer = window.setInterval(() => {
      const current = gameRef.current
      if (!current) return
      const next = step(current, direction.current)
      queued.current = false; gameRef.current = next; setGame(next)
      if (next.score > best) { setBest(next.score); try { localStorage.setItem('mdc-snake-best', String(next.score)) } catch { /* Storage may be unavailable. */ } }
    }, [200, 135, 85][difficulty])
    return () => window.clearInterval(timer)
  }, [game, difficulty, paused, best])
  useEffect(() => {
    const keys: Record<string, Direction> = { ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down', ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right' }
    const key = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return
      const next = keys[event.key] ?? keys[event.key.toLowerCase()]
      if (next) { event.preventDefault(); turn(next) }
      if (event.code === 'Space' && event.target instanceof HTMLElement && !event.target.closest('button, select')) { event.preventDefault(); setPaused((value) => !value) }
    }
    const pause = () => setPaused(true)
    window.addEventListener('keydown', key); window.addEventListener('blur', pause)
    document.addEventListener('visibilitychange', pause)
    return () => { window.removeEventListener('keydown', key); window.removeEventListener('blur', pause); document.removeEventListener('visibilitychange', pause) }
  }, [])
  return <DialogContent className={styles.cabinet} showClose={false} aria-describedby="snake-help">
    <header className={styles.header}><span>MDC / ARCADE 01</span><button onClick={() => useArcadeStore.getState().setOpen(false)} aria-label="Cerrar Snake">✕</button></header>
    <DialogTitle className={styles.title}>SNAKE</DialogTitle>
    <div className={styles.screen}>
      <div className={styles.score}><span>SCORE {String(game?.score ?? 0).padStart(3, '0')}</span><span>BEST {String(best).padStart(3, '0')}</span></div>
      {!game ? <div className={styles.menu}>
        <div className={styles.logo} aria-hidden="true">▰▰▰▰<br />▰<br />▰▰▰▰▰</div>
        <p>UN DESCANSO ENTRE OBRAS</p>
        <button onClick={start}>JUGAR →</button>
        <label>MAPA<select value={String(labyrinth)} onChange={(e) => setLabyrinth(e.target.value === 'true')}><option value="false">Clásico</option><option value="true">Laberinto</option></select></label>
        <label>DIFICULTAD<select value={difficulty} onChange={(e) => setDifficulty(Number(e.target.value))}><option value={0}>Tranquilo</option><option value={1}>Normal</option><option value={2}>Rápido</option></select></label>
      </div> : <div className={styles.board}>
        <svg viewBox={`0 0 ${SIZE * 10} ${SIZE * 10}`} role="img" aria-label={`Snake. Puntaje: ${game.score}`}>
          <defs><pattern id="snake-grid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M 10 0 L 0 0 0 10" fill="none" stroke="#141d2a" strokeWidth="0.6" /></pattern></defs>
          <rect width="200" height="200" fill="url(#snake-grid)" />
          {game.walls.map(({ x, y }) => <rect key={`w${x},${y}`} x={x * 10 + 0.7} y={y * 10 + 0.7} width="8.6" height="8.6" fill="#8792a5" />)}
          {game.snake.map(({ x, y }, i) => <rect key={`${x},${y}`} x={x * 10 + 0.7} y={y * 10 + 0.7} width="8.6" height="8.6" fill={i ? '#72da3f' : '#dafa79'} />)}
          {game.food && <rect x={game.food.x * 10 + 1} y={game.food.y * 10 + 1} width="8" height="8" fill="#ed3438" />}
        </svg>
        {(paused || game.status !== 'playing') && <div className={styles.cover}><strong>{game.status === 'lost' ? 'GAME OVER' : game.status === 'won' ? '¡GANASTE!' : 'PAUSA'}</strong><p>{game.score} PUNTOS</p><button onClick={game.status === 'playing' ? () => setPaused(false) : start}>{game.status === 'playing' ? 'CONTINUAR' : 'OTRA PARTIDA'}</button><button onClick={() => { gameRef.current = null; setGame(null) }}>MENÚ</button></div>}
      </div>}
    </div>
    <div className={styles.controls}>
      <div className={styles.pad} aria-label="Dirección de la serpiente">{(['up', 'left', 'down', 'right'] as Direction[]).map((value, i) => <button key={value} className={styles[value]} aria-label={['Arriba', 'Izquierda', 'Abajo', 'Derecha'][i]} onPointerDown={(e) => { e.preventDefault(); turn(value) }} onClick={() => turn(value)}>{['▲', '◀', '▼', '▶'][i]}</button>)}</div>
      <div><button disabled={!game || game.status !== 'playing'} onClick={() => setPaused((value) => !value)}>{paused ? 'SEGUIR' : 'PAUSA'}</button><p>FREE PLAY<br />SIN FICHAS</p></div>
    </div>
    <p id="snake-help" className={styles.help}>Flechas / WASD o cruceta · Comé el rojo. Evitá las paredes y tu cola.</p>
  </DialogContent>
}
