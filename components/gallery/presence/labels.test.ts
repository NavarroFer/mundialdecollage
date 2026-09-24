import { describe, expect, it } from 'vitest'
import { insideLabel, viewersLabel, waitingLabel } from './labels'
import es from '@/lib/i18n/messages/es'
import en from '@/lib/i18n/messages/en'
import ru from '@/lib/i18n/messages/ru'

const m = es.gallery.presence

describe('gallery presence labels', () => {
  it('tells a lone visitor they are the only one inside', () => {
    expect(insideLabel(1, 'es', m)).toBe('Solo vos en la galería')
    // Before the visitor's own presence has synced.
    expect(insideLabel(0, 'es', m)).toBe('Solo vos en la galería')
  })
  it('counts everyone inside, the visitor included', () => {
    expect(insideLabel(4, 'es', m)).toBe('4 personas en la galería')
  })
  it('stays silent on the start screen when nobody else is inside', () => {
    expect(waitingLabel(0, 'es', m)).toBeNull()
  })
  it('uses singular and plural for the people already inside', () => {
    expect(waitingLabel(1, 'es', m)).toBe('Ahora hay 1 persona recorriendo la exposición')
    expect(waitingLabel(7, 'es', m)).toBe('Ahora hay 7 personas recorriendo la exposición')
  })
  it('describes who else has the same obra open', () => {
    expect(viewersLabel(0, 'es', m)).toBeNull()
    expect(viewersLabel(1, 'es', m)).toBe('Otra persona está viendo esta obra ahora')
    expect(viewersLabel(3, 'es', m)).toBe('3 personas más están viendo esta obra ahora')
  })
  it('speaks the reader language, with its own plural forms', () => {
    expect(insideLabel(4, 'en', en.gallery.presence)).toBe('4 people in the gallery')
    expect(insideLabel(3, 'ru', ru.gallery.presence)).toBe('3 человека в галерее')
    expect(insideLabel(5, 'ru', ru.gallery.presence)).toBe('5 человек в галерее')
  })
})
