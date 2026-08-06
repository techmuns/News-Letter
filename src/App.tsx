import { Routes, Route, Navigate } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { PulseSpace } from './spaces/PulseSpace'
import { StudioSpace } from './spaces/StudioSpace'
import { Workspace } from './spaces/Workspace'
import { LinkedInSpace } from './spaces/LinkedInSpace'
import { EmailSpace } from './spaces/EmailSpace'
import { ArticlesSpace } from './spaces/ArticlesSpace'

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/pulse" element={<PulseSpace />} />
        <Route path="/studio" element={<StudioSpace />} />
        <Route path="/" element={<Workspace />} />
        <Route path="/linkedin" element={<LinkedInSpace />} />
        <Route path="/linkedin/:campaignId" element={<LinkedInSpace />} />
        <Route path="/email" element={<EmailSpace />} />
        <Route path="/email/:campaignId" element={<EmailSpace />} />
        <Route path="/articles" element={<ArticlesSpace />} />
        <Route path="/articles/:campaignId" element={<ArticlesSpace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
