import type { Badge, UserSession } from './supabase'

export const LEVELS = [
  { level: 1, title: 'Medical Student', minXP: 0, maxXP: 100 },
  { level: 2, title: 'Intern', minXP: 100, maxXP: 250 },
  { level: 3, title: 'Resident PGY-1', minXP: 250, maxXP: 500 },
  { level: 4, title: 'Resident PGY-2', minXP: 500, maxXP: 900 },
  { level: 5, title: 'Resident PGY-3', minXP: 900, maxXP: 1400 },
  { level: 6, title: 'Fellow', minXP: 1400, maxXP: 2000 },
  { level: 7, title: 'Attending', minXP: 2000, maxXP: 3000 },
  { level: 8, title: 'Specialist', minXP: 3000, maxXP: 4500 },
  { level: 9, title: 'Department Chief', minXP: 4500, maxXP: 7000 },
  { level: 10, title: 'Chief of Medicine', minXP: 7000, maxXP: Infinity },
]

export function getLevelInfo(xp: number) {
  return LEVELS.find(l => xp >= l.minXP && xp < l.maxXP) ?? LEVELS[LEVELS.length - 1]
}

export function getXPForCorrect(difficulty: string, beatsAI: boolean): number {
  const base: Record<string, number> = {
    easy: 10,
    medium: 20,
    hard: 35,
    expert: 50,
  }
  const xp = base[difficulty] ?? 20
  return beatsAI ? Math.round(xp * 1.5) : xp
}

export const BADGES: Record<string, Omit<Badge, 'earned_at'>> = {
  first_blood: {
    id: 'first_blood',
    name: 'First Diagnosis',
    description: 'Completed your first case',
    icon: '🩺',
  },
  beat_the_ai: {
    id: 'beat_the_ai',
    name: 'Beat the AI',
    description: 'Outscored the AI doctor on a case',
    icon: '🤖',
  },
  perfect_score: {
    id: 'perfect_score',
    name: 'Perfect Diagnosis',
    description: 'Got 100% on a case',
    icon: '🎯',
  },
  streak_3: {
    id: 'streak_3',
    name: '3-Day Streak',
    description: 'Played 3 days in a row',
    icon: '🔥',
  },
  streak_7: {
    id: 'streak_7',
    name: 'Week Warrior',
    description: 'Played 7 days in a row',
    icon: '🔥🔥',
  },
  streak_30: {
    id: 'streak_30',
    name: 'Monthly Clinician',
    description: 'Played 30 days in a row',
    icon: '🏆',
  },
  ten_cases: {
    id: 'ten_cases',
    name: '10 Cases Solved',
    description: 'Completed 10 medical cases',
    icon: '📋',
  },
  expert_mode: {
    id: 'expert_mode',
    name: 'Expert Territory',
    description: 'Correctly answered an expert-level case',
    icon: '💡',
  },
  rising_star: {
    id: 'rising_star',
    name: 'Rising Star',
    description: 'Reached ELO rating of 1200',
    icon: '⭐',
  },
  house_md: {
    id: 'house_md',
    name: 'House MD',
    description: 'Reached level 7 (Attending)',
    icon: '🦯',
  },
}

/** Calculate ELO change. K=32, expected score based on rating difference. */
export function calculateELOChange(
  userELO: number,
  aiELO: number,
  userWon: boolean
): number {
  const K = 32
  const expected = 1 / (1 + Math.pow(10, (aiELO - userELO) / 400))
  const actual = userWon ? 1 : 0
  return Math.round(K * (actual - expected))
}

/** Determine which new badges were earned */
export function checkNewBadges(
  session: UserSession,
  result: {
    isPerfect: boolean
    beatsAI: boolean
    isExpertCase: boolean
  }
): Badge[] {
  const existingIds = new Set(session.badges.map(b => b.id))
  const now = new Date().toISOString()
  const earned: Badge[] = []

  const award = (id: string) => {
    if (!existingIds.has(id) && BADGES[id]) {
      earned.push({ ...BADGES[id], earned_at: now })
    }
  }

  if (session.total_attempts === 0) award('first_blood')
  if (result.beatsAI) award('beat_the_ai')
  if (result.isPerfect) award('perfect_score')
  if (result.isExpertCase && result.isPerfect) award('expert_mode')
  if (session.streak_days >= 3) award('streak_3')
  if (session.streak_days >= 7) award('streak_7')
  if (session.streak_days >= 30) award('streak_30')
  if (session.total_attempts >= 9) award('ten_cases')
  if (session.elo_rating >= 1200) award('rising_star')
  if (session.level >= 7) award('house_md')

  return earned
}
