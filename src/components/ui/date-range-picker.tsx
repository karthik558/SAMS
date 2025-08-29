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

export function DateRangePicker({ value, onChange, placeholder = "Pick a date range", className, align = "start", presets = defaultPresets }: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  const from = value?.from;
  const to = value?.to;
  const label = from && to ? `${format(from, "PP")} – ${format(to, "PP")}` : (from ? `${format(from, "PP")} – …` : placeholder);

  return (
    <div className="inline-flex items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn("justify-start gap-2 font-normal", (!from && !to) && "text-muted-foreground", className)}>
            <CalendarIcon className="h-4 w-4" /> {label}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3" align={align}>
          <div className="flex gap-3">
            <div className="flex flex-col gap-2">
              {presets.map(p => (
                <Button key={p.label} variant="ghost" className="justify-start" onClick={() => onChange?.(p.range())}>{p.label}</Button>
              ))}
              <Button variant="outline" onClick={() => onChange?.({ from: undefined, to: undefined })}>Clear</Button>
            </div>
            <div>
              <Calendar
                mode="range"
                selected={{ from: from, to: to } as any}
                onSelect={(r: any) => {
                  const next: DateRange = { from: r?.from, to: r?.to };
                  onChange?.(next);
                }}
                numberOfMonths={2}
                defaultMonth={from || new Date()}
                initialFocus
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>
      {(from || to) && (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={() => onChange?.({ from: undefined, to: undefined })}
          aria-label="Clear date range"
        >
          Clear
        </Button>
      )}
    </div>
  );
}

export default DateRangePicker;
