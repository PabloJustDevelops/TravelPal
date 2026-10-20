import type { ReactNode } from 'react'
import { fn } from 'storybook/test'
import type * as Auth from '../AuthContext'

export const useAuth = fn<typeof Auth.useAuth>()
export const AuthProvider = ({ children }: { children: ReactNode }) => children
