import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker, useNavigation, type CaptionProps } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout,
  fromYear,
  toYear,
  ...props
}: CalendarProps) {
  const now = new Date();
  const fallbackFromYear = fromYear ?? now.getFullYear() - 30;
  const fallbackToYear = toYear ?? now.getFullYear() + 10;
  // We'll render our own custom caption with styled Month/Year selects
  const effectiveCaptionLayout = captionLayout; // not used when custom Caption provided

  function CustomCaption({ displayMonth }: CaptionProps) {
    const { goToMonth } = useNavigation();
    const monthIndex = displayMonth.getMonth();
    const year = displayMonth.getFullYear();
    const months = React.useMemo(() =>
      Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleString(undefined, { month: 'long' })), []);
    const years = React.useMemo(() => {
      const list: number[] = [];
      for (let y = fallbackFromYear; y <= fallbackToYear; y++) list.push(y);
      return list;
    }, [fallbackFromYear, fallbackToYear]);
    const onChange = (m: number, y: number) => {
      const next = new Date(y, m, 1);
      goToMonth(next);
    };
    return (
      <div className="flex items-center justify-center gap-2 px-2 pt-1 flex-wrap">
        <Select value={String(monthIndex)} onValueChange={(v) => onChange(Number(v), year)}>
          <SelectTrigger className="h-8 min-w-[7rem]">
            <SelectValue placeholder="Month" />
          </SelectTrigger>
          <SelectContent>
            {months.map((name, i) => (
              <SelectItem key={i} value={String(i)}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(year)} onValueChange={(v) => onChange(monthIndex, Number(v))}>
          <SelectTrigger className="h-8 min-w-[5.5rem]">
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent className="max-h-64">
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-2", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "hidden", // hidden since we render a custom caption
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
  table: "w-full border-collapse space-y-1 mx-auto",
        head_row: "flex",
        head_cell:
          "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        row: "flex w-full mt-2",
        cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100"
        ),
        day_range_end: "day-range-end",
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_today: "bg-accent text-accent-foreground",
        day_outside:
          "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ ..._props }) => <ChevronLeft className="h-4 w-4" />,
        IconRight: ({ ..._props }) => <ChevronRight className="h-4 w-4" />,
        Caption: CustomCaption,
      }}
      {...props}
      // fromYear/toYear still bound so navigation is constrained appropriately
      captionLayout={effectiveCaptionLayout as any}
      fromYear={fallbackFromYear}
      toYear={fallbackToYear}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
