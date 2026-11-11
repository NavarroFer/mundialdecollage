import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PostComments } from '@/components/community/post-comments'
import { SimilarPosts } from '@/components/community/similar-posts'
import { Footer } from '@/components/footer'
import { SiteHeader } from '@/components/site-header'
import { getI18n } from '@/lib/i18n/server'
import { fmt } from '@/lib/i18n/format'
import { imageSrc } from '@/lib/image-src'
import { loadPublicPost } from '@/lib/community-server'
import { getSiteUrl } from '@/lib/site'

function absolute(src: string): string {
  return src.startsWith('http') ? src : `${getSiteUrl()}${src}`
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const { locale, m } = await getI18n()
  const post = await loadPublicPost(id, locale)
  if (!post) return {}
  const name = post.official ? m.community.officialName : post.author.name
  const title = fmt(m.community.postShareTitle, { name })
  const description = post.body.slice(0, 150)
  const image = absolute(imageSrc(post.imageUrl, 1200))
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: image, alt: post.imageAlt || title }],
    },
  }
}

export default async function CommunityPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { locale, m } = await getI18n()
  const post = await loadPublicPost(id, locale)
  if (!post) notFound()
  const t = m.community
  const name = post.official ? t.officialName : post.author.name
  return (
    <>
      <SiteHeader />
      <main className="bg-grain py-12 sm:py-16">
        <article className="mx-auto max-w-xl px-5 sm:px-8">
          <p className="text-sm font-semibold text-muted-foreground">
            {post.official ? name : <Link href={post.author.href} className="hover:underline">{name}</Link>}
          </p>
          <h1 className="font-display mt-2 text-3xl tracking-tight text-ink uppercase">{fmt(t.postShareTitle, { name })}</h1>
          {/* eslint-disable-next-line @next/next/no-img-element -- sized through /api/img */}
          <img src={imageSrc(post.imageUrl, 1200)} alt={post.imageAlt || name} className="mt-6 aspect-[4/5] w-full rounded-3xl object-cover" />
          {post.body && <p className="mt-6 whitespace-pre-line text-ink">{post.body}</p>}
          {post.artwork && (
            <p className="mt-4"><Link href={post.artwork.href} className="text-sm font-semibold underline">{post.artwork.title || t.seeAll}</Link></p>
          )}
          <PostComments postId={post.id} />
          <SimilarPosts postId={post.id} />
          <p className="mt-10"><Link href="/comunidad" className="text-sm font-semibold underline">{t.seeAll}</Link></p>
        </article>
      </main>
      <Footer />
    </>
  )
}
