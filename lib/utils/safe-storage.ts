export const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window === "undefined") return null
      return localStorage.getItem(key)
    } catch (error) {
      console.error(`[v0] localStorage.getItem failed for key "${key}":`, error)
      return null
    }
  },

  setItem: (key: string, value: string): boolean => {
    try {
      if (typeof window === "undefined") return false
      localStorage.setItem(key, value)
      // Verify write succeeded
      const verify = localStorage.getItem(key)
      if (verify === value) {
        return true
      }
      console.warn(`[v0] localStorage.setItem verification failed for key "${key}"`)
      return false
    } catch (error) {
      console.error(`[v0] localStorage.setItem failed for key "${key}":`, error)
      return false
    }
  },

  removeItem: (key: string): boolean => {
    try {
      if (typeof window === "undefined") return false
      localStorage.removeItem(key)
      return true
    } catch (error) {
      console.error(`[v0] localStorage.removeItem failed for key "${key}":`, error)
      return false
    }
  },

  clear: (): boolean => {
    try {
      if (typeof window === "undefined") return false
      localStorage.clear()
      return true
    } catch (error) {
      console.error("[v0] localStorage.clear failed:", error)
      return false
    }
  },
}
