'use client'
import { useState, useRef } from 'react'

type Props = {
  habit: {
    id: string
    name: string
    icon: string
    color: string
    habit_type: string
    target_value: number | null
    unit: string | null
  }
  onConfirm: (value?: number, photoUrl?: string, notes?: string) => void
  onCancel: () => void
}

export default function LogHabitModal({ habit, onConfirm, onCancel }: Props) {
  const [numericVal, setNumericVal] = useState('')
  const [rangeVal, setRangeVal] = useState(5)
  const [timerSeconds, setTimerSeconds] = useState(0)
  const [timerRunning, setTimerRunning] = useState(false)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [compressing, setCompressing] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function startTimer() {
    setTimerRunning(true)
    timerRef.current = setInterval(() => setTimerSeconds(s => s + 1), 1000)
  }
  function stopTimer() {
    setTimerRunning(false)
    if (timerRef.current) clearInterval(timerRef.current)
  }
  function resetTimer() { stopTimer(); setTimerSeconds(0) }
  function formatTime(s: number) {
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  }

  async function compressImage(file: File): Promise<string> {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')!
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        // Max 400px width for storage
        const maxW = 400
        const ratio = Math.min(maxW / img.width, maxW / img.height, 1)
        canvas.width = img.width * ratio
        canvas.height = img.height * ratio
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        URL.revokeObjectURL(url)
        resolve(canvas.toDataURL('image/jpeg', 0.6))
      }
      img.src = url
    })
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCompressing(true)
    try {
      const compressed = await compressImage(file)
      setPhotoPreview(compressed)
    } catch {
      const reader = new FileReader()
      reader.onload = () => setPhotoPreview(reader.result as string)
      reader.readAsDataURL(file)
    }
    setCompressing(false)
  }

  function handleConfirm() {
    if (habit.habit_type === 'numeric') onConfirm(parseFloat(numericVal) || 0, undefined, notes)
    else if (habit.habit_type === 'range') onConfirm(rangeVal, undefined, notes)
    else if (habit.habit_type === 'timer') { stopTimer(); onConfirm(Math.round(timerSeconds / 60), undefined, notes) }
    else if (habit.habit_type === 'photo') onConfirm(undefined, photoPreview ?? undefined, notes)
    else onConfirm(undefined, undefined, notes)
  }

  const color = habit.color ?? '#4ade80'
  const canConfirm = !(
    (habit.habit_type === 'numeric' && !numericVal) ||
    (habit.habit_type === 'photo' && !photoPreview) ||
    (habit.habit_type === 'timer' && timerSeconds === 0)
  )

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
      <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden">

        <div className="p-5 pb-4 flex items-center gap-3 border-b border-gray-100">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
            style={{ backgroundColor: color }}>{habit.icon}</div>
          <div>
            <h3 className="font-black text-lg text-gray-800">{habit.name}</h3>
            <p className="text-sm font-semibold text-gray-400">Log today's progress</p>
          </div>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">

          {habit.habit_type === 'boolean' && (
            <div className="text-center py-2">
              <div className="text-5xl mb-3">✅</div>
              <p className="font-bold text-gray-600">Mark as completed today?</p>
            </div>
          )}

          {habit.habit_type === 'numeric' && (
            <div>
              <p className="font-bold text-gray-600 mb-3 text-sm">
                How much did you do?
                {habit.target_value && (
                  <span className="text-gray-400 font-normal"> (Target: {habit.target_value} {habit.unit})</span>
                )}
              </p>
              <div className="flex items-center gap-3">
                <input type="number" value={numericVal}
                  onChange={e => setNumericVal(e.target.value)}
                  placeholder={`e.g. ${habit.target_value ?? 100}`}
                  className="flex-1 input-field text-2xl font-black text-center" autoFocus />
                {habit.unit && <span className="font-bold text-gray-400 text-lg">{habit.unit}</span>}
              </div>
              {habit.target_value && numericVal && (
                <div className="mt-3">
                  <div className="w-full bg-gray-100 rounded-full h-2.5">
                    <div className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, (parseFloat(numericVal) / habit.target_value) * 100)}%`,
                        backgroundColor: color,
                      }} />
                  </div>
                  <p className="text-xs font-semibold text-gray-400 mt-1 text-right">
                    {Math.round((parseFloat(numericVal) / habit.target_value) * 100)}% of target
                  </p>
                </div>
              )}
            </div>
          )}

          {habit.habit_type === 'range' && (
            <div>
              <p className="font-bold text-gray-600 mb-4 text-sm">Rate your performance today</p>
              <div className="text-center mb-4">
                <span className="font-black text-6xl" style={{ color }}>{rangeVal}</span>
                <span className="font-bold text-gray-400 text-2xl">/10</span>
              </div>
              <input type="range" min={1} max={10} value={rangeVal}
                onChange={e => setRangeVal(parseInt(e.target.value))}
                className="w-full h-3 cursor-pointer accent-green-500" />
              <div className="flex justify-between text-xs font-bold text-gray-400 mt-1">
                <span>1 — Poor</span><span>10 — Perfect</span>
              </div>
              <div className="grid grid-cols-10 gap-0.5 mt-3">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                  <div key={n} className="h-2 rounded-full transition-all"
                    style={{ backgroundColor: n <= rangeVal ? color : '#e5e7eb' }} />
                ))}
              </div>
            </div>
          )}

          {habit.habit_type === 'timer' && (
            <div className="text-center">
              <p className="font-bold text-gray-600 mb-4 text-sm">
                {habit.target_value ? `Target: ${habit.target_value} minutes` : 'Track your time'}
              </p>
              <div className="font-black text-6xl mb-6 tabular-nums" style={{ color }}>
                {formatTime(timerSeconds)}
              </div>
              <div className="flex gap-3 justify-center">
                {!timerRunning ? (
                  <button onClick={startTimer} className="flex-1 btn-primary py-3 text-base">
                    {timerSeconds > 0 ? '▶ Resume' : '▶ Start'}
                  </button>
                ) : (
                  <button onClick={stopTimer}
                    className="flex-1 bg-orange-500 hover:bg-orange-400 text-white font-bold py-3 rounded-2xl shadow-[0_4px_0_#ea580c] active:shadow-none active:translate-y-1 transition-all">
                    ⏸ Pause
                  </button>
                )}
                {timerSeconds > 0 && (
                  <button onClick={resetTimer} className="btn-secondary px-4 py-3">Reset</button>
                )}
              </div>
              {habit.target_value && timerSeconds > 0 && (
                <div className="mt-4">
                  <div className="w-full bg-gray-100 rounded-full h-2.5">
                    <div className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, (timerSeconds / (habit.target_value * 60)) * 100)}%`,
                        backgroundColor: color,
                      }} />
                  </div>
                </div>
              )}
            </div>
          )}

          {habit.habit_type === 'photo' && (
            <div>
              <p className="font-bold text-gray-600 mb-3 text-sm">Upload a photo as proof</p>
              <input ref={fileInputRef} type="file" accept="image/*"
                capture="environment" onChange={handlePhotoChange} className="hidden" />
              {compressing ? (
                <div className="w-full h-36 border-2 border-dashed border-gray-300 rounded-2xl flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : photoPreview ? (
                <div className="relative">
                  <img src={photoPreview} alt="proof"
                    className="w-full h-48 object-cover rounded-2xl border-2 border-gray-200" />
                  <button onClick={() => setPhotoPreview(null)}
                    className="absolute top-2 right-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center font-bold">✕</button>
                </div>
              ) : (
                <button onClick={() => fileInputRef.current?.click()}
                  className="w-full h-36 border-2 border-dashed border-gray-300 rounded-2xl flex flex-col items-center justify-center gap-2 hover:border-green-400 hover:bg-green-50 transition-all cursor-pointer">
                  <span className="text-4xl">📸</span>
                  <span className="font-bold text-gray-500">Tap to take or upload photo</span>
                  <span className="text-xs text-gray-400 font-semibold">Photo will be compressed automatically</span>
                </button>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-gray-500 mb-2">
              📝 Notes <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="How did it go? Any observations..."
              rows={2}
              className="w-full bg-white border-2 border-gray-200 focus:border-green-400 rounded-2xl px-4 py-3 font-semibold outline-none transition-all text-sm placeholder:text-gray-400 placeholder:font-normal resize-none" />
          </div>
        </div>

        <div className="px-5 pb-5 flex gap-3">
          <button onClick={onCancel} className="flex-1 btn-secondary py-3">Cancel</button>
          <button onClick={handleConfirm} disabled={!canConfirm}
            className="flex-1 btn-primary py-3 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none">
            {habit.habit_type === 'boolean' ? '✓ Done!' :
              habit.habit_type === 'timer' ? '⏱ Log time' :
                habit.habit_type === 'photo' ? '📸 Submit' : '✓ Save'}
          </button>
        </div>
      </div>
    </div>
  )
}