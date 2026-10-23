'use client'

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { useGalleryPreferences } from '../preferences/store'
import { musicController, skipTrack, TRACKS, useVinylStore } from './store'
import styles from './vinyl.module.css'

const clock = (time: number) => `${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, '0')}`
export function VinylDialog() {
  const state = useVinylStore()
  const volume = useGalleryPreferences((s) => s.volume)
  const muted = useGalleryPreferences((s) => s.muted)
  const track = TRACKS[state.index]
  return <Dialog open={state.open} onOpenChange={state.setOpen}>
    <DialogContent className={styles.player} showClose={false} aria-describedby="vinyl-description">
      <header className={styles.top}><span>MDC — STEREO SYSTEM</span><button onClick={() => state.setOpen(false)} aria-label="Cerrar consola">✕</button></header>
      <div className={styles.grille} aria-hidden="true" />
      <div className={styles.heading}><DialogTitle className={styles.title}>La discoteca</DialogTitle><span>33⅓ RPM</span></div>
      <p id="vinyl-description" className={styles.description}>Elegí la música para tu recorrido.</p>
      <section className={styles.deck} aria-label="Reproductor">
        <div className={styles.label}><small>LADO A · {String(state.index + 1).padStart(2, '0')}</small><strong>{track.title}</strong><span>{track.composer}</span></div>
        <div className={styles.tape} data-playing={state.playing} aria-hidden="true"><i /><div><span />STEREO</div><i /></div>
        <div className={styles.readout}><span>{clock(state.time)}</span><span>{state.loading ? 'CARGANDO…' : state.playing ? 'REPRODUCIENDO' : 'EN PAUSA'}</span><span>{clock(state.duration)}</span></div>
        <input className={styles.seek} aria-label="Posición de la canción" type="range" min={0} max={state.duration || 1} step={1} value={Math.min(state.time, state.duration || 1)} disabled={!state.duration} onChange={(e) => musicController.current?.seek(Number(e.target.value))} />
      </section>
      <div className={styles.transport}>
        {[
          { title: 'Detener', symbol: '■', action: () => musicController.current?.stop() },
          { title: 'Reproducir', symbol: '▶', action: () => musicController.current?.play() },
          { title: 'Pausar', symbol: 'Ⅱ', action: () => musicController.current?.pause() },
          { title: 'Anterior', symbol: '◀◀', action: () => skipTrack(-1) },
          { title: 'Siguiente', symbol: '▶▶', action: () => skipTrack(1) },
        ].map(({ title, symbol, action }) => <button key={title} onClick={action} aria-label={title} title={title}><span>{symbol}</span><small>{title}</small></button>)}
      </div>
      <div className={styles.settings}><button aria-pressed={state.shuffle} onClick={() => useVinylStore.setState({ shuffle: !state.shuffle })}><span className={styles.switch} data-on={state.shuffle} />ALEATORIO</button><label>VOL<input aria-label="Volumen de la música" type="range" min={0} max={100} value={muted ? 0 : volume} onChange={(e) => musicController.current?.setVolume(Number(e.target.value))} /></label></div>
      {state.error && <p role="alert" className={styles.error}>{state.error}</p>}
      <ol className={styles.tracks} aria-label="Canciones disponibles">{TRACKS.map((song, i) => <li key={song.id}><button aria-pressed={state.index === i} onClick={() => musicController.current?.select(i)}><span>{String(i + 1).padStart(2, '0')}</span><span><strong>{song.title}</strong><small>{song.composer}</small></span><span aria-hidden="true">{state.index === i && state.playing ? '♫' : '▷'}</span></button></li>)}</ol>
      {track.source && <p className={styles.credit}>{track.performer} · Cortesía de Musopen<br /><a href={track.source} target="_blank" rel="noreferrer">Grabación: {track.license} ↗</a></p>}
    </DialogContent>
  </Dialog>
}
