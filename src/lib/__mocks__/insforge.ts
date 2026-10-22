import { fn } from 'storybook/test'
import type * as Insforge from '../insforge'

export const createInsforgeClient = fn<typeof Insforge.createInsforgeClient>()

export const JOURNAL_PHOTOS_BUCKET = 'journal-photos'
