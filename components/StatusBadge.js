export default function StatusBadge({ status }) {
  const styles = {
    open:    'bg-green-100 text-green-800',
    closed:  'bg-gray-100 text-gray-600',
    pending: 'bg-yellow-100 text-yellow-800',
  }
  return (
    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  )
}
