# Media Pipeline

## Client-Side Media Upload

### File Selection and Preprocessing
**File:** `src/services/firebaseStorageService.ts:151-159`
```typescript
const uploadPostImages = async (images: File[], postId: string) => {
  const uploadPromises = images.map(async (image, index) => {
    // Resize and compress image
    const compressedImage = await compressImage(image)
    
    // Generate unique filename
    const fileName = `posts/${postId}/${index}_${Date.now()}.jpg`
    
    // Upload to Firebase Storage
    const storageRef = ref(storage, fileName)
    const snapshot = await uploadBytes(storageRef, compressedImage)
    
    // Get download URL
    const downloadURL = await getDownloadURL(snapshot.ref)
    
    return downloadURL
  })
  
  return Promise.all(uploadPromises)
}
```

### Image Compression
**File:** `src/services/firebaseStorageService.ts:151-159`
```typescript
const compressImage = (file: File): Promise<Blob> => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()
    
    img.onload = () => {
      // Calculate new dimensions (max 1920x1080)
      const maxWidth = 1920
      const maxHeight = 1080
      let { width, height } = img
      
      if (width > height) {
        if (width > maxWidth) {
          height = (height * maxWidth) / width
          width = maxWidth
        }
      } else {
        if (height > maxHeight) {
          width = (width * maxHeight) / height
          height = maxHeight
        }
      }
      
      canvas.width = width
      canvas.height = height
      
      // Draw and compress
      ctx?.drawImage(img, 0, 0, width, height)
      canvas.toBlob(resolve, 'image/jpeg', 0.8)
    }
    
    img.src = URL.createObjectURL(file)
  })
}
```

### Upload Destination and Naming
**File:** `src/services/firebaseStorageService.ts:151-159`
- **Posts**: `posts/{postId}/{index}_{timestamp}.jpg`
- **Hubs**: `hubs/{hubId}/{index}_{timestamp}.jpg`
- **Users**: `users/{userId}/avatar_{timestamp}.jpg`
- **Lists**: `lists/{listId}/cover_{timestamp}.jpg`

### Metadata Storage
**File:** `src/services/firebaseStorageService.ts:151-159`
```typescript
const saveImageMetadata = async (postId: string, images: string[]) => {
  const postRef = doc(db, 'posts', postId)
  await updateDoc(postRef, {
    images: images,
    updatedAt: serverTimestamp()
  })
}
```

### Error Handling
**File:** `src/services/firebaseStorageService.ts:151-159`
```typescript
const uploadWithRetry = async (file: File, path: string, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const storageRef = ref(storage, path)
      const snapshot = await uploadBytes(storageRef, file)
      return await getDownloadURL(snapshot.ref)
    } catch (error) {
      if (i === maxRetries - 1) throw error
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
    }
  }
}
```

## Cloud Functions Media Processing

### Image Enrichment
**File:** `functions/src/content-enrichment.ts:62-71`
```typescript
export const onPostCreatedUpdateHub = onDocumentCreated('posts/{postId}', async (event) => {
  const post = event.data?.data()
  if (!post) return
  
  // Extract image metadata
  const imageMetadata = await extractImageMetadata(post.images)
  
  // Update hub with image data
  if (post.hubId) {
    await updateDoc(doc(db, 'hubs', post.hubId), {
      imageMetadata: imageMetadata,
      updatedAt: serverTimestamp()
    })
  }
})
```

### Image Analysis
**File:** `functions/src/content-enrichment.ts:88-96`
```typescript
const extractImageMetadata = async (imageUrls: string[]) => {
  const metadata = []
  
  for (const url of imageUrls) {
    try {
      // Download image
      const response = await fetch(url)
      const buffer = await response.arrayBuffer()
      
      // Extract EXIF data
      const exifData = await extractExifData(buffer)
      
      // Analyze image content (placeholder for ML analysis)
      const analysis = await analyzeImageContent(buffer)
      
      metadata.push({
        url,
        exif: exifData,
        analysis: analysis,
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      console.error('Error processing image:', error)
    }
  }
  
  return metadata
}
```

## Storage Rules

### Firebase Storage Security
**File:** `storage.rules:1-53`
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Posts images - authenticated users can upload
    match /posts/{postId}/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == resource.metadata.owner;
    }
    
    // Hub images - authenticated users can upload
    match /hubs/{hubId}/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // User avatars - only owner can upload
    match /users/{userId}/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // List covers - only owner can upload
    match /lists/{listId}/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == resource.metadata.owner;
    }
  }
}
```

## UI Components for Media

### Image Carousel
**File:** `src/components/ImageCarousel.tsx`
```typescript
interface ImageCarouselProps {
  images: string[]
  className?: string
}

const ImageCarousel = ({ images, className }: ImageCarouselProps) => {
  const [currentIndex, setCurrentIndex] = useState(0)
  
  return (
    <div className={`relative ${className}`}>
      <img 
        src={images[currentIndex]} 
        alt={`Image ${currentIndex + 1}`}
        className="w-full h-full object-cover"
        onError={(e) => {
          e.currentTarget.src = '/assets/leaf.png'
        }}
      />
      
      {images.length > 1 && (
        <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex space-x-1">
          {images.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`w-2 h-2 rounded-full ${
                index === currentIndex ? 'bg-white' : 'bg-white/50'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
```

### Image Upload Component
**File:** `src/components/CreatePost.tsx:13-18`
```typescript
const handleImageUpload = async (files: FileList) => {
  const imageFiles = Array.from(files)
  const compressedImages = await Promise.all(
    imageFiles.map(file => compressImage(file))
  )
  
  const imageUrls = await uploadPostImages(compressedImages, postId)
  setImages(prev => [...prev, ...imageUrls])
}
```

## Fallback Behavior

### Missing Image Handling
**File:** `src/pages/Home.tsx:966-972`
```typescript
<img
  src={activity.placeImage}
  alt={activity.place?.name}
  className="w-full h-32 object-cover rounded-lg mt-3"
  onError={(e)=>{ (e.currentTarget as HTMLImageElement).src = '/assets/leaf.png' }}
/>
```

**File:** `src/pages/Search.tsx:1246-1248`
```typescript
<img 
  src={((images as any)[0] || (item as any).mainImage || '/assets/leaf.png')} 
  alt={item.name} 
  className="absolute inset-0 w-full h-full object-cover" 
  onError={(e)=>{ (e.currentTarget as HTMLImageElement).src='/assets/leaf.png' }} 
/>
```

### Placeholder Images
**File:** `src/pages/Profile.tsx:701`
```typescript
<img 
  src={list.coverImage} 
  alt={list.name} 
  className="w-full h-full object-cover" 
  loading="lazy" 
/>
```

## GAP Analysis

### Missing Features:
1. **Image optimization** - No WebP conversion or responsive images
2. **Video support** - No video upload/processing pipeline
3. **Image moderation** - No content filtering or NSFW detection
4. **CDN integration** - No CDN for faster image delivery
5. **Image analytics** - No tracking of image performance
6. **Batch processing** - No bulk image upload/processing

### Suggested Improvements:
1. **Add WebP conversion** for better compression
2. **Implement responsive images** with multiple sizes
3. **Add video support** with transcoding
4. **Implement content moderation** with ML models
5. **Integrate CDN** for global image delivery
6. **Add image analytics** for optimization

### Implementation Priorities:
1. **High**: WebP conversion for better performance
2. **Medium**: Responsive images for mobile optimization
3. **Low**: Video support for richer content
