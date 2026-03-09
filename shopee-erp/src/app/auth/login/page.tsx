'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { ShoppingBag, Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    
    if (error) {
      setError('Email ou senha incorretos. Tente novamente.')
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div className="card animate-fade-in" style={{ padding: '40px' }}>
      {/* Logo */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
             style={{ background: 'linear-gradient(135deg, #EE2C00, #FF6535)' }}>
          <ShoppingBag className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
          Shopee ERP Master
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Entre na sua conta
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleLogin} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg text-sm" style={{ background: 'rgba(255,61,113,0.1)', color: 'var(--danger)', border: '1px solid rgba(255,61,113,0.2)' }}>
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
            Email
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="input-field pl-10"
              placeholder="seu@email.com"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
            Senha
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="input-field pl-10 pr-10"
              placeholder="••••••••"
              required
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="flex justify-end">
          <Link href="/auth/forgot-password" className="text-sm" style={{ color: 'var(--shopee-primary)' }}>
            Esqueceu a senha?
          </Link>
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>

      <p className="text-center text-sm mt-6" style={{ color: 'var(--text-secondary)' }}>
        Não tem conta?{' '}
        <Link href="/auth/register" style={{ color: 'var(--shopee-primary)', fontWeight: 600 }}>
          Cadastrar
        </Link>
      </p>
    </div>
  )
}
