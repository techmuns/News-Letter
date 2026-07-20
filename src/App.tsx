import { Routes, Route, Navigate } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { Workspace } from './spaces/Workspace'
import { LinkedInSpace } from './spaces/LinkedInSpace'
import { EmailSpace } from './spaces/EmailSpace'
import { ArticlesSpace } from './spaces/ArticlesSpace'
import { ReportsSpace } from './spaces/ReportsSpace'
import { CampaignsSpace } from './spaces/CampaignsSpace'

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Workspace />} />
        <Route path="/linkedin" element={<LinkedInSpace />} />
        <Route path="/linkedin/:campaignId" element={<LinkedInSpace />} />
        <Route path="/email" element={<EmailSpace />} />
        <Route path="/email/:campaignId" element={<EmailSpace />} />
        <Route path="/articles" element={<ArticlesSpace />} />
        <Route path="/articles/:campaignId" element={<ArticlesSpace />} />
        <Route path="/reports" element={<ReportsSpace />} />
        <Route path="/campaigns" element={<CampaignsSpace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
