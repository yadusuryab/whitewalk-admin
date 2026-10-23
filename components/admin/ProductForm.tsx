'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Shoe } from '@/lib/sanity'

interface ProductFormProps {
  initialData?: Shoe
}

const CATEGORIES = [
  { value: 'sneakers', label: 'Sneakers' },
  { value: 'boots', label: 'Boots' },
  { value: 'sandals', label: 'Sandals' },
  { value: 'loafers', label: 'Loafers' },
  { value: 'sports-shoes', label: 'Sports Shoes' },
  { value: 'formal-shoes', label: 'Formal Shoes' },
]

const SIZES = [6, 7, 8, 9, 10, 11, 12]

const label =
  'block text-[10px] font-bold uppercase tracking-[0.25em] text-foreground/50 mb-2 transition-colors group-focus-within:text-secondary'
const input =
  'w-full bg-transparent border-0 border-b border-foreground/20 px-0 py-2 text-base font-medium outline-none transition-all duration-300 placeholder:text-foreground/20 focus:border-secondary focus:pl-1'

function Field({
  title,
  hint,
  index = 0,
  children,
}: {
  title: string
  hint?: string
  index?: number
  children: React.ReactNode
}) {
  return (
    <div
      className="group animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <label className={label}>{title}</label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-foreground/40">{hint}</p>}
    </div>
  )
}

function Toggle({
  checked,
  onChange,
  children,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="group flex items-center gap-3 text-left"
    >
      <span
        className={`relative h-5 w-9 rounded-full border transition-all duration-300 ${
          checked ? 'bg-secondary border-secondary' : 'border-foreground/30'
        }`}
      >
        <span
          className={`absolute top-0.5 h-3.5 w-3.5 rounded-full transition-all duration-300 ${
            checked ? 'left-[18px] bg-white' : 'left-0.5 bg-foreground/40'
          }`}
        />
      </span>
      <span className="text-xs font-bold uppercase tracking-[0.15em] transition-all duration-300 group-hover:tracking-[0.22em]">
        {children}
      </span>
    </button>
  )
}

export default function ProductForm({ initialData }: ProductFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [formData, setFormData] = useState({
    orderNumber: initialData?.orderNumber || 0,
    productName: initialData?.productName || '',
    shoeBrand: initialData?.shoeBrand || '',
    category: initialData?.category || 'sneakers',
    sizes: initialData?.sizes || [8, 9, 10],
    colorVariants: initialData?.colorVariants || [],
    tags: initialData?.tags || [],
    description: initialData?.description || '',
    madeIn: initialData?.madeIn || '',
    price: initialData?.price || 0,
    isOffer: initialData?.isOffer || false,
    offerPrice: initialData?.offerPrice || 0,
    buyOneGetOne: initialData?.buyOneGetOne || false,
    stock: initialData?.stock || 0,
    isDisabled: initialData?.isDisabled || false,
    disableReason: initialData?.disableReason || '',
  })

  const set = <K extends keyof typeof formData>(key: K, value: (typeof formData)[K]) =>
    setFormData((prev) => ({ ...prev, [key]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const endpoint = initialData ? `/api/products/${initialData._id}` : '/api/products'
      const method = initialData ? 'PUT' : 'POST'

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        router.push('/admin/products')
        router.refresh()
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to save product')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-3xl space-y-12 pb-28 md:pb-0">
      <h1 className="animate-in fade-in slide-in-from-top-2 duration-700 text-4xl md:text-6xl font-black uppercase tracking-[-0.04em] leading-none">
        {initialData ? 'Edit' : 'New'}{' '}
        <span className="font-light italic tracking-tight">Product</span>
      </h1>

      {error && (
        <div className="animate-in fade-in slide-in-from-top-2 border-l-2 border-red-500 bg-red-500/5 px-4 py-3">
          <p className="text-sm font-medium text-red-600">{error}</p>
        </div>
      )}

      {/* 01 Basics */}
      <section className="space-y-8">
        <h3 className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.3em]">
          <span className="text-secondary">01</span>
          <span className="h-px flex-1 bg-foreground/10" />
          Basics
        </h3>
        <div className="grid grid-cols-1 gap-x-10 gap-y-8 md:grid-cols-2">
          <Field index={0} title="Product Name *">
            <input
              type="text"
              value={formData.productName}
              onChange={(e) => set('productName', e.target.value)}
              className={input}
              required
            />
          </Field>
          <Field index={1} title="Brand *">
            <input
              type="text"
              value={formData.shoeBrand}
              onChange={(e) => set('shoeBrand', e.target.value)}
              className={input}
              required
            />
          </Field>
          <Field index={2} title="Category *">
            <select
              value={formData.category}
              onChange={(e) => set('category', e.target.value)}
              className={`${input} cursor-pointer`}
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </Field>
          <Field index={3} title="Order Number *" hint="Lower numbers appear first">
            <input
              type="number"
              value={formData.orderNumber}
              onChange={(e) => set('orderNumber', Number(e.target.value))}
              className={input}
              required
            />
          </Field>
        </div>
      </section>

      {/* 02 Pricing */}
      <section className="space-y-8">
        <h3 className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.3em]">
          <span className="text-secondary">02</span>
          <span className="h-px flex-1 bg-foreground/10" />
          Pricing & Stock
        </h3>
        <div className="grid grid-cols-1 gap-x-10 gap-y-8 md:grid-cols-2">
          <Field index={0} title="Price (₹) *">
            <input
              type="number"
              step="0.01"
              value={formData.price}
              onChange={(e) => set('price', Number(e.target.value))}
              className={input}
              required
            />
          </Field>
          <Field index={1} title="Stock *">
            <input
              type="number"
              value={formData.stock}
              onChange={(e) => set('stock', Number(e.target.value))}
              className={input}
              required
            />
          </Field>
          {formData.isOffer && (
            <Field index={0} title="Offer Price (₹)">
              <input
                type="number"
                step="0.01"
                value={formData.offerPrice}
                onChange={(e) => set('offerPrice', Number(e.target.value))}
                className={input}
              />
            </Field>
          )}
        </div>
        <div className="flex flex-wrap gap-x-8 gap-y-4">
          <Toggle checked={formData.isOffer} onChange={(v) => set('isOffer', v)}>
            On Offer
          </Toggle>
          <Toggle checked={formData.buyOneGetOne} onChange={(v) => set('buyOneGetOne', v)}>
            Buy 1 Get 1
          </Toggle>
        </div>
      </section>

      {/* 03 Sizes */}
      <section className="space-y-6">
        <h3 className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.3em]">
          <span className="text-secondary">03</span>
          <span className="h-px flex-1 bg-foreground/10" />
          Sizes
        </h3>
        <div className="flex flex-wrap gap-2">
          {SIZES.map((size, i) => {
            const active = formData.sizes.includes(size)
            return (
              <button
                key={size}
                type="button"
                onClick={() =>
                  set(
                    'sizes',
                    (active
                      ? formData.sizes.filter((s) => s !== size)
                      : [...formData.sizes, size]
                    ).sort((a, b) => a - b)
                  )
                }
                style={{ animationDelay: `${i * 40}ms` }}
                className={`animate-in fade-in zoom-in-95 fill-mode-both h-12 w-12 rounded-full border text-sm font-bold transition-all duration-300 ${
                  active
                    ? 'scale-105 border-secondary bg-secondary text-white shadow-lg shadow-secondary/30'
                    : 'border-foreground/20 text-foreground/50 hover:border-foreground hover:text-foreground'
                }`}
              >
                {size}
              </button>
            )
          })}
        </div>
      </section>

      {/* 04 Details */}
      <section className="space-y-8">
        <h3 className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.3em]">
          <span className="text-secondary">04</span>
          <span className="h-px flex-1 bg-foreground/10" />
          Details
        </h3>
        <Field title="Description">
          <textarea
            value={formData.description}
            onChange={(e) => set('description', e.target.value)}
            rows={4}
            className={`${input} resize-none`}
          />
        </Field>
        <Toggle checked={formData.isDisabled} onChange={(v) => set('isDisabled', v)}>
          Disable Product
        </Toggle>
        {formData.isDisabled && (
          <Field title="Disable Reason">
            <input
              type="text"
              value={formData.disableReason}
              onChange={(e) => set('disableReason', e.target.value)}
              className={input}
            />
          </Field>
        )}
      </section>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 border-t border-foreground/10 pt-8">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-full px-6 py-3 text-xs font-bold uppercase tracking-[0.2em] text-foreground/50 transition-all duration-300 hover:text-foreground hover:tracking-[0.3em]"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-primary px-8 py-3 text-xs font-bold uppercase tracking-[0.2em] text-white shadow-xl shadow-black/20 transition-all duration-300 hover:bg-secondary hover:tracking-[0.3em] active:scale-95 disabled:opacity-50"
        >
          {loading ? 'Saving…' : initialData ? 'Update Product' : 'Create Product'}
        </button>
      </div>
    </form>
  )
}