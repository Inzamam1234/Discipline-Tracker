'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [username, setUsername] = useState('')
    const [isSignUp, setIsSignUp] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [message, setMessage] = useState('')
    const router = useRouter()
    const supabase = createClient()

    async function handleAuth() {
        setLoading(true); setError(''); setMessage('')
        if (isSignUp) {
            const { error } = await supabase.auth.signUp({
                email, password,
                options: { data: { preferred_username: username }, emailRedirectTo: `${window.location.origin}/auth/callback` },
            })
            if (error) setError(error.message)
            else setMessage('Check your email to confirm your account!')
        } else {
            const { error } = await supabase.auth.signInWithPassword({ email, password })
            if (error) setError(error.message)
            else router.push('/dashboard')
        }
        setLoading(false)
    }

    return (
        <div className="min-h-screen bg-[#f0f4f8] flex items-center justify-center p-4">
            <div className="w-full max-w-sm">

                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-green-500 rounded-3xl shadow-[0_6px_0_#16a34a] mb-4">
                        <span className="text-4xl">🏆</span>
                    </div>
                    <h1 className="font-black text-3xl text-gray-800">Discipline</h1>
                    <p className="text-gray-400 font-semibold mt-1">Build habits. Beat your streak. Win.</p>
                </div>

                {/* Card */}
                <div className="card">
                    <h2 className="font-black text-xl text-center mb-6">
                        {isSignUp ? '🎉 Create account' : '👋 Welcome back'}
                    </h2>

                    <div className="space-y-3">
                        {isSignUp && (
                            <input type="text" placeholder="Username" value={username}
                                onChange={e => setUsername(e.target.value)} className="input-field" />
                        )}
                        <input type="email" placeholder="Email address" value={email}
                            onChange={e => setEmail(e.target.value)} className="input-field" />
                        <input type="password" placeholder="Password" value={password}
                            onChange={e => setPassword(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAuth()} className="input-field" />
                    </div>

                    {error && (
                        <div className="mt-4 p-3 bg-red-50 border-2 border-red-200 rounded-2xl">
                            <p className="text-red-500 font-bold text-sm">⚠️ {error}</p>
                        </div>
                    )}
                    {message && (
                        <div className="mt-4 p-3 bg-green-50 border-2 border-green-200 rounded-2xl">
                            <p className="text-green-600 font-bold text-sm">✅ {message}</p>
                        </div>
                    )}

                    <button onClick={handleAuth} disabled={loading} className="btn-primary w-full mt-5 text-base">
                        {loading ? '...' : isSignUp ? 'Create Account 🚀' : 'Sign In →'}
                    </button>

                    <p className="text-center text-gray-400 font-semibold text-sm mt-5">
                        {isSignUp ? 'Already have an account?' : "Don't have an account?"}
                        {' '}
                        <button onClick={() => { setIsSignUp(!isSignUp); setError(''); setMessage('') }}
                            className="text-green-500 font-black hover:text-green-600">
                            {isSignUp ? 'Sign in' : 'Sign up free!'}
                        </button>
                    </p>
                </div>
            </div>
        </div>
    )
}