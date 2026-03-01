'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Globe, Linkedin, Github, Twitter, Camera, Loader2, X, CheckCircle2 } from 'lucide-react'
import OnboardingProgress from '@/components/onboarding-progress'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'
import { DICEBEAR_BASE_URL } from '@/lib/constants'
import type { Profile } from '@/types'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5 MB

function isValidUrl(val: string) {
  if (!val) return true // optional
  try { new URL(val); return true } catch { return false }
}

interface UrlFieldProps {
  icon: React.ReactNode
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
}

function UrlField({ icon, label, value, onChange, placeholder }: UrlFieldProps) {
  const [touched, setTouched] = useState(false)
  const invalid = touched && value.length > 0 && !isValidUrl(value)

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</span>
        <input
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder={placeholder}
          className={cn(
            'w-full rounded-md border pl-9 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400',
            'focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition',
            invalid ? 'border-red-300 bg-red-50' : 'border-slate-300 bg-white',
          )}
        />
      </div>
      {invalid && <p className="text-xs text-red-500 mt-1">Please enter a valid URL (include https://)</p>}
    </div>
  )
}

export default function SocialPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [name, setName]               = useState('')
  const [bio, setBio]                 = useState('')
  const [portfolioUrl, setPortfolio]  = useState('')
  const [linkedinUrl, setLinkedin]    = useState('')
  const [githubUrl, setGithub]        = useState('')
  const [twitterUrl, setTwitter]      = useState('')
  const [imageUrl, setImageUrl]       = useState<string | null>(null)
  const [imageReading, setImageReading] = useState(false)

  useEffect(() => {
    try {
      const prefill = JSON.parse(sessionStorage.getItem('onboarding_prefill') ?? '{}') as Partial<Profile>
      if (prefill.name)          setName(prefill.name)
      if (prefill.bio)           setBio(prefill.bio)
      if (prefill.portfolio_url) setPortfolio(prefill.portfolio_url)
      if (prefill.linkedin_url)  setLinkedin(prefill.linkedin_url)
      if (prefill.github_url)    setGithub(prefill.github_url)
      if (prefill.twitter_url)   setTwitter(prefill.twitter_url)
      console.log('[social] prefill loaded, name:', prefill.name)
    } catch (e) { console.error('[social] prefill error:', e) }

    // Restore photo preview if user navigates back
    try {
      const savedPhoto = sessionStorage.getItem('onboarding_photo')
      if (savedPhoto) setImageUrl(savedPhoto)
    } catch { /* ignore */ }
  }, [])

  // ── Photo selection (stored locally; uploaded to Supabase after profile insert) ─
  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // reset so same file can be re-selected
    if (!file) return

    if (file.size > MAX_IMAGE_BYTES) {
      toast('Image must be under 5 MB', 'error')
      return
    }

    setImageReading(true)
    const ext = file.name.split('.').pop() ?? 'jpg'
    console.log('[social] reading photo into base64:', file.name, file.size)

    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result as string
      try {
        sessionStorage.setItem('onboarding_photo', base64)
        sessionStorage.setItem('onboarding_photo_ext', ext)
        console.log('[social] photo stored in sessionStorage, ext:', ext)
      } catch (storageErr) {
        console.error('[social] sessionStorage write failed:', storageErr)
        toast('Failed to store photo locally', 'error')
      }
      setImageUrl(base64)
      setImageReading(false)
    }
    reader.onerror = () => {
      console.error('[social] FileReader error')
      toast('Failed to read image file', 'error')
      setImageReading(false)
    }
    reader.readAsDataURL(file)
  }

  function removePhoto() {
    setImageUrl(null)
    sessionStorage.removeItem('onboarding_photo')
    sessionStorage.removeItem('onboarding_photo_ext')
    console.log('[social] photo removed')
  }

  const urlsValid = [portfolioUrl, linkedinUrl, githubUrl, twitterUrl].every(isValidUrl)
  const canNext = name.trim().length > 0 && urlsValid && !imageReading

  function handleNext() {
    // image_url is NOT saved here — photo lives in sessionStorage 'onboarding_photo'
    // and will be uploaded to Supabase after the profile row is inserted (review step)
    const data = {
      name:          name.trim(),
      bio:           bio.trim(),
      portfolio_url: portfolioUrl.trim() || null,
      linkedin_url:  linkedinUrl.trim()  || null,
      github_url:    githubUrl.trim()    || null,
      twitter_url:   twitterUrl.trim()   || null,
    }
    try {
      const existing = JSON.parse(sessionStorage.getItem('onboarding_data') ?? '{}')
      sessionStorage.setItem('onboarding_data', JSON.stringify({ ...existing, ...data }))
      console.log('[social] saved to onboarding_data')
    } catch (e) { console.error('[social] save error:', e) }
    router.push('/onboarding/details')
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 pt-12 pb-16">
      <div className="max-w-2xl mx-auto">
        <OnboardingProgress step={1} total={4} />

        <h1 className="text-2xl font-bold text-slate-900 mb-2">Your Profile</h1>
        <p className="text-slate-500 text-sm mb-8">Tell us about yourself and where to find you online.</p>

        <div className="flex flex-col gap-5">
          {/* Name */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ada Lovelace"
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
            />
          </div>

          {/* Bio */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-slate-700">Bio</label>
              <span className="text-xs text-slate-400">{bio.length} chars</span>
            </div>
            <textarea
              rows={4}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="A brief professional summary in your own words…"
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-y transition"
            />
          </div>

          {/* Social links */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-slate-800 mb-4">Social &amp; Portfolio Links</h2>
            <div className="flex flex-col gap-4">
              <UrlField
                icon={<Globe className="w-4 h-4" />}
                label="Portfolio / Website"
                value={portfolioUrl}
                onChange={setPortfolio}
                placeholder="https://yoursite.com"
              />
              <UrlField
                icon={<Linkedin className="w-4 h-4" />}
                label="LinkedIn"
                value={linkedinUrl}
                onChange={setLinkedin}
                placeholder="https://linkedin.com/in/yourname"
              />
              <UrlField
                icon={<Github className="w-4 h-4" />}
                label="GitHub"
                value={githubUrl}
                onChange={setGithub}
                placeholder="https://github.com/yourusername"
              />
              <UrlField
                icon={<Twitter className="w-4 h-4" />}
                label="Twitter / X"
                value={twitterUrl}
                onChange={setTwitter}
                placeholder="https://x.com/yourhandle"
              />
            </div>
          </div>

          {/* Photo upload */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <label className="text-sm font-semibold text-slate-800">Profile Photo</label>
              <span className="text-xs text-slate-400">Optional</span>
            </div>
            <div className="flex items-center gap-5">
              {/* Avatar preview */}
              <div className="relative shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl ?? `${DICEBEAR_BASE_URL}${encodeURIComponent(name || 'user')}`}
                  alt="Profile preview"
                  className="w-20 h-20 rounded-full object-cover bg-slate-100 border border-slate-200"
                />
                {imageReading && (
                  <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                  </div>
                )}
              </div>

              {/* Controls */}
              <div className="flex-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleImageSelect}
                />
                <div className="flex flex-wrap gap-2 items-center">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={imageReading}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-purple-600 hover:text-purple-800 disabled:opacity-50"
                  >
                    <Camera className="w-4 h-4" />
                    {imageUrl ? 'Change photo' : 'Upload photo'}
                  </button>
                  {imageUrl && !imageReading && (
                    <span className="inline-flex items-center gap-1 text-xs text-green-600">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Photo selected
                    </span>
                  )}
                  {imageUrl && (
                    <button
                      type="button"
                      onClick={removePhoto}
                      disabled={imageReading}
                      className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-red-500 disabled:opacity-50"
                    >
                      <X className="w-3.5 h-3.5" /> Remove
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-1.5">
                  JPG, PNG or WebP · max 5 MB
                  {!imageUrl && ' · leave blank to use an auto-generated avatar'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-between items-center">
          <button onClick={() => router.back()} className="text-sm text-slate-500 hover:text-slate-700">
            ← Back
          </button>
          <Button onClick={handleNext} disabled={!canNext} size="lg">
            Next →
          </Button>
        </div>
      </div>
    </div>
  )
}
