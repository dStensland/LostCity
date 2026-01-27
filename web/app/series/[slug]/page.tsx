import { redirect } from 'next/navigation'

export default async function SeriesPage({
  params
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  redirect(`/atlanta/series/${slug}`)
}
