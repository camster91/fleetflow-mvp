import { prisma } from './prisma'
import { defaultProgress, getLocalOnboardingProgress, type OnboardingProgress } from './onboarding'

/**
 * Get onboarding progress from database
 */
export async function getDatabaseOnboardingProgress(userId: string): Promise<OnboardingProgress> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        onboardingCompleted: true,
        onboardingStep: true,
      },
    })

    if (!user) return defaultProgress

    return {
      ...defaultProgress,
      completed: user.onboardingCompleted,
      currentStep: user.onboardingStep,
    }
  } catch (error) {
    console.error('Failed to get database onboarding progress:', error)
    return defaultProgress
  }
}

/**
 * Update onboarding progress in database
 */
export async function updateDatabaseOnboardingProgress(
  userId: string,
  progress: Partial<OnboardingProgress>
): Promise<void> {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        onboardingCompleted: progress.completed ?? false,
        onboardingStep: progress.currentStep ?? 0,
      },
    })
  } catch (error) {
    console.error('Failed to update database onboarding progress:', error)
    throw error
  }
}

/**
 * Sync local progress with database
 */
export async function syncOnboardingProgress(userId: string): Promise<void> {
  const local = getLocalOnboardingProgress()
  await updateDatabaseOnboardingProgress(userId, local)
}
