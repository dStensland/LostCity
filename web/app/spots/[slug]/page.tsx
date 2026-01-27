import { redirect } from 'next/navigation'

export default async function SpotPage({
  params
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  redirect(`/atlanta/spots/${slug}`)
}
