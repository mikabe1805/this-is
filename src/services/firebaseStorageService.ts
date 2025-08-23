import { ref, uploadBytes, getDownloadURL, deleteObject, listAll } from 'firebase/storage'
import { storage } from '../firebase/config'

export class FirebaseStorageService {
  
  /**
   * Upload a profile picture for a user
   */
  async uploadProfilePicture(userId: string, file: File): Promise<string> {
    try {
      // Validate file
      // Allow any image/* type including HEIC/HEIF; convert/compress when possible
      if (!this.isValidImageFile(file)) {
        throw new Error('Invalid file type. Please upload a valid image')
      }

      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        throw new Error('File too large. Please upload an image smaller than 5MB')
      }

      // Create unique filename
      const fileExtension = file.name.split('.').pop()
      const fileName = `profile_${userId}_${Date.now()}.${fileExtension}`
      
      // Create storage reference
      const storageRef = ref(storage, `profile-pictures/${fileName}`)
      
      // Compress before upload when possible
      let toUpload = file
      try {
        toUpload = await this.compressImage(file, 1200, 0.85)
      } catch {}

      // Upload file
      const snapshot = await uploadBytes(storageRef, toUpload)
      
      // Get download URL
      const downloadURL = await getDownloadURL(snapshot.ref)
      
      console.log('Profile picture uploaded successfully:', downloadURL)
      return downloadURL
      
    } catch (error) {
      console.error('Error uploading profile picture:', error)
      throw error
    }
  }

  /**
   * Upload a hub/place image
   */
  async uploadHubImage(hubId: string, file: File, imageIndex = 0): Promise<string> {
    try {
      if (!this.isValidImageFile(file)) {
        throw new Error('Invalid file type. Please upload a valid image')
      }

      if (file.size > 10 * 1024 * 1024) { // 10MB limit for hub images
        throw new Error('File too large. Please upload an image smaller than 10MB')
      }

      const fileExtension = file.name.split('.').pop()
      const fileName = `hub_${hubId}_${imageIndex}_${Date.now()}.${fileExtension}`
      
      const storageRef = ref(storage, `hub-images/${fileName}`)
      let toUpload = file
      try {
        toUpload = await this.compressImage(file, 1600, 0.85)
      } catch {}
      const snapshot = await uploadBytes(storageRef, toUpload)
      const downloadURL = await getDownloadURL(snapshot.ref)
      
      console.log('Hub image uploaded successfully:', downloadURL)
      return downloadURL
      
    } catch (error) {
      console.error('Error uploading hub image:', error)
      throw error
    }
  }

  /**
   * Upload a list cover image
   */
  async uploadListImage(listId: string, file: File): Promise<string> {
    try {
      if (!this.isValidImageFile(file)) {
        throw new Error('Invalid file type. Please upload a valid image')
      }

      if (file.size > 8 * 1024 * 1024) { // 8MB limit for list images
        throw new Error('File too large. Please upload an image smaller than 8MB')
      }

      const fileExtension = file.name.split('.').pop()
      const fileName = `list_${listId}_${Date.now()}.${fileExtension}`
      
      const storageRef = ref(storage, `list-images/${fileName}`)
      let toUpload = file
      try {
        toUpload = await this.compressImage(file, 1400, 0.85)
      } catch {}
      const snapshot = await uploadBytes(storageRef, toUpload)
      const downloadURL = await getDownloadURL(snapshot.ref)
      
      console.log('List image uploaded successfully:', downloadURL)
      return downloadURL
      
    } catch (error) {
      console.error('Error uploading list image:', error)
      throw error
    }
  }

  /**
   * Upload a post image
   */
  async uploadPostImage(postId: string, file: File, imageIndex = 0): Promise<string> {
    try {
      if (!this.isValidImageFile(file)) {
        throw new Error('Invalid file type. Please upload a valid image')
      }

      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        throw new Error('File too large. Please upload an image smaller than 10MB')
      }

      const fileExtension = file.name.split('.').pop()
      const fileName = `post_${postId}_${imageIndex}_${Date.now()}.${fileExtension}`
      
      const storageRef = ref(storage, `post-images/${fileName}`)
      let toUpload = file
      try {
        toUpload = await this.compressImage(file, 1600, 0.85)
      } catch {}
      const snapshot = await uploadBytes(storageRef, toUpload)
      const downloadURL = await getDownloadURL(snapshot.ref)
      
      console.log('Post image uploaded successfully:', downloadURL)
      return downloadURL
      
    } catch (error) {
      console.error('Error uploading post image:', error)
      throw error
    }
  }

  /**
   * Upload multiple images for a post
   */
  async uploadPostImages(postId: string, files: File[]): Promise<string[]> {
    try {
      const uploadPromises = files.map(async (file, index) => {
        return this.uploadPostImage(postId, file, index)
      })
      
      const urls = await Promise.all(uploadPromises)
      return urls
      
    } catch (error) {
      console.error('Error uploading post images:', error)
      throw error
    }
  }

  /**
   * Delete an image from storage
   */
  async deleteImage(imageUrl: string): Promise<void> {
    try {
      // Extract path from URL
      const path = this.extractPathFromUrl(imageUrl)
      if (!path) {
        throw new Error('Invalid image URL')
      }
      
      const storageRef = ref(storage, path)
      await deleteObject(storageRef)
      
      console.log('Image deleted successfully:', imageUrl)
      
    } catch (error) {
      console.error('Error deleting image:', error)
      throw error
    }
  }

  /**
   * Get all images for a user (profile pictures, posts, etc.)
   */
  async getUserImages(userId: string): Promise<{
    profilePictures: string[]
    postImages: string[]
  }> {
    try {
      const profilePictures: string[] = []
      const postImages: string[] = []

      // List profile pictures
      const profileRef = ref(storage, 'profile-pictures/')
      const profileList = await listAll(profileRef)
      
      for (const item of profileList.items) {
        if (item.name.includes(`profile_${userId}_`)) {
          const url = await getDownloadURL(item)
          profilePictures.push(url)
        }
      }

      // List post images
      const postsRef = ref(storage, 'post-images/')
      const postsList = await listAll(postsRef)
      
      for (const item of postsList.items) {
        if (item.name.includes(`_${userId}_`)) {
          const url = await getDownloadURL(item)
          postImages.push(url)
        }
      }

      return { profilePictures, postImages }
      
    } catch (error) {
      console.error('Error getting user images:', error)
      return { profilePictures: [], postImages: [] }
    }
  }

  /**
   * Upload seed data image
   */
  async uploadSeedImage(category: 'profiles' | 'hubs' | 'lists' | 'posts', fileName: string, file: File): Promise<string> {
    try {
      if (!this.isValidImageFile(file)) {
        throw new Error('Invalid file type for seed image')
      }

      const storageRef = ref(storage, `seed-data/${category}/${fileName}`)
      const snapshot = await uploadBytes(storageRef, file)
      const downloadURL = await getDownloadURL(snapshot.ref)
      
      console.log(`Seed ${category} image uploaded:`, downloadURL)
      return downloadURL
      
    } catch (error) {
      console.error(`Error uploading seed ${category} image:`, error)
      throw error
    }
  }

  /**
   * Create placeholder images for seed data
   */
  async createPlaceholderImage(
    text: string, 
    width = 400, 
    height = 300, 
    backgroundColor = '#E17373',
    textColor = '#FFFFFF'
  ): Promise<File> {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')!
      
      canvas.width = width
      canvas.height = height
      
      // Background
      ctx.fillStyle = backgroundColor
      ctx.fillRect(0, 0, width, height)
      
      // Text
      ctx.fillStyle = textColor
      ctx.font = `${Math.min(width, height) / 10}px Arial`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      
      // Word wrap for long text
      const words = text.split(' ')
      const lines: string[] = []
      let currentLine = words[0]
      
      for (let i = 1; i < words.length; i++) {
        const word = words[i]
        const width_test = ctx.measureText(currentLine + ' ' + word).width
        if (width_test < width - 40) {
          currentLine += ' ' + word
        } else {
          lines.push(currentLine)
          currentLine = word
        }
      }
      lines.push(currentLine)
      
      // Draw lines
      const lineHeight = Math.min(width, height) / 8
      const totalHeight = lines.length * lineHeight
      const startY = (height - totalHeight) / 2 + lineHeight / 2
      
      lines.forEach((line, index) => {
        ctx.fillText(line, width / 2, startY + index * lineHeight)
      })
      
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `${text.replace(/\s+/g, '_').toLowerCase()}.png`, {
            type: 'image/png'
          })
          resolve(file)
        }
      }, 'image/png')
    })
  }

  /**
   * Validate if file is a valid image
   */
  private isValidImageFile(file: File): boolean {
    // Accept any image/* (to include HEIC/HEIF from iOS) and rely on compress/upload handling
    return file.type.startsWith('image/')
  }

  /**
   * Extract storage path from download URL
   */
  private extractPathFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url)
      const pathMatch = urlObj.pathname.match(/\/o\/(.+)\?/)
      if (pathMatch && pathMatch[1]) {
        return decodeURIComponent(pathMatch[1])
      }
      return null
    } catch {
      return null
    }
  }

  /**
   * Compress image before upload
   */
  async compressImage(file: File, maxWidth = 1200, quality = 0.8): Promise<File> {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')!
      const img = new Image()
      
      img.onload = () => {
        // Calculate new dimensions
        const ratio = Math.min(maxWidth / img.width, maxWidth / img.height)
        canvas.width = img.width * ratio
        canvas.height = img.height * ratio
        
        // Draw and compress
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        
        // Choose an output type compatible with canvas encoders
        const lowerType = (file.type || '').toLowerCase()
        const needsConversion = lowerType.includes('heic') || lowerType.includes('heif') || lowerType === ''
        const outputType = needsConversion ? 'image/jpeg' : file.type

        // Ensure filename extension matches outputType
        const getExtFromMime = (mime: string) => {
          if (mime === 'image/png') return 'png'
          if (mime === 'image/webp') return 'webp'
          return 'jpg'
        }
        const baseName = file.name.includes('.') ? file.name.substring(0, file.name.lastIndexOf('.')) : file.name
        const newName = `${baseName}.${getExtFromMime(outputType)}`

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], newName, {
                type: outputType,
                lastModified: Date.now()
              })
              resolve(compressedFile)
            } else {
              resolve(file) // Fallback to original
            }
          },
          outputType,
          quality
        )
      }
      
      img.src = URL.createObjectURL(file)
    })
  }
}

// Export singleton instance
export const firebaseStorageService = new FirebaseStorageService()
export default firebaseStorageService 