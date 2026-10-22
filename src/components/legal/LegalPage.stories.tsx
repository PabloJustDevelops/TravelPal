import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import PrivacyPage from '@/app/privacidad/page';
import LegalNoticePage from '@/app/aviso-legal/page';

const meta = { title: 'Legal/Páginas', component: PrivacyPage, parameters: { hasMain: true } } satisfies Meta<typeof PrivacyPage>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Privacy: Story = {};
export const PrivacyDark: Story = { globals: { theme: 'dark' } };
export const Notice: Story = { render: () => <LegalNoticePage /> };
