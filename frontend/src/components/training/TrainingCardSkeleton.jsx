export default function TrainingCardSkeleton() {
  return (
    <div className="card p-5 flex flex-col gap-4">
      <div className="flex justify-between">
        <div className="flex gap-2">
          <div className="skeleton h-5 w-14 rounded-full" />
          <div className="skeleton h-5 w-20 rounded-full" />
        </div>
        <div className="skeleton h-5 w-16 rounded-lg" />
      </div>
      <div className="space-y-2">
        <div className="skeleton h-5 w-3/4 rounded-lg" />
        <div className="skeleton h-3 w-1/3 rounded-lg" />
      </div>
      <div className="flex gap-4">
        <div className="skeleton h-3 w-24 rounded-lg" />
        <div className="skeleton h-3 w-16 rounded-lg" />
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between">
          <div className="skeleton h-3 w-24 rounded-lg" />
          <div className="skeleton h-3 w-16 rounded-lg" />
        </div>
        <div className="skeleton h-1.5 w-full rounded-full" />
      </div>
    </div>
  )
}
