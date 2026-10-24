import { Suspense } from 'react'
import RegisterForm from '@/components/auth/RegisterForm'
import AuthShell from '@/components/auth/AuthShell'
import { I18nText } from '../shared'
export { generateMetadata } from '../metadata'
export default function Page() { return <AuthShell mode="signup"><Suspense fallback={<p role="status"><I18nText k="loadingForm" /></p>}><RegisterForm /></Suspense></AuthShell> }
