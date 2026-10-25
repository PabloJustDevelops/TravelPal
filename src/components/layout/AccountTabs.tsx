import Link from "next/link";
import { useI18n } from '@/lib/i18n/LocaleProvider';
import { localePath } from '@/lib/i18n';
export default function AccountTabs({
  active,
}: {
  active: "profile" | "settings";
}) {
  const { t, locale } = useI18n();
  return (
    <nav aria-label={t('accountTabLabel')} className="flex gap-2 border-b border-line">
      {[
        { id: "profile", title: t('myProfile') },
        { id: "settings", title: t('settings') },
      ].map((item) => (
        <Link
          key={item.id}
          href={localePath(locale, `/${item.id}`)}
          aria-current={active === item.id ? "page" : undefined}
          className={`inline-flex min-h-12 items-center border-b-2 px-4 text-sm font-medium ${active === item.id ? "border-accent text-accent" : "border-transparent text-muted hover:text-ink"}`}
        >
          {item.title}
        </Link>
      ))}
    </nav>
  );
}
