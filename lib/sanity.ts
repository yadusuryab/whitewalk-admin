/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@sanity/client'
import imageUrlBuilder from '@sanity/image-url'

export const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
  apiVersion: '2024-01-01',
  useCdn: true, // cached, cheaper reads
})

const builder = imageUrlBuilder(client)

export function urlFor(source: any, width = 600) {
  return builder.image(source).width(width).auto('format').quality(70).url()
}

export interface Shoe {
  _id: string
  _type: 'shoe'
  orderNumber: number
  productName: string
  shoeBrand: string
  category: string
  sizes: number[]
  colorVariants: string[]
  tags: string[]
  images: any[]
  description: string
  madeIn: string
  price: number
  isOffer: boolean
  offerPrice?: number
  buyOneGetOne: boolean
  stock: number
  isDisabled: boolean
  disableReason?: string
}

const REVALIDATE = { next: { revalidate: 3600, tags: ['shoes'] } }

// Slim list: first image only, no description
export async function getAllShoes() {
  return client.fetch(
    `*[_type == "shoe"] | order(orderNumber asc) {
      _id, orderNumber, productName, shoeBrand, category,
      price, isOffer, offerPrice, buyOneGetOne, stock, isDisabled,
      "image": images[0]
    }`,
    {},
    REVALIDATE,
  )
}

// Full data only on the product page
export async function getShoe(id: string): Promise<Shoe> {
  return client.fetch(
    `*[_type == "shoe" && _id == $id][0]{
      _id, _type, orderNumber, productName, shoeBrand, category, sizes,
      colorVariants, tags, images, description, madeIn, price, isOffer,
      offerPrice, buyOneGetOne, stock, isDisabled, disableReason
    }`,
    { id },
    REVALIDATE,
  )
}