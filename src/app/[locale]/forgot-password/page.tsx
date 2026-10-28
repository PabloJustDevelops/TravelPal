import { Suspense } from 'react'
import Link from 'next/link'
import ForgotPasswordForm from '@/components/auth/ForgotPasswordForm'
import AuthShell from '@/components/auth/AuthShell'
import { I18nText } from '../shared'
import { authMetadata } from '../metadata'
import { localePath, type Locale } from '@/lib/i18n'
export const generateMetadata = authMetadata('forgot-password')
export default async function Page({ params }: { params: Promise<{ locale: Locale }> }) { const { locale } = await params; return <AuthShell><h1 className="text-3xl font-semibold tracking-tight"><I18nText k="forgotTitle" /></h1><p className="mt-3 leading-relaxed text-muted"><I18nText k="forgotBody" /></p><Suspense fallback={<p role="status"><I18nText k="loadingForm" /></p>}><ForgotPasswordForm /></Suspense><Link href={localePath(locale, '/signin')} className="mt-6 inline-flex text-sm font-medium text-accent hover:text-accent-hover"><I18nText k="backSignIn" /></Link></AuthShell> }
