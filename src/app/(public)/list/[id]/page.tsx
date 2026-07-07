import type { Metadata } from 'next'
import ListRoute, { buildListMetadata } from '@/lib/listRoute'

type Params = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params
  return buildListMetadata(id)
}

export default async function ListPage() {
  return <ListRoute />
}
