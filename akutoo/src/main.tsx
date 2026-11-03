import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { useAppState } from './session/store';
import './style.css';
// Keep the worker entry in the production graph before guided capture is connected.
export { AnalysisClient } from './analysis/client';
export { HairClient } from './hair/client';
registerSW({ immediate: true,
  onOfflineReady: () => useAppState.setState({ offlineReady: true }),
  onNeedRefresh: () => useAppState.setState({ updateReady: true }),
  onRegisterError: () => useAppState.setState({ offlineError: true }),
});
if ('serviceWorker' in navigator) void navigator.serviceWorker.getRegistration().then(registration => {
  if (registration?.active) useAppState.setState({ offlineReady: true });
});
createRoot(document.getElementById('root')!).render(<App />);
