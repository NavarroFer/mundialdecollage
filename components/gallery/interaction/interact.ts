import { currentAim, useWallStore } from '../wall/store'
import { useInteractionStore } from './store'

/**
 * E (or the touch E button): opens the obra in front of the visitor, or
 * closes whatever is open — and, looking at the collective collage with no
 * obra in sight, opens the dialog to paste a photo right there.
 */
export function interact() {
  const interaction = useInteractionStore.getState()
  if (interaction.openId || interaction.targetId) {
    interaction.toggle()
    return
  }
  const wall = useWallStore.getState()
  if (wall.placing) wall.close()
  else if (currentAim.point) wall.open({ ...currentAim.point })
}
