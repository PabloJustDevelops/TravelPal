import { Suspense } from 'react'
import ResetPasswordForm from '@/components/auth/ResetPasswordForm'
import AuthShell from '@/components/auth/AuthShell'
import { I18nText } from '../shared'
import { authMetadata } from '../metadata'
export const generateMetadata = authMetadata('reset-password')
export default function Page() { return <AuthShell><h1 className="text-3xl font-semibold tracking-tight"><I18nText k="resetTitle" /></h1><p className="mt-3 leading-relaxed text-muted"><I18nText k="resetBody" /></p><Suspense fallback={<p role="status"><I18nText k="loadingForm" /></p>}><ResetPasswordForm /></Suspense></AuthShell> }
