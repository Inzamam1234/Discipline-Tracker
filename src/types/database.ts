export type Profile = {
    id: string
    username: string
    full_name: string | null
    avatar_url: string | null
    xp: number
    level: number
    created_at: string
}

export type Habit = {
    id: string
    user_id: string
    name: string
    icon: string
    unit: string | null
    target_value: number | null
    habit_type: 'boolean' | 'numeric'
    is_active: boolean
    created_at: string
}

export type HabitLog = {
    id: string
    habit_id: string
    user_id: string
    log_date: string
    completed: boolean
    value: number | null
    notes: string | null
    logged_at: string
}

export type Group = {
    id: string
    name: string
    description: string | null
    invite_code: string
    created_by: string
    is_active: boolean
    created_at: string
}