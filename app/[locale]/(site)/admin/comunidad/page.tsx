import { AdminPageHeader } from '@/components/admin/page-header'
import { SubmitButton } from '@/components/admin/submit-button'
import { communityAiBlocks } from '@/lib/community-ai'
import { readAiModerationEnabled } from '@/lib/community-settings'
import { getI18n } from '@/lib/i18n/server'
import { setCommunityModeration } from './actions'

export default async function ComunidadModerationPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>
}) {
  const params = await searchParams
  const { m } = await getI18n()
  const t = m.community
  const saved = await readAiModerationEnabled()
  const blocks = communityAiBlocks()
  const active = saved && !blocks.env && !blocks.key

  return (
    <div>
      <AdminPageHeader eyebrow={t.title} title={t.moderationTitle} description={t.moderationLead} />
      {blocks.env && (
        <p className="mt-4 max-w-xl rounded-xl border-2 border-collage-red/30 bg-collage-red/10 px-4 py-3 text-sm text-ink">{t.moderationForcedEnv}</p>
      )}
      {blocks.key && (
        <p className="mt-4 max-w-xl rounded-xl border-2 border-collage-red/30 bg-collage-red/10 px-4 py-3 text-sm text-ink">{t.moderationForcedKey}</p>
      )}
      {params.error && (
        <p className="mt-4 max-w-xl rounded-xl border-2 border-collage-red/30 bg-collage-red/10 px-4 py-3 text-sm text-ink">{params.error}</p>
      )}
      {params.ok === '1' && (
        <p role="status" className="mt-4 max-w-xl rounded-xl border-2 border-ink/10 bg-card px-4 py-3 text-sm text-ink">{t.moderationSaved}</p>
      )}
      <form action={setCommunityModeration} className="mt-8 max-w-xl rounded-2xl border-2 border-ink/10 bg-card p-5">
        <input type="hidden" name="enabled" value="off" />
        <label className="flex items-center gap-3 text-sm font-semibold text-ink">
          <input type="checkbox" name="enabled" value="on" defaultChecked={saved} className="size-4" />
          {t.moderationToggle}
        </label>
        <p className="mt-3 text-sm text-muted-foreground">{active ? t.moderationActive : t.moderationManual}</p>
        <SubmitButton className="mt-4" pendingLabel={t.moderationSave}>{t.moderationSave}</SubmitButton>
      </form>
    </div>
  )
}
