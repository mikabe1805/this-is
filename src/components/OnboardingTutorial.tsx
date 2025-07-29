import React, { useState, useEffect } from 'react'
import { XMarkIcon, ChevronRightIcon, ChevronLeftIcon, SparklesIcon, PlusIcon, ListBulletIcon } from '@heroicons/react/24/outline'

interface OnboardingTutorialProps {
  isOpen: boolean
  onClose: () => void
  onComplete: () => void
}

interface TutorialStep {
  id: string
  title: string
  description: string
  target?: string // CSS selector for the element to highlight
  position: 'top' | 'bottom' | 'left' | 'right' | 'center'
  action?: 'click' | 'navigate' | 'none'
  actionText?: string
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to This Is! 🌟',
    description: 'You\'re all set up! Now let\'s help you create your first list to start discovering amazing places.',
    position: 'center',
    action: 'none'
  },
  {
    id: 'profile_navigate',
    title: 'Let\'s Start Creating!',
    description: 'First, click on your profile icon in the navigation to access your profile page.',
    target: '[data-tutorial="profile-button"]',
    position: 'bottom',
    action: 'click',
    actionText: 'Click Profile'
  },
  {
    id: 'plus_button',
    title: 'Find the Plus Button',
    description: 'Great! Now look for the plus (+) button to start creating new content.',
    target: '[data-tutorial="plus-button"]',
    position: 'bottom',
    action: 'click',
    actionText: 'Click Plus Button'
  },
  {
    id: 'new_list',
    title: 'Create New List',
    description: 'Perfect! Now click on "New List" to create your first collection of places.',
    target: '[data-tutorial="new-list-button"]',
    position: 'left',
    action: 'click',
    actionText: 'Click New List'
  },
  {
    id: 'list_details',
    title: 'Fill in List Details',
    description: 'Give your list a name and description. This could be "My Favorite Coffee Shops" or "Weekend Adventures" - whatever inspires you!',
    target: '[data-tutorial="list-form"]',
    position: 'right',
    action: 'none'
  },
  {
    id: 'add_places',
    title: 'Add Your First Places',
    description: 'Now you can start adding places to your list! Search for places or create posts about places you\'ve been.',
    target: '[data-tutorial="add-places"]',
    position: 'top',
    action: 'none'
  },
  {
    id: 'privacy_settings',
    title: 'Set Privacy',
    description: 'Choose whether your list is public, private, or visible to friends only. You can always change this later!',
    target: '[data-tutorial="privacy-settings"]',
    position: 'left',
    action: 'none'
  },
  {
    id: 'save_list',
    title: 'Save Your List',
    description: 'Once you\'re happy with your list, click save to create it. You can always edit and add more places later!',
    target: '[data-tutorial="save-list"]',
    position: 'top',
    action: 'click',
    actionText: 'Save List'
  },
  {
    id: 'explore',
    title: 'You\'re Ready to Explore! 🚀',
    description: 'Congratulations! You\'ve created your first list. Now you can discover places, follow friends, and build your perfect collection of experiences.',
    position: 'center',
    action: 'none'
  }
]

export default function OnboardingTutorial({ isOpen, onClose, onComplete }: OnboardingTutorialProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [highlightedElement, setHighlightedElement] = useState<HTMLElement | null>(null)

  const currentStepData = TUTORIAL_STEPS[currentStep]

  useEffect(() => {
    if (!isOpen) return

    // Highlight the target element
    if (currentStepData.target) {
      const element = document.querySelector(currentStepData.target) as HTMLElement
      if (element) {
        setHighlightedElement(element)
        element.style.position = 'relative'
        element.style.zIndex = '9999'
        element.style.outline = '3px solid #E17373'
        element.style.outlineOffset = '4px'
        element.style.borderRadius = '8px'
        
        // Scroll element into view
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    } else {
      setHighlightedElement(null)
    }

    return () => {
      // Clean up highlight
      if (highlightedElement) {
        highlightedElement.style.outline = ''
        highlightedElement.style.outlineOffset = ''
        highlightedElement.style.position = ''
        highlightedElement.style.zIndex = ''
      }
    }
  }, [currentStep, isOpen, currentStepData.target, highlightedElement])

  const nextStep = () => {
    if (currentStep < TUTORIAL_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1)
    } else {
      handleComplete()
    }
  }

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1)
    }
  }

  const skipTutorial = () => {
    onClose()
  }

  const handleComplete = () => {
    onComplete()
    onClose()
  }

  const handleActionClick = () => {
    if (currentStepData.action === 'click' && currentStepData.target) {
      // Simulate click on the target element
      const element = document.querySelector(currentStepData.target) as HTMLElement
      if (element) {
        element.click()
      }
    }
    
    // Auto-advance for action steps
    setTimeout(() => {
      nextStep()
    }, 500)
  }

  const getTooltipPosition = () => {
    if (!currentStepData.target || currentStepData.position === 'center') {
      return {
        position: 'fixed' as const,
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 10000
      }
    }

    const element = document.querySelector(currentStepData.target) as HTMLElement
    if (!element) {
      return {
        position: 'fixed' as const,
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 10000
      }
    }

    const rect = element.getBoundingClientRect()
    const tooltipOffset = 20

    switch (currentStepData.position) {
      case 'top':
        return {
          position: 'fixed' as const,
          top: rect.top - tooltipOffset,
          left: rect.left + rect.width / 2,
          transform: 'translate(-50%, -100%)',
          zIndex: 10000
        }
      case 'bottom':
        return {
          position: 'fixed' as const,
          top: rect.bottom + tooltipOffset,
          left: rect.left + rect.width / 2,
          transform: 'translate(-50%, 0)',
          zIndex: 10000
        }
      case 'left':
        return {
          position: 'fixed' as const,
          top: rect.top + rect.height / 2,
          left: rect.left - tooltipOffset,
          transform: 'translate(-100%, -50%)',
          zIndex: 10000
        }
      case 'right':
        return {
          position: 'fixed' as const,
          top: rect.top + rect.height / 2,
          left: rect.right + tooltipOffset,
          transform: 'translate(0, -50%)',
          zIndex: 10000
        }
      default:
        return {
          position: 'fixed' as const,
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 10000
        }
    }
  }

  if (!isOpen) return null

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-9998" />
      
      {/* Tutorial Tooltip */}
      <div
        className="bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border-2 border-[#E17373] max-w-sm w-full p-6"
        style={getTooltipPosition()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <SparklesIcon className="w-5 h-5 text-[#E17373]" />
            <span className="text-sm font-medium text-brown-600">
              Step {currentStep + 1} of {TUTORIAL_STEPS.length}
            </span>
          </div>
          <button
            onClick={skipTutorial}
            className="text-brown-400 hover:text-brown-600 text-sm font-medium"
          >
            Skip
          </button>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-warmGray-200 rounded-full h-1.5 mb-4">
          <div 
            className="bg-[#E17373] h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${((currentStep + 1) / TUTORIAL_STEPS.length) * 100}%` }}
          />
        </div>

        {/* Content */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-brown-700 mb-2">
            {currentStepData.title}
          </h3>
          <p className="text-brown-600 text-sm leading-relaxed">
            {currentStepData.description}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={prevStep}
            disabled={currentStep === 0}
            className="flex items-center space-x-1 px-3 py-2 text-brown-600 hover:text-brown-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeftIcon className="w-4 h-4" />
            <span>Back</span>
          </button>

          <div className="flex items-center space-x-2">
            {currentStepData.action === 'click' && currentStepData.actionText ? (
              <button
                onClick={handleActionClick}
                className="flex items-center space-x-2 bg-[#E17373] hover:bg-[#cd5c5c] text-white rounded-full px-4 py-2 font-medium shadow-sm transition-all hover:brightness-110"
              >
                <span>{currentStepData.actionText}</span>
                <ChevronRightIcon className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={nextStep}
                className="flex items-center space-x-2 bg-[#E17373] hover:bg-[#cd5c5c] text-white rounded-full px-4 py-2 font-medium shadow-sm transition-all hover:brightness-110"
              >
                <span>{currentStep === TUTORIAL_STEPS.length - 1 ? 'Finish' : 'Next'}</span>
                <ChevronRightIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Tutorial tip for center position */}
        {currentStepData.position === 'center' && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-amber-700 text-xs">
              💡 <strong>Tip:</strong> Take your time and explore each feature. You can always revisit this tutorial from your settings!
            </p>
          </div>
        )}
      </div>
    </>
  )
}

// Hook for managing tutorial state
export function useOnboardingTutorial() {
  const [isOpen, setIsOpen] = useState(false)
  const [hasCompletedTutorial, setHasCompletedTutorial] = useState(() => {
    return localStorage.getItem('onboarding_completed') === 'true'
  })

  const startTutorial = () => {
    setIsOpen(true)
  }

  const closeTutorial = () => {
    setIsOpen(false)
  }

  const completeTutorial = () => {
    setHasCompletedTutorial(true)
    localStorage.setItem('onboarding_completed', 'true')
    setIsOpen(false)
  }

  const resetTutorial = () => {
    setHasCompletedTutorial(false)
    localStorage.removeItem('onboarding_completed')
  }

  return {
    isOpen,
    hasCompletedTutorial,
    startTutorial,
    closeTutorial,
    completeTutorial,
    resetTutorial
  }
} 