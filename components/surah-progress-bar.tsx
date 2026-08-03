import { Progress } from "@/components/ui/progress";

export function SurahProgressBar({ listened, total }: { listened: number; total: number }) {
  const percent = total > 0 ? Math.round((listened / total) * 100) : 0;
  return (
    <div className="flex flex-col gap-1">
      <Progress value={percent} />
      <span className="text-right text-[10px] text-muted-foreground">
        {listened}/{total}
      </span>
    </div>
  );
}
