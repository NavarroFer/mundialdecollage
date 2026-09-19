import { describe, expect, it } from 'vitest'
import { extractDriveFileId } from './legacy-submissions'

describe('extractDriveFileId', () => {
  it('pulls the file id out of a standard share link', () => {
    expect(
      extractDriveFileId('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view?usp=sharing'),
    ).toBe('1AbCdEfGhIjKlMnOp')
  })

  it('works without query params', () => {
    expect(extractDriveFileId('https://drive.google.com/file/d/1AbCdEfGh/view')).toBe(
      '1AbCdEfGh',
    )
  })

  it('returns null for a link with no /file/d/ segment', () => {
    expect(extractDriveFileId('https://drive.google.com/drive/folders/1AbCdEfGh')).toBeNull()
  })

  it('returns null for garbage input', () => {
    expect(extractDriveFileId('not a url at all')).toBeNull()
    expect(extractDriveFileId('')).toBeNull()
  })
})
