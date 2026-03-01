/**
 * Onboarding utilities for tracking user progress
 */

import { prisma } from './prisma';

const ONBOARDING_STORAGE_KEY = 'fleetflow_onboarding';

export interface OnboardingProgress {
  completed: boolean;
  currentStep: number;
  checklist: {
    profileComplete: boolean;
    vehicleAdded: boolean;
    teamMemberInvited: boolean;
    maintenanceScheduled: boolean;
    integrationConnected: boolean;
  };
}

const defaultProgress: OnboardingProgress = {
  completed: false,
  currentStep: 0,
  checklist: {
    profileComplete: false,
    vehicleAdded: false,
    teamMemberInvited: false,
    maintenanceScheduled: false,
    integrationConnected: false,
  },
};

/**
 * Get onboarding progress from localStorage (client-side)
 */
export function getLocalOnboardingProgress(): OnboardingProgress {
  if (typeof window === 'undefined') return defaultProgress;
  
  try {
    const stored = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (stored) {
      return { ...defaultProgress, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.error('Failed to parse onboarding progress:', error);
  }
  
  return defaultProgress;
}

/**
 * Save onboarding progress to localStorage (client-side)
 */
export function saveLocalOnboardingProgress(progress: Partial<OnboardingProgress>): void {
  if (typeof window === 'undefined') return;
  
  try {
    const current = getLocalOnboardingProgress();
    const updated = { ...current, ...progress };
    localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to save onboarding progress:', error);
  }
}

/**
 * Check if a specific checklist item is complete
 */
export function isChecklistItemComplete(item: keyof OnboardingProgress['checklist']): boolean {
  const progress = getLocalOnboardingProgress();
  return progress.checklist[item];
}

/**
 * Mark a checklist item as complete
 */
export function completeChecklistItem(item: keyof OnboardingProgress['checklist']): void {
  const progress = getLocalOnboardingProgress();
  progress.checklist[item] = true;
  saveLocalOnboardingProgress({ checklist: progress.checklist });
}

/**
 * Calculate completion percentage
 */
export function getOnboardingCompletionPercentage(): number {
  const progress = getLocalOnboardingProgress();
  const items = Object.values(progress.checklist);
  const completed = items.filter(Boolean).length;
  return Math.round((completed / items.length) * 100);
}

/**
 * Check if onboarding is fully complete
 */
export function isOnboardingComplete(): boolean {
  return getOnboardingCompletionPercentage() === 100;
}

/**
 * Reset onboarding progress
 */
export function resetOnboardingProgress(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ONBOARDING_STORAGE_KEY);
}

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
    });

    if (!user) return defaultProgress;

    return {
      ...defaultProgress,
      completed: user.onboardingCompleted,
      currentStep: user.onboardingStep,
    };
  } catch (error) {
    console.error('Failed to get database onboarding progress:', error);
    return defaultProgress;
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
    });
  } catch (error) {
    console.error('Failed to update database onboarding progress:', error);
    throw error;
  }
}

/**
 * Sync local progress with database
 */
export async function syncOnboardingProgress(userId: string): Promise<void> {
  const local = getLocalOnboardingProgress();
  await updateDatabaseOnboardingProgress(userId, local);
}

/**
 * Mark onboarding as complete
 */
export async function completeOnboarding(userId: string): Promise<void> {
  saveLocalOnboardingProgress({ completed: true });
  await updateDatabaseOnboardingProgress(userId, { completed: true });
}
