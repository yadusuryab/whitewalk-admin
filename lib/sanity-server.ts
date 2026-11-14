import 'server-only'
import { createClient } from '@sanity/client'

export const writeClient = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
  apiVersion: '2024-01-01',
  useCdn: false,
  token: process.env.SANITY_WRITE_TOKEN, // no NEXT_PUBLIC_
})

export const getShoeAdmin = (id: string) =>
  writeClient.fetch(`*[_type == "shoe" && _id == $id][0]`, { id })

export const createShoe = (data: object) =>
  writeClient.create({ _type: 'shoe', ...data })

export const updateShoe = (id: string, data: object) =>
  writeClient.patch(id).set(data).commit()

export const deleteShoe = (id: string) => writeClient.delete(id)