'use client'
import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { ShoppingBag, Mail, Loader2, ArrowLeft } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSent(true)
    }
  }

  if (sent) {
    return (
      <div className="card text-center" style={{ padding: '40px' }}>
        <div className="text-4xl mb-4">📧</div>
        <h2 className="text-xl font-bold mb-2">Email enviado!</h2>
        <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
          Verifique sua caixa de entrada e clique no link para redefinir sua senha.
        </p>
        <Link href="/auth/login" className="btn-primary">Voltar ao login</Link>
      </div>
    )
  }

  return (
    <div className="card animate-fade-in" style={{ padding: '40px' }}>
      <div className="flex flex-col items-center mb-8">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
             style={{ background: 'linear-gradient(135deg, #EE2C00, #FF6535)' }}>
          <ShoppingBag className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-2xl font-bold">Recuperar senha</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Enviaremos um link para seu email
        </p>
      </div>

      <form onSubmit={handleReset} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg text-sm" style={{ background: 'rgba(255,61,113,0.1)', color: 'var(--danger)', border: '1px solid rgba(255,61,113,0.2)' }}>
            {error}
          </div>
        )}
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="input-field pl-10" placeholder="seu@email.com" required />
          </div>
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {loading ? 'Enviando...' : 'Enviar link de recuperação'}
        </button>
      </form>

      <div className="flex justify-center mt-6">
        <Link href="/auth/login" className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <ArrowLeft className="w-4 h-4" /> Voltar ao login
        </Link>
      </div>
    </div>
  )
}
