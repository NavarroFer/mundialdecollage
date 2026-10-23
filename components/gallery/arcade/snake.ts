export const SIZE = 20
export type Cell = { x: number; y: number }
export type Direction = 'up' | 'down' | 'left' | 'right'
export type SnakeGame = { snake: Cell[]; direction: Direction; food: Cell | null; walls: Cell[]; score: number; status: 'playing' | 'lost' | 'won' }
const vectors: Record<Direction, Cell> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } }
export const sameCell = (a: Cell, b: Cell) => a.x === b.x && a.y === b.y
export function foodFor(snake: Cell[], walls: Cell[], random = Math.random): Cell | null {
  const free: Cell[] = []
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const cell = { x, y }
    if (![...snake, ...walls].some((other) => sameCell(cell, other))) free.push(cell)
  }
  return free.length ? free[Math.floor(random() * free.length)] : null
}
export function newGame(labyrinth = false): SnakeGame {
  const snake = [{ x: 5, y: 10 }, { x: 4, y: 10 }, { x: 3, y: 10 }]
  const walls = labyrinth ? Array.from({ length: 11 }, (_, x) => [{ x, y: 5 }, { x: x + 9, y: 14 }]).flat() : []
  return { snake, walls, direction: 'right', food: foodFor(snake, walls), score: 0, status: 'playing' }
}
export function canTurn(from: Direction, to: Direction) {
  return vectors[from].x + vectors[to].x !== 0 || vectors[from].y + vectors[to].y !== 0
}
export function step(game: SnakeGame, requested: Direction, random = Math.random): SnakeGame {
  if (game.status !== 'playing') return game
  const direction = canTurn(game.direction, requested) ? requested : game.direction
  const vector = vectors[direction]
  const head = { x: game.snake[0].x + vector.x, y: game.snake[0].y + vector.y }
  const eating = game.food !== null && sameCell(head, game.food)
  const body = eating ? game.snake : game.snake.slice(0, -1)
  if (head.x < 0 || head.y < 0 || head.x >= SIZE || head.y >= SIZE || [...body, ...game.walls].some((cell) => sameCell(head, cell))) return { ...game, direction, status: 'lost' }
  const snake = [head, ...body]
  const food = eating ? foodFor(snake, game.walls, random) : game.food
  return { ...game, snake, direction, food, score: game.score + (eating ? 10 : 0), status: food ? 'playing' : 'won' }
}
