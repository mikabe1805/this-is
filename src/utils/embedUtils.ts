export interface EmbedData {
  platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter' | 'other'
  url: string
  title?: string
  description?: string
  author?: string
  authorUrl?: string
  thumbnail?: string
  mediaUrl?: string
  videoUrl?: string
  publishedAt?: string
  siteName?: string
  type?: 'video' | 'photo' | 'article' | 'website'
  error?: string
  // Legacy fields for compatibility
  content?: string
  timestamp?: string
}

export interface EmbedPreview {
  platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter' | 'other'
  url: string
  content: string
  mediaUrl?: string
  author: string
  timestamp: string
  title?: string
  description?: string
  thumbnail?: string
  videoUrl?: string
}

// URL patterns for different platforms
const URL_PATTERNS = {
  instagram: [
    /^https?:\/\/(www\.)?instagram\.com\/p\/([a-zA-Z0-9_-]+)/,
    /^https?:\/\/(www\.)?instagram\.com\/reel\/([a-zA-Z0-9_-]+)/,
    /^https?:\/\/(www\.)?instagram\.com\/tv\/([a-zA-Z0-9_-]+)/
  ],
  tiktok: [
    /^https?:\/\/(www\.)?tiktok\.com\/@[^\/]+\/video\/[0-9]+/,
    /^https?:\/\/(www\.)?vm\.tiktok\.com\/[a-zA-Z0-9]+/,
    /^https?:\/\/(www\.)?tiktok\.com\/t\/[a-zA-Z0-9]+/
  ],
  youtube: [
    /^https?:\/\/(www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/,
    /^https?:\/\/(www\.)?youtu\.be\/([a-zA-Z0-9_-]+)/,
    /^https?:\/\/(www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]+)/
  ],
  twitter: [
    /^https?:\/\/(www\.)?(twitter\.com|x\.com)\/[^\/]+\/status\/[0-9]+/
  ]
}

// Extract platform and ID from URL
export function parseSocialMediaUrl(url: string): { platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter' | 'other', id?: string } {
  const cleanUrl = url.trim()
  
  // Check Instagram patterns
  for (const pattern of URL_PATTERNS.instagram) {
    const match = cleanUrl.match(pattern)
    if (match) {
      return { platform: 'instagram', id: match[2] }
    }
  }
  
  // Check TikTok patterns
  for (const pattern of URL_PATTERNS.tiktok) {
    const match = cleanUrl.match(pattern)
    if (match) {
      return { platform: 'tiktok', id: match[0] }
    }
  }
  
  // Check YouTube patterns
  for (const pattern of URL_PATTERNS.youtube) {
    const match = cleanUrl.match(pattern)
    if (match) {
      return { platform: 'youtube', id: match[2] || match[1] }
    }
  }
  
  // Check Twitter patterns
  for (const pattern of URL_PATTERNS.twitter) {
    const match = cleanUrl.match(pattern)
    if (match) {
      return { platform: 'twitter', id: match[0] }
    }
  }
  
  return { platform: 'other' }
}

import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase/config'

// Main function to extract embed data from URL using Firebase Functions
export async function extractEmbedData(url: string): Promise<EmbedData> {
  console.log('🔍 Starting embed extraction for:', url)
  
  // Skip callable function for now, go directly to HTTP (more reliable)
  try {
    const functionUrl = import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true'
      ? 'http://localhost:5001/this-is-76332/us-central1/extractEmbed'
      : 'https://us-central1-this-is-76332.cloudfunctions.net/extractEmbed'
    
    console.log('📡 Calling Firebase Function:', functionUrl)
    
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const data = await response.json() as EmbedData
    console.log('✅ Firebase Function returned data:', data)
    
    // Add legacy fields for compatibility
    if (data.title && !data.content) {
      data.content = data.title
    }
    if (data.publishedAt && !data.timestamp) {
      data.timestamp = data.publishedAt
    } else if (!data.timestamp) {
      data.timestamp = 'Recently'
    }
    
    console.log('🎯 Final processed data:', data)
    return data
    
  } catch (error) {
    console.error('❌ Firebase Function failed:', error)
    
    // Final fallback: basic URL parsing
    const { platform } = parseSocialMediaUrl(url)
    const domain = new URL(url).hostname.replace('www.', '')
    
    return {
      platform,
      url,
      title: `Content from ${domain}`,
      description: 'Could not extract detailed content',
      author: domain,
      content: `Content from ${domain}`,
      timestamp: 'Recently',
      siteName: domain,
      type: 'website',
      error: 'Failed to extract content from this URL'
    }
  }
}

// Create embed preview for display
export function createEmbedPreview(embedData: EmbedData): EmbedPreview {
  // Use the rich content data from Firebase Functions
  const displayContent = embedData.title || embedData.description || embedData.content || 'Content preview'
  const displayAuthor = embedData.author || '@user'
  const displayTimestamp = embedData.publishedAt 
    ? new Date(embedData.publishedAt).toLocaleDateString()
    : (embedData.timestamp || 'Recently')
  
  return {
    platform: embedData.platform,
    url: embedData.url,
    content: displayContent,
    mediaUrl: embedData.thumbnail || embedData.mediaUrl, // Use thumbnail first, then mediaUrl
    author: displayAuthor,
    timestamp: displayTimestamp,
    title: embedData.title,
    description: embedData.description,
    thumbnail: embedData.thumbnail,
    videoUrl: embedData.videoUrl
  }
}

// Validate URL format
export function validateUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

// Get platform-specific placeholder text
export function getPlatformPlaceholder(platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter' | 'other'): string {
  switch (platform) {
    case 'instagram':
      return 'https://www.instagram.com/p/...'
    case 'tiktok':
      return 'https://www.tiktok.com/@username/video/...'
    case 'youtube':
      return 'https://www.youtube.com/watch?v=...'
    case 'twitter':
      return 'https://twitter.com/user/status/...'
    case 'other':
      return 'https://...'
    default:
      return 'https://...'
  }
}

// Get platform display name
export function getPlatformDisplayName(platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter' | 'other'): string {
  switch (platform) {
    case 'instagram':
      return 'Instagram'
    case 'tiktok':
      return 'TikTok'
    case 'youtube':
      return 'YouTube'
    case 'twitter':
      return 'Twitter'
    case 'other':
      return 'Other'
    default:
      return 'Other'
  }
} 