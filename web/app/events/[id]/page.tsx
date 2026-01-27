import { redirect } from 'next/navigation'

export default async function EventPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/atlanta/events/${id}`)
}
