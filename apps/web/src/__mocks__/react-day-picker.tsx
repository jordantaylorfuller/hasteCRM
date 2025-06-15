import React from "react";
import { format } from "date-fns";

export interface DayPickerProps {
  mode?: "single" | "multiple" | "range";
  selected?: Date | Date[] | { from?: Date; to?: Date };
  onSelect?: (date: any) => void;
  className?: string;
  classNames?: any;
  showOutsideDays?: boolean;
  numberOfMonths?: number;
  disabled?: boolean | ((date: Date) => boolean);
  locale?: any;
  fromDate?: Date;
  toDate?: Date;
  footer?: React.ReactNode;
  components?: any;
  [key: string]: any;
}

export function DayPicker({
  mode = "single",
  selected,
  onSelect,
  className,
  classNames,
  showOutsideDays = true,
  numberOfMonths = 1,
  disabled,
  locale,
  fromDate,
  toDate,
  footer,
  ...props
}: DayPickerProps) {
  const currentDate =
    selected instanceof Date ? selected : new Date(2024, 0, 15);
  const monthYear = format(currentDate, "MMMM yyyy");

  // Generate calendar days for testing
  const days = [];
  const firstDay = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    1,
  );
  const lastDay = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth() + 1,
    0,
  );

  // Add previous month days if showing outside days
  if (showOutsideDays) {
    const prevMonthLastDay = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      0,
    );
    const firstDayOfWeek = firstDay.getDay();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const day = new Date(prevMonthLastDay);
      day.setDate(prevMonthLastDay.getDate() - i);
      days.push({ date: day, outside: true });
    }
  }

  // Add current month days
  for (let i = 1; i <= lastDay.getDate(); i++) {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), i);
    days.push({ date, outside: false });
  }

  // Add next month days if showing outside days
  if (showOutsideDays) {
    const remainingDays = 42 - days.length; // 6 weeks * 7 days
    for (let i = 1; i <= remainingDays; i++) {
      const date = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() + 1,
        i,
      );
      days.push({ date, outside: true });
    }
  }

  const handleDateClick = (date: Date) => {
    if (
      disabled &&
      ((typeof disabled === "function" && disabled(date)) || disabled === true)
    ) {
      return;
    }

    if (onSelect) {
      if (mode === "single") {
        onSelect(date);
      } else if (mode === "range") {
        // Simple range selection logic for testing
        if (!selected || !(selected as any).from) {
          onSelect({ from: date });
        } else {
          onSelect({ from: (selected as any).from, to: date });
        }
      }
    }
  };

  const isSelected = (date: Date) => {
    if (!selected) return false;

    if (mode === "single" && selected instanceof Date) {
      return format(date, "yyyy-MM-dd") === format(selected, "yyyy-MM-dd");
    }

    if (
      mode === "range" &&
      typeof selected === "object" &&
      "from" in selected
    ) {
      const range = selected as { from?: Date; to?: Date };
      if (
        range.from &&
        format(date, "yyyy-MM-dd") === format(range.from, "yyyy-MM-dd")
      )
        return true;
      if (
        range.to &&
        format(date, "yyyy-MM-dd") === format(range.to, "yyyy-MM-dd")
      )
        return true;
    }

    return false;
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return format(date, "yyyy-MM-dd") === format(today, "yyyy-MM-dd");
  };

  const isDisabled = (date: Date) => {
    if (fromDate && date < fromDate) return true;
    if (toDate && date > toDate) return true;
    if (!disabled) return false;
    if (typeof disabled === "boolean") return disabled;
    if (typeof disabled === "function") return disabled(date);
    return false;
  };

  // Generate multiple months if needed
  const months = [];
  for (let i = 0; i < numberOfMonths; i++) {
    const monthDate = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + i,
      1,
    );
    months.push(format(monthDate, "MMMM yyyy"));
  }

  return (
    <div
      className={`rdp-root ${className || ""}`}
      data-mode={mode}
      role="application"
    >
      <div className={classNames?.months || ""}>
        {months.map((month, index) => (
          <div key={index} className={classNames?.month || ""}>
            <div className={classNames?.caption || ""}>
              <button
                className={classNames?.nav_button_previous || ""}
                onClick={() => {}}
                aria-label="Previous month"
              >
                Previous
              </button>
              <span className={classNames?.caption_label || ""}>{month}</span>
              <button
                className={classNames?.nav_button_next || ""}
                onClick={() => {}}
                aria-label="Next month"
              >
                Next
              </button>
            </div>
            <table role="grid" className={classNames?.table || ""}>
              <thead>
                <tr className={classNames?.head_row || ""}>
                  {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                    <th key={day} className={classNames?.head_cell || ""}>
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from(
                  { length: Math.ceil(days.length / 7) },
                  (_, weekIndex) => (
                    <tr key={weekIndex} className={classNames?.row || ""}>
                      {days
                        .slice(weekIndex * 7, (weekIndex + 1) * 7)
                        .map((day, dayIndex) => {
                          if (!day) return <td key={dayIndex} />;

                          const { date, outside } = day;
                          const selected = isSelected(date);
                          const today = isToday(date);
                          const disabled = isDisabled(date);

                          let dayClassName = classNames?.day || "";
                          if (selected)
                            dayClassName +=
                              " " + (classNames?.day_selected || "");
                          if (today)
                            dayClassName += " " + (classNames?.day_today || "");
                          if (outside) {
                            if (showOutsideDays) {
                              dayClassName +=
                                " " +
                                (classNames?.day_outside || "") +
                                " opacity-50";
                            } else {
                              dayClassName +=
                                " " +
                                (classNames?.day_hidden || "") +
                                " invisible";
                            }
                          }
                          if (disabled)
                            dayClassName +=
                              " " + (classNames?.day_disabled || "");

                          return (
                            <td
                              key={dayIndex}
                              className={classNames?.cell || ""}
                            >
                              <button
                                role="button"
                                aria-selected={selected}
                                aria-label={format(date, "EEEE, MMMM d, yyyy")}
                                className={dayClassName.trim()}
                                onClick={() => handleDateClick(date)}
                                disabled={disabled}
                                {...(props.onKeyDown && {
                                  onKeyDown: (e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      handleDateClick(date);
                                    }
                                    props.onKeyDown(e);
                                  },
                                })}
                              >
                                {date.getDate()}
                              </button>
                            </td>
                          );
                        })}
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        ))}
      </div>
      {footer && <div className="rdp-footer">{footer}</div>}
    </div>
  );
}
