import { Suspense } from 'react'
import LoginForm from '@/components/auth/LoginForm'
import AuthShell from '@/components/auth/AuthShell'
import { I18nText } from '../shared'
import { authMetadata } from '../metadata'
export const generateMetadata = authMetadata('signin')
export default function Page() { return <AuthShell mode="signin"><Suspense fallback={<p role="status"><I18nText k="loadingForm" /></p>}><LoginForm /></Suspense></AuthShell> }
