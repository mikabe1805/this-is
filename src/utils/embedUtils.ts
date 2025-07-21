export interface EmbedData {
  platform: 'instagram' | 'tiktok' | 'other'
  url: string
  content: string
  mediaUrl?: string
  author?: string
  timestamp?: string
  title?: string
  description?: string
  thumbnail?: string
  videoUrl?: string
  error?: string
}

export interface EmbedPreview {
  platform: 'instagram' | 'tiktok' | 'other'
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
    /^https?:\/\/(www\.)?vm\.tiktok\.com\/[a-zA-Z0-9]+/
  ]
}

// Extract platform and ID from URL
export function parseSocialMediaUrl(url: string): { platform: 'instagram' | 'tiktok' | 'other', id?: string } {
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
  
  return { platform: 'other' }
}

// Extract Instagram content using oEmbed API
async function extractInstagramContent(url: string): Promise<EmbedData> {
  try {
    // Instagram oEmbed endpoint
    const oembedUrl = `https://api.instagram.com/oembed/?url=${encodeURIComponent(url)}`
    
    const response = await fetch(oembedUrl)
    if (!response.ok) {
      throw new Error('Failed to fetch Instagram data')
    }
    
    const data = await response.json()
    
    return {
      platform: 'instagram',
      url,
      content: data.title || 'Instagram post',
      mediaUrl: data.thumbnail_url,
      author: data.author_name || '@instagram_user',
      timestamp: 'Recently',
      title: data.title,
      description: data.title
    }
  } catch (error) {
    console.error('Instagram extraction error:', error)
    // Fallback: create basic embed data from URL
    const urlParts = url.split('/')
    const postId = urlParts[urlParts.length - 1] || 'post'
    
    return {
      platform: 'instagram',
      url,
      content: `Instagram post ${postId}`,
      author: '@instagram_user',
      timestamp: 'Recently',
      title: 'Instagram Post',
      description: 'Content from Instagram'
    }
  }
}

// Extract TikTok content using oEmbed API
async function extractTikTokContent(url: string): Promise<EmbedData> {
  try {
    // TikTok oEmbed endpoint
    const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`
    
    const response = await fetch(oembedUrl)
    if (!response.ok) {
      throw new Error('Failed to fetch TikTok data')
    }
    
    const data = await response.json()
    
    return {
      platform: 'tiktok',
      url,
      content: data.title || 'TikTok video',
      mediaUrl: data.thumbnail_url,
      author: data.author_name || '@tiktok_user',
      timestamp: 'Recently',
      title: data.title,
      description: data.title,
      videoUrl: url
    }
  } catch (error) {
    console.error('TikTok extraction error:', error)
    // Fallback: create basic embed data from URL
    const urlParts = url.split('/')
    const videoId = urlParts[urlParts.length - 1] || 'video'
    
    return {
      platform: 'tiktok',
      url,
      content: `TikTok video ${videoId}`,
      author: '@tiktok_user',
      timestamp: 'Recently',
      title: 'TikTok Video',
      description: 'Content from TikTok',
      videoUrl: url
    }
  }
}

// Extract generic content from any URL
async function extractGenericContent(url: string): Promise<EmbedData> {
  try {
    // Try to fetch basic metadata
    const response = await fetch(url, {
      method: 'HEAD',
      mode: 'no-cors' // Handle CORS issues
    })
    
    return {
      platform: 'other',
      url,
      content: 'External content',
      author: 'Unknown',
      timestamp: 'Recently',
      title: 'External Link',
      description: 'Content from external source'
    }
  } catch (error) {
    console.error('Generic extraction error:', error)
    return {
      platform: 'other',
      url,
      content: 'External content',
      author: 'Unknown',
      timestamp: 'Recently',
      error: 'Could not extract content'
    }
  }
}

// Main function to extract embed data from URL
export async function extractEmbedData(url: string): Promise<EmbedData> {
  const { platform } = parseSocialMediaUrl(url)
  
  switch (platform) {
    case 'instagram':
      return await extractInstagramContent(url)
    case 'tiktok':
      return await extractTikTokContent(url)
    case 'other':
      return await extractGenericContent(url)
    default:
      return await extractGenericContent(url)
  }
}

// Create embed preview for display
export function createEmbedPreview(embedData: EmbedData): EmbedPreview {
  return {
    platform: embedData.platform,
    url: embedData.url,
    content: embedData.content,
    mediaUrl: embedData.mediaUrl,
    author: embedData.author || '@user',
    timestamp: embedData.timestamp || 'Recently',
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
export function getPlatformPlaceholder(platform: 'instagram' | 'tiktok' | 'other'): string {
  switch (platform) {
    case 'instagram':
      return 'https://www.instagram.com/p/...'
    case 'tiktok':
      return 'https://www.tiktok.com/@username/video/...'
    case 'other':
      return 'https://...'
    default:
      return 'https://...'
  }
}

// Get platform display name
export function getPlatformDisplayName(platform: 'instagram' | 'tiktok' | 'other'): string {
  switch (platform) {
    case 'instagram':
      return 'Instagram'
    case 'tiktok':
      return 'TikTok'
    case 'other':
      return 'Other'
    default:
      return 'Other'
  }
} 