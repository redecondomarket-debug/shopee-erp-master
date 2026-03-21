'use client'
import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'erp_imposto'
export const DEFAULT_IMPOSTO = 0.06

export function useTaxRate() {
  const [imposto, setImposto] = useState<number>(() => {
    if (typeof window === 'undefined') return DEFAULT_IMPOSTO
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? parseFloat(saved) : DEFAULT_IMPOSTO
  })

  const [impostoInput, setImpostoInput] = useState<string>(() => {
    if (typeof window === 'undefined') return (DEFAULT_IMPOSTO * 100).toFixed(1)
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? (parseFloat(saved) * 100).toFixed(1) : (DEFAULT_IMPOSTO * 100).toFixed(1)
  })

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY && e.newValue) {
        const v = parseFloat(e.newValue)
        setImposto(v)
        setImpostoInput((v * 100).toFixed(1))
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const salvarImposto = useCallback((inputStr?: string) => {
    const str = inputStr ?? impostoInput
    const v = parseFloat(str) / 100
    if (isNaN(v) || v < 0 || v > 1) return
    setImposto(v)
    setImpostoInput((v * 100).toFixed(1))
    localStorage.setItem(STORAGE_KEY, String(v))
  }, [impostoInput])

  return { imposto, impostoInput, setImpostoInput, salvarImposto }
}
