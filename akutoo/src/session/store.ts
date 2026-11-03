import { create } from 'zustand';
interface AppState { offlineReady: boolean; updateReady: boolean; offlineError: boolean; }
export const useAppState = create<AppState>(() => ({ offlineReady: false, updateReady: false, offlineError: false }));
