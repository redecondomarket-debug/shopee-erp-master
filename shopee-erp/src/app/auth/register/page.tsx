'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { ShoppingBag, Mail, Lock, Eye, EyeOff, Loader2, User } from 'lucide-react'

export default function RegisterPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } }
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSuccess(true)
      setTimeout(() => router.push('/auth/login'), 3000)
    }
  }

  if (success) {
    return (
      <div className="card text-center" style={{ padding: '40px' }}>
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
             style={{ background: 'rgba(0,214,143,0.1)' }}>
          <span className="text-3xl">✅</span>
        </div>
        <h2 className="text-xl font-bold mb-2">Conta criada!</h2>
        <p style={{ color: 'var(--text-secondary)' }}>
          Verifique seu email para confirmar o cadastro. Redirecionando...
        </p>
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
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>Criar conta</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Shopee ERP Master</p>
      </div>

      <form onSubmit={handleRegister} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg text-sm" style={{ background: 'rgba(255,61,113,0.1)', color: 'var(--danger)', border: '1px solid rgba(255,61,113,0.2)' }}>
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Nome</label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              className="input-field pl-10" placeholder="Seu nome" required />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="input-field pl-10" placeholder="seu@email.com" required />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Senha</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
              className="input-field pl-10 pr-10" placeholder="Mínimo 6 caracteres" minLength={6} required />
            <button type="button" onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {loading ? 'Criando conta...' : 'Criar conta'}
        </button>
      </form>

      <p className="text-center text-sm mt-6" style={{ color: 'var(--text-secondary)' }}>
        Já tem conta?{' '}
        <Link href="/auth/login" style={{ color: 'var(--shopee-primary)', fontWeight: 600 }}>Entrar</Link>
      </p>
    </div>
  )
}
