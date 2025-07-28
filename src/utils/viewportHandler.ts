// Viewport handler to prevent keyboard displacement issues on mobile
export const setupViewportHandler = () => {
  // Only run on mobile devices
  if (typeof window === 'undefined' || window.innerWidth > 768) {
    return
  }

  // Don't interfere with reels page
  const isReelsPage = () => {
    return document.querySelector('[data-reels-page="true"]') !== null
  }

  // Store initial viewport height
  const initialViewportHeight = window.visualViewport?.height || window.innerHeight
  
  // Handle visual viewport changes (when keyboard appears/disappears)
  if (window.visualViewport) {
    const handleViewportChange = () => {
      // Skip if on reels page to avoid interfering with scroll behavior
      if (isReelsPage()) {
        return
      }
      
      const currentHeight = window.visualViewport?.height || window.innerHeight
      const heightDifference = initialViewportHeight - currentHeight
      
      // If keyboard is likely open (significant height difference)
      if (heightDifference > 150) {
        // Prevent page displacement by maintaining scroll position
        document.body.style.position = 'fixed'
        document.body.style.top = `-${window.scrollY}px`
        document.body.style.width = '100%'
      } else {
        // Keyboard is closed, restore normal behavior
        const scrollY = document.body.style.top
        document.body.style.position = ''
        document.body.style.top = ''
        document.body.style.width = ''
        
        if (scrollY) {
          window.scrollTo(0, parseInt(scrollY || '0') * -1)
        }
      }
    }

    window.visualViewport.addEventListener('resize', handleViewportChange)
    
    // Cleanup function
    return () => {
      window.visualViewport?.removeEventListener('resize', handleViewportChange)
    }
  }

  // Fallback for devices without visual viewport API
  let lastInnerHeight = window.innerHeight
  
  const handleResize = () => {
    // Skip if on reels page to avoid interfering with scroll behavior
    if (isReelsPage()) {
      return
    }
    
    const currentHeight = window.innerHeight
    const heightDifference = lastInnerHeight - currentHeight
    
    // If height decreased significantly, likely keyboard opened
    if (heightDifference > 150) {
      document.documentElement.style.height = `${lastInnerHeight}px`
    } else if (heightDifference < -50) {
      // Height increased, keyboard likely closed
      document.documentElement.style.height = ''
      lastInnerHeight = currentHeight
    }
  }

  window.addEventListener('resize', handleResize)
  
  return () => {
    window.removeEventListener('resize', handleResize)
    document.documentElement.style.height = ''
  }
} 