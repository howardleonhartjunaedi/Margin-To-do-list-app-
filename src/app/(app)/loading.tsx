import { TaskRowSkeleton } from "@/components/ui/states";

export default function Loading() {
  return (
    <div>
      <div className="skeleton mb-10 h-10 w-40" />
      <TaskRowSkeleton rows={5} />
    </div>
  );
}
