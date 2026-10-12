import { afterEach, describe, expect, it } from 'vitest'
import { useInteractionStore } from './store'

afterEach(() => useInteractionStore.setState({ targetId: null, openId: null, detailsOpen: false, pendingReturn: null }))

describe('contemplation', () => {
  it('opens an obra with only its name, and the details on request', () => {
    const store = useInteractionStore.getState()
    store.open('obra')
    expect(useInteractionStore.getState()).toMatchObject({ openId: 'obra', detailsOpen: false })
    store.setDetails(true)
    store.close()
    store.open('otra')
    expect(useInteractionStore.getState()).toMatchObject({ openId: 'otra', detailsOpen: false })
  })

  it('opens E\'s target in contemplation too, and closes it', () => {
    useInteractionStore.setState({ targetId: 'obra', detailsOpen: true })
    useInteractionStore.getState().toggle()
    expect(useInteractionStore.getState()).toMatchObject({ openId: 'obra', detailsOpen: false })
    useInteractionStore.getState().toggle()
    expect(useInteractionStore.getState().openId).toBeNull()
  })

  it('comes back from signing in with the details open, where the like or comment finishes', () => {
    useInteractionStore.getState().resume({ slug: 'obra', intent: 'like' })
    expect(useInteractionStore.getState()).toMatchObject({ openId: 'obra', detailsOpen: true })
  })
})
