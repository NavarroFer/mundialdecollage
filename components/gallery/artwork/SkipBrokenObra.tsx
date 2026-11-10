'use client'

import { Component, type ReactNode } from 'react'

// An obra whose photo can't be loaded as a texture (a file that isn't really
// an image, a deleted upload) makes useTexture throw. With nothing to catch
// it, the throw took down the whole 3D scene for every visitor. This catches
// it where it happens and leaves that one obra off the wall — an empty spot,
// the rest of the gallery intact.
export class SkipBrokenObra extends Component<{ id: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.warn('gallery: obra skipped, its image could not be loaded', this.props.id, error)
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}
