import { Routes, Route, Navigate } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { PulseSpace } from './spaces/PulseSpace'
import { StudioSpace } from './spaces/StudioSpace'
import { ChannelsSpace } from './spaces/ChannelsSpace'

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/pulse" element={<PulseSpace />} />
        <Route path="/studio" element={<StudioSpace />} />
        {/* Workspace merged into Studio — its old home now lands there. */}
        <Route path="/" element={<Navigate to="/studio" replace />} />
        {/* LinkedIn / Email / Articles are now sub-tabs of one Channels view. */}
        <Route path="/channels" element={<ChannelsSpace />} />
        <Route path="/linkedin/*" element={<Navigate to="/channels" replace />} />
        <Route path="/email/*" element={<Navigate to="/channels" replace />} />
        <Route path="/articles/*" element={<Navigate to="/channels" replace />} />
        <Route path="*" element={<Navigate to="/studio" replace />} />
      </Route>
    </Routes>
  )
}
