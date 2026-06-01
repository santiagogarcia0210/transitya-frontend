import { create } from 'zustand';

interface AuthState {
  user: any | null;
  tenantId: string | null;
  rol: string | null;
  loading: boolean;
  setUser: (user: any, tenantId: string, rol: string) => void;
  clearUser: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  tenantId: null,
  rol: null,
  loading: true,
  setUser: (user, tenantId, rol) => set({ user, tenantId, rol, loading: false }),
  clearUser: () => set({ user: null, tenantId: null, rol: null, loading: false }),
  setLoading: (loading) => set({ loading })
}));
