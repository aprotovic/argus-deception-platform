import { Modal } from '../shared/Modal'
import { LoadingButton } from '../shared/LoadingButton'
import { useTranslation } from '../../i18n/useTranslation'
interface Props { isOpen: boolean; onContinue: () => void; onLogout: () => void }
export function SessionTimeoutModal({ isOpen, onContinue, onLogout }: Props) {
  const { t } = useTranslation()
  return (
    <Modal isOpen={isOpen} onClose={onContinue} title={t('dashboard.session.warning')}>
      <div className="flex flex-col gap-3 mt-2">
        <LoadingButton onClick={onContinue} className="w-full bg-primary hover:bg-primary-dark text-white">{t('dashboard.session.continue')}</LoadingButton>
        <LoadingButton onClick={onLogout} className="w-full border border-danger text-danger hover:bg-danger-bg">{t('dashboard.session.signOut')}</LoadingButton>
      </div>
    </Modal>
  )
}
