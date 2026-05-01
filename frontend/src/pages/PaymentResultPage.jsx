import { Link, useSearchParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { paymentsApi } from '../api/bookings'
import { useAuthStore } from '../store/authStore'
import { Alert, Spinner } from '../components/ui'

export default function PaymentResultPage({ status }) {
  const [params] = useSearchParams()
  const { isAuthenticated } = useAuthStore()
  const [paymentStatus, setPaymentStatus] = useState(null)
  const [loading, setLoading] = useState(false)

  const paymentId = params.get('paymentId')
  const isSuccess = status === 'success'

  useEffect(() => {
    if (!paymentId || !isAuthenticated()) return

    setLoading(true)
    paymentsApi.get(paymentId)
      .then(({ data }) => setPaymentStatus(data.status))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [paymentId, isAuthenticated])

  return (
    <div className="max-w-2xl mx-auto px-4 py-20">
      <div className="text-center">
        <div className={`mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full ${isSuccess ? 'bg-sage-100 text-sage-700' : 'bg-red-50 text-red-600'}`}>
          <span className="text-3xl">{isSuccess ? '✓' : '!'}</span>
        </div>

        <h1 className="font-display text-3xl md:text-4xl text-stone-700">
          {isSuccess ? 'Оплата обрабатывается' : 'Оплата не завершена'}
        </h1>

        <p className="font-body text-stone-500 mt-3">
          {isSuccess
            ? 'Как только Т-Банк подтвердит платеж, запись появится в профиле как оплаченная.'
            : 'Платеж можно попробовать провести еще раз со страницы тренировки.'}
        </p>

        {loading && (
          <div className="flex justify-center mt-6">
            <Spinner />
          </div>
        )}

        {paymentStatus && (
          <Alert type={paymentStatus === 'PAID' ? 'success' : 'info'} className="mt-6 text-left">
            Текущий статус платежа: {paymentStatus}
          </Alert>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
          <Link to="/profile" className="btn-primary justify-center">
            В профиль
          </Link>
          <Link to="/catalog" className="btn-ghost justify-center">
            К каталогу
          </Link>
        </div>
      </div>
    </div>
  )
}
