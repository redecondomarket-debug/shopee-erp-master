'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email,    setEmail]    = useState('')
  const [senha,    setSenha]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [erro,     setErro]     = useState('')
  const [showPass, setShowPass] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !senha) { setErro('Preencha e-mail e senha'); return }
    setLoading(true)
    setErro('')
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    setLoading(false)
    if (error) {
      setErro('E-mail ou senha incorretos')
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#0b0b12',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Arial, sans-serif',
    }}>
      <div style={{ width: '100%', maxWidth: 400, padding: '0 24px' }}>

        {/* LOGO */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🛒</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#ff6600', letterSpacing: -0.5 }}>
            SHOPEE GESTÃO
          </div>
          <div style={{ fontSize: 12, color: '#55556a', marginTop: 4 }}>
            Estoque Único · 3 Lojas
          </div>
        </div>

        {/* CARD */}
        <div style={{
          background: '#16161f', border: '1px solid #222232',
          borderRadius: 16, padding: '32px 28px',
        }}>
          <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 800, color: '#e2e2f0' }}>
            Bem-vindo de volta
          </h2>
          <p style={{ margin: '0 0 24px', fontSize: 13, color: '#55556a' }}>
            Faça login para acessar o painel
          </p>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* EMAIL */}
            <div>
              <label style={{ fontSize: 11, color: '#55556a', fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                autoComplete="email"
                style={{
                  width: '100%', background: '#0f0f1a', border: '1px solid #2a2a3a',
                  borderRadius: 8, padding: '10px 14px', color: '#e2e2f0', fontSize: 14,
                  outline: 'none', boxSizing: 'border-box',
                }}
                onFocus={e => e.target.style.borderColor = '#ff6600'}
                onBlur={e => e.target.style.borderColor = '#2a2a3a'}
              />
            </div>

            {/* SENHA */}
            <div>
              <label style={{ fontSize: 11, color: '#55556a', fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                Senha
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  style={{
                    width: '100%', background: '#0f0f1a', border: '1px solid #2a2a3a',
                    borderRadius: 8, padding: '10px 42px 10px 14px', color: '#e2e2f0', fontSize: 14,
                    outline: 'none', boxSizing: 'border-box',
                  }}
                  onFocus={e => e.target.style.borderColor = '#ff6600'}
                  onBlur={e => e.target.style.borderColor = '#2a2a3a'}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: '#55556a', fontSize: 16,
                  }}
                >
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {/* ERRO */}
            {erro && (
              <div style={{
                background: '#ef444415', border: '1px solid #ef444430',
                borderRadius: 8, padding: '10px 14px',
                fontSize: 13, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 8,
              }}>
                ❌ {erro}
              </div>
            )}

            {/* BOTÃO */}
            <button
              type="submit"
              disabled={loading}
              style={{
                background: loading ? '#ff660066' : '#ff6600',
                color: '#fff', border: 'none', borderRadius: 8,
                padding: '12px', cursor: loading ? 'not-allowed' : 'pointer',
                fontWeight: 800, fontSize: 14, marginTop: 4,
                transition: 'background 0.2s',
              }}
            >
              {loading ? '⏳ Entrando...' : '→ Entrar no Sistema'}
            </button>

          </form>
        </div>

        <p style={{ textAlign: 'center', fontSize: 11, color: '#33334a', marginTop: 24 }}>
          Shopee ERP Master · Acesso restrito
        </p>
      </div>

      <style>{`
        * { box-sizing: border-box; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
