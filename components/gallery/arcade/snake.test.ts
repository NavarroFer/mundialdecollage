import { describe, expect, it } from 'vitest'
import { foodFor, newGame, SIZE, step } from './snake'

describe('Snake', () => {
  it('rejects reversing into the neck', () => {
    const game = newGame()
    expect(step(game, 'left').snake[0]).toEqual({ x: 6, y: 10 })
  })
  it('grows and scores when eating, placing food in a free cell', () => {
    const next = step({ ...newGame(true), food: { x: 6, y: 10 } }, 'right', () => 0)
    expect(next.snake).toHaveLength(4)
    expect(next.score).toBe(10)
    expect([...next.snake, ...next.walls]).not.toContainEqual(next.food)
  })
  it('ends on boundary, obstacle and body collisions', () => {
    expect(step({ ...newGame(), snake: [{ x: 19, y: 10 }] }, 'right').status).toBe('lost')
    expect(step({ ...newGame(), walls: [{ x: 6, y: 10 }] }, 'right').status).toBe('lost')
    expect(step({ ...newGame(), snake: [{ x: 5, y: 10 }, { x: 5, y: 9 }, { x: 6, y: 9 }, { x: 6, y: 10 }, { x: 7, y: 10 }] }, 'right').status).toBe('lost')
  })
  it('allows moving into the vacating tail', () => {
    expect(step({ ...newGame(), snake: [{ x: 5, y: 10 }, { x: 5, y: 9 }, { x: 6, y: 9 }, { x: 6, y: 10 }], food: { x: 0, y: 0 } }, 'right').status).toBe('playing')
  })
  it('wins when the last free cell is eaten without looping on food placement', () => {
    const snake = Array.from({ length: SIZE * SIZE }, (_, i) => ({ x: i % SIZE, y: Math.floor(i / SIZE) })).filter(({ x, y }) => !(y === 0 && x < 2))
    const next = step({ ...newGame(), snake: [{ x: 0, y: 0 }, ...snake], food: { x: 1, y: 0 } }, 'right')
    expect(next.status).toBe('won')
    expect(foodFor(next.snake, [])).toBeNull()
  })
})
