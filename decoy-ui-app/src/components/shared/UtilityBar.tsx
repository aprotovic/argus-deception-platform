import { useTranslation } from '../../i18n/useTranslation'
export function UtilityBar() {
  const { t } = useTranslation()
  return (
    <div className="hidden md:flex bg-primary-dark text-white/75 text-xs justify-end items-center gap-6 px-6 py-1.5">
      <a href="#branches" className="hover:text-white transition-colors">{t('utility.branches')}</a>
      <a href="#contact" className="hover:text-white transition-colors">{t('utility.contact')}</a>
      <a href="#security" className="hover:text-white transition-colors">{t('utility.securityTips')}</a>
    </div>
  )
}
