import * as React from "react";
import { addDays, endOfDay, format, startOfDay, subDays, startOfMonth, endOfMonth } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

export type DateRange = { from?: Date; to?: Date };

export type DateRangePickerProps = {
  value?: DateRange;
  onChange?: (range: DateRange) => void;
  placeholder?: string;
  className?: string;
  align?: "start" | "center" | "end";
  presets?: Array<{ label: string; range: () => DateRange }>;
};

const defaultPresets = [
  { label: "Today", range: () => ({ from: startOfDay(new Date()), to: endOfDay(new Date()) }) },
  { label: "Yesterday", range: () => ({ from: startOfDay(subDays(new Date(),1)), to: endOfDay(subDays(new Date(),1)) }) },
  { label: "Last 7 days", range: () => ({ from: startOfDay(subDays(new Date(),6)), to: endOfDay(new Date()) }) },
  { label: "This month", range: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }) },
  { label: "Last 30 days", range: () => ({ from: startOfDay(subDays(new Date(),29)), to: endOfDay(new Date()) }) },
];

export function DateRangePicker({ value, onChange, placeholder = "Pick a date range", className, align = "end", presets = defaultPresets }: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  const from = value?.from;
  const to = value?.to;
  const short = (d: Date) => format(d, "MMM d, yyyy");
  const label = from && to ? `${short(from)} – ${short(to)}` : (from ? `${short(from)} – …` : placeholder);

  return (
    <div className={cn("flex w-48 max-w-full min-w-0 items-center gap-1.5", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "h-10 w-full min-w-0 justify-start gap-2 overflow-hidden px-3 font-normal",
              (!from && !to) && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate text-left">{label}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[17.5rem] max-w-[calc(100vw-1.5rem)] overflow-hidden p-0"
          align={align}
          collisionPadding={12}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <div className="flex min-w-0 max-w-full flex-col">
            <div className="flex min-w-0 gap-1 overflow-x-auto border-b border-border/50 p-2">
              {presets.map(p => (
                <Button key={p.label} variant="ghost" size="sm" className="h-7 px-2 text-xs font-normal" onClick={() => onChange?.(p.range())}>{p.label}</Button>
              ))}
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => onChange?.({ from: undefined, to: undefined })}>Clear</Button>
            </div>
            <Calendar
              mode="range"
              selected={{ from: from, to: to } as any}
              onSelect={(r: any) => {
                const next: DateRange = { from: r?.from, to: r?.to };
                onChange?.(next);
              }}
              numberOfMonths={1}
              defaultMonth={from || new Date()}
              className="p-2"
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default DateRangePicker;
