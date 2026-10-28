import { useStore } from './store';
import { StartScreen } from './components/StartScreen';
import { SetupWizard } from './components/setup/SetupWizard';
import { LiveScreen } from './components/live/LiveScreen';

export function App() {
  const { activeEvent } = useStore();
  if (!activeEvent) return <StartScreen />;
  if (activeEvent.screen.kind === 'live') return <LiveScreen />;
  return <SetupWizard step={activeEvent.screen.step} />;
}
