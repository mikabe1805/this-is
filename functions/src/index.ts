import {onCall, onRequest} from "firebase-functions/v2/https";
import {setGlobalOptions} from "firebase-functions";
import {logger} from "firebase-functions";
import cors from "cors";
import fetch from "node-fetch";
import * as cheerio from "cheerio";
import * as admin from 'firebase-admin';

admin.initializeApp();

// For cost control, set maximum instances
setGlobalOptions({ maxInstances: 10 });

const corsHandler = cors({ origin: true });

// Types for embed data
interface EmbedData {
  platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter' | 'other';
  url: string;
  title?: string;
  description?: string;
  author?: string;
  authorUrl?: string;
  thumbnail?: string;
  mediaUrl?: string;
  videoUrl?: string;
  publishedAt?: string;
  siteName?: string;
  type?: 'video' | 'photo' | 'article' | 'website';
  error?: string;
}

// URL pattern matching
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
};

// Detect platform from URL
function detectPlatform(url: string): { platform: EmbedData['platform'], id?: string } {
  // Instagram
  for (const pattern of URL_PATTERNS.instagram) {
    const match = url.match(pattern);
    if (match) {
      return { platform: 'instagram', id: match[2] };
    }
  }
  
  // TikTok
  for (const pattern of URL_PATTERNS.tiktok) {
    const match = url.match(pattern);
    if (match) {
      return { platform: 'tiktok', id: match[0] };
    }
  }
  
  // YouTube
  for (const pattern of URL_PATTERNS.youtube) {
    const match = url.match(pattern);
    if (match) {
      return { platform: 'youtube', id: match[2] || match[1] };
    }
  }
  
  // Twitter
  for (const pattern of URL_PATTERNS.twitter) {
    const match = url.match(pattern);
    if (match) {
      return { platform: 'twitter', id: match[0] };
    }
  }
  
  return { platform: 'other' };
}

// Extract Instagram content using oEmbed
async function extractInstagramContent(url: string): Promise<EmbedData> {
  try {
    // Use the public oEmbed endpoint (limited but works for public posts)
    const publicOembedUrl = `https://api.instagram.com/oembed/?url=${encodeURIComponent(url)}`;
    
    const response = await fetch(publicOembedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; embedbot/1.0)',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Instagram API error: ${response.status}`);
    }
    
    const data = await response.json() as any;
    
    return {
      platform: 'instagram',
      url,
      title: data.title || 'Instagram Post',
      description: data.title || '',
      author: data.author_name || '@instagram_user',
      authorUrl: data.author_url,
      thumbnail: data.thumbnail_url,
      mediaUrl: data.thumbnail_url,
      type: 'photo',
      siteName: 'Instagram'
    };
  } catch (error) {
    logger.error('Instagram extraction failed:', error);
    
    // Fallback: extract basic info from URL
    const postMatch = url.match(/\/(p|reel|tv)\/([^\/\?]+)/);
    
    return {
      platform: 'instagram',
      url,
      title: `Instagram ${postMatch?.[1] === 'reel' ? 'Reel' : 'Post'}`,
      description: 'Content from Instagram',
      author: '@instagram_user',
      type: postMatch?.[1] === 'reel' ? 'video' : 'photo',
      siteName: 'Instagram',
      error: 'Could not fetch detailed content'
    };
  }
}

// Extract TikTok content using oEmbed
async function extractTikTokContent(url: string): Promise<EmbedData> {
  try {
    // Resolve shortened URLs to full URLs first
    let resolvedUrl = url;
    
    // Check if this is a shortened URL that needs resolving
    if (url.includes('/t/') || url.includes('vm.tiktok.com')) {
      try {
        const headResponse = await fetch(url, {
          method: 'HEAD',
          redirect: 'follow',
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; embedbot/1.0)',
          },
        });
        resolvedUrl = headResponse.url || url;
        logger.info(`Resolved TikTok URL from ${url} to ${resolvedUrl}`);
      } catch (resolveError) {
        logger.warn('Could not resolve shortened URL, using original:', resolveError);
      }
    }
    
    const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(resolvedUrl)}`;
    
    const response = await fetch(oembedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; embedbot/1.0)',
      },
    });
    
    if (!response.ok) {
      throw new Error(`TikTok API error: ${response.status}`);
    }
    
    const data = await response.json() as any;
    
    return {
      platform: 'tiktok',
      url,
      title: data.title || 'TikTok Video',
      description: data.title || '',
      author: data.author_name || '@tiktok_user',
      authorUrl: data.author_url,
      thumbnail: data.thumbnail_url,
      mediaUrl: data.thumbnail_url,
      videoUrl: url,
      type: 'video',
      siteName: 'TikTok'
    };
  } catch (error) {
    logger.error('TikTok extraction failed:', error);
    
    // Fallback: extract username from URL
    const usernameMatch = url.match(/tiktok\.com\/@([^\/]+)/);
    const username = usernameMatch ? `@${usernameMatch[1]}` : '@tiktok_user';
    
    return {
      platform: 'tiktok',
      url,
      title: 'TikTok Video',
      description: 'Content from TikTok',
      author: username,
      type: 'video',
      siteName: 'TikTok',
      videoUrl: url,
      error: 'Could not fetch detailed content'
    };
  }
}

// Extract YouTube content using oEmbed
async function extractYouTubeContent(url: string, videoId: string): Promise<EmbedData> {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    
    const response = await fetch(oembedUrl);
    
    if (!response.ok) {
      throw new Error(`YouTube API error: ${response.status}`);
    }
    
    const data = await response.json() as any;
    
    return {
      platform: 'youtube',
      url,
      title: data.title || 'YouTube Video',
      description: data.title || '',
      author: data.author_name || 'YouTube Channel',
      authorUrl: data.author_url,
      thumbnail: data.thumbnail_url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      mediaUrl: data.thumbnail_url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      videoUrl: url,
      type: 'video',
      siteName: 'YouTube'
    };
  } catch (error) {
    logger.error('YouTube extraction failed:', error);
    
    return {
      platform: 'youtube',
      url,
      title: 'YouTube Video',
      description: 'Content from YouTube',
      author: 'YouTube Channel',
      thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      mediaUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      videoUrl: url,
      type: 'video',
      siteName: 'YouTube',
      error: 'Could not fetch detailed content'
    };
  }
}

// Extract meta tags from any URL
async function extractMetaTags(url: string): Promise<EmbedData> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; embedbot/1.0)',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Extract Open Graph tags
    const ogTitle = $('meta[property="og:title"]').attr('content') || 
                   $('meta[name="twitter:title"]').attr('content') ||
                   $('title').text() ||
                   'Untitled';
    
    const ogDescription = $('meta[property="og:description"]').attr('content') || 
                         $('meta[name="twitter:description"]').attr('content') ||
                         $('meta[name="description"]').attr('content') ||
                         '';
    
    const ogImage = $('meta[property="og:image"]').attr('content') || 
                   $('meta[name="twitter:image"]').attr('content') ||
                   '';
    
    const ogSiteName = $('meta[property="og:site_name"]').attr('content') || 
                      new URL(url).hostname;
    
    const ogType = $('meta[property="og:type"]').attr('content') || 'website';
    
    const ogUrl = $('meta[property="og:url"]').attr('content') || url;
    
    // Try to extract author information
    const author = $('meta[name="author"]').attr('content') ||
                  $('meta[property="article:author"]').attr('content') ||
                  $('meta[name="twitter:creator"]').attr('content') ||
                  ogSiteName;
    
    return {
      platform: 'other',
      url: ogUrl,
      title: ogTitle,
      description: ogDescription,
      author,
      thumbnail: ogImage,
      mediaUrl: ogImage,
      type: ogType === 'video' ? 'video' : 
            ogType === 'article' ? 'article' : 'website',
      siteName: ogSiteName
    };
  } catch (error) {
    logger.error('Meta tag extraction failed:', error);
    
    const domain = new URL(url).hostname.replace('www.', '');
    
    return {
      platform: 'other',
      url,
      title: `Content from ${domain}`,
      description: 'External content',
      author: domain,
      type: 'website',
      siteName: domain,
      error: 'Could not extract content'
    };
  }
}

// Main extraction function
async function extractEmbedData(url: string): Promise<EmbedData> {
  const { platform, id } = detectPlatform(url);
  
  switch (platform) {
    case 'instagram':
      return await extractInstagramContent(url);
    case 'tiktok':
      return await extractTikTokContent(url);
    case 'youtube':
      return await extractYouTubeContent(url, id!);
    case 'other':
    default:
      return await extractMetaTags(url);
  }
}

// HTTP function for embed extraction
export const extractEmbed = onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    
    try {
      const { url } = req.body;
      
      if (!url || typeof url !== 'string') {
        res.status(400).json({ error: 'URL is required' });
        return;
      }
      
      // Validate URL format
      try {
        new URL(url);
      } catch {
        res.status(400).json({ error: 'Invalid URL format' });
        return;
      }
      
      logger.info('Extracting embed data for URL:', url);
      
      const embedData = await extractEmbedData(url);
      
      res.json(embedData);
    } catch (error) {
      logger.error('Extract embed error:', error);
      res.status(500).json({ 
        error: 'Failed to extract embed data',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
});

// Callable function version (alternative)
export const extractEmbedCallable = onCall(async (request) => {
  const { url } = request.data;
  
  if (!url || typeof url !== 'string') {
    throw new Error('URL is required');
  }
  
  try {
    new URL(url);
  } catch {
    throw new Error('Invalid URL format');
  }
  
  logger.info('Extracting embed data for URL:', url);
  
  return await extractEmbedData(url);
});

export * from './analytics-cleanup';
export * from './influences';
