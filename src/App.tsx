import { Routes, Route, Navigate } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { Workspace } from './spaces/Workspace'
import { PreviewSpace } from './spaces/PreviewSpace'
import { SchedulingSpace } from './spaces/SchedulingSpace'
import { ReportsSpace } from './spaces/ReportsSpace'
import { CampaignsSpace } from './spaces/CampaignsSpace'

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Workspace />} />
        <Route path="/preview" element={<PreviewSpace />} />
        <Route path="/preview/:campaignId" element={<PreviewSpace />} />
        <Route path="/preview/:campaignId/:channel" element={<PreviewSpace />} />
        <Route path="/scheduling" element={<SchedulingSpace />} />
        <Route path="/reports" element={<ReportsSpace />} />
        <Route path="/campaigns" element={<CampaignsSpace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
