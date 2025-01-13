import "./Calendar.scss";

import { useEffect, useState } from "react";
import classNames from "classnames";
import moment from "moment";

import Icon, { GoToFirst, ArrowLeft, ArrowRight, GoToLast } from "../Icon/Icon";

import { ICalendarProps } from "./Calendar.types";

export const TODAY = moment();
export const MIN = moment("1970-01-01T00:00:00.000Z");

function Calendar(props: ICalendarProps) {
  const [date, setDate] = useState(
    props.selected?.[1] ? moment(props.selected[1]) : moment(TODAY)
  );

  const [min, setMin] = useState(moment(props.min ?? MIN));
  const [max, setMax] = useState(moment(props.max ?? TODAY));

  let initialSelected: moment.Moment | [moment.Moment, moment.Moment] = moment(
    props.selected ?? TODAY
  );

  if (props.range) {
    if (props.selected) {
      initialSelected = [moment(props.selected[0]), moment(props.selected[1])];
    } else {
      initialSelected = [moment(TODAY).subtract(1, "day"), moment(TODAY)];
    }
  }

  const [selected, setSelected] = useState(initialSelected);
  const [activeIndex, setActiveIndex] = useState<0 | 1>(props.activeIndex ?? 0);

  useEffect(() => {
    if (props.min !== undefined) {
      setMin(moment(props.min));
    }
  }, [props.min]);

  useEffect(() => {
    if (props.max !== undefined) {
      setMax(moment(props.max));
    }
  }, [props.max]);

  useEffect(() => {
    if (props.selected !== undefined) {
      if (Array.isArray(selected) && Array.isArray(props.selected)) {
        const newValue: [moment.Moment, moment.Moment] = [
          moment(props.selected[0]),
          moment(props.selected[1]),
        ];

        if (
          !newValue[0].isSame(selected[0], "days") ||
          !newValue[1].isSame(selected[1], "days")
        ) {
          setSelected(newValue);
          setDate(newValue?.[1] ? moment(newValue[1]) : moment(TODAY));
        }
      } else {
        setSelected(
          props.selected?.[1] ? moment(props.selected[1]) : moment(TODAY)
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.selected]);

  useEffect(() => {
    if (props.activeIndex !== undefined) {
      setActiveIndex(props.activeIndex);
    }
  }, [props.activeIndex]);

  useEffect(() => {
    if (props.onActiveIndexChange) {
      props.onActiveIndexChange(activeIndex);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex]);

  const goPrevious = () => {
    if (canGoPrevious()) {
      setDate(date.subtract(1, "months").clone());
    }
  };

  const goNext = () => {
    if (canGoNext()) {
      setDate(date.add(1, "months").clone());
    }
  };

  const goFirst = () => {
    if (canGoPrevious()) {
      setDate(min.clone());
    }
  };

  const goLast = () => {
    if (canGoNext()) {
      setDate(max.clone());
    }
  };

  const canGoPrevious = () => {
    if (date.year() > min.year()) {
      return true;
    }
    if (date.month() > min.month()) {
      return true;
    }

    return false;
  };

  const canGoNext = () => {
    if (date.year() < max.year()) {
      return true;
    }

    if (date.month() < max.month()) {
      return true;
    }

    return false;
  };

  const isInRange = (
    itemDate: moment.Moment,
    range: [moment.Moment, moment.Moment]
  ) => {
    return (
      itemDate.isSameOrAfter(range[0], "days") &&
      itemDate.isSameOrBefore(range[1], "days")
    );
  };

  const canSelect = (itemDate: moment.Moment) => {
    if (Array.isArray(selected)) {
      if (activeIndex === 1) {
        return isInRange(itemDate, [selected[0], max]);
      }
    }
    return isInRange(itemDate, [min, max]);
  };

  const isSelected = (itemDate: moment.Moment) => {
    if (Array.isArray(selected)) {
      return selected.some((selectedItem) =>
        selectedItem.isSame(itemDate, "days")
      );
    } else {
      return selected.isSame(itemDate, "days");
    }
  };

  const isActive = (itemDate: moment.Moment) => {
    if (Array.isArray(selected)) {
      return selected[activeIndex].isSame(itemDate, "days");
    } else {
      return selected.isSame(itemDate, "days");
    }
  };

  const isHovered = (itemDate: moment.Moment) => {
    if (props.hovered) {
      const hovered = moment(props.hovered);
      const maxSelected = Array.isArray(selected) ? selected[1] : selected;

      if (Array.isArray(selected) && selected[0] === selected[1]) {
        return (
          itemDate.isSameOrBefore(hovered, "days") &&
          itemDate.isAfter(maxSelected, "days") &&
          hovered.isAfter(maxSelected, "days")
        );
      }

      return false;
    }

    return false;
  };

  const select = (itemDate: moment.Moment) => {
    let newSelected: typeof selected;

    if (Array.isArray(selected)) {
      if (selected[0] === selected[1] && itemDate.isAfter(selected[1])) {
        newSelected = [selected[0], itemDate];
      } else {
        newSelected = [itemDate, itemDate];
      }
    } else {
      newSelected = itemDate;
    }

    setSelected(newSelected);

    if (props.onChange) {
      if (Array.isArray(newSelected)) {
        props.onChange([
          moment(newSelected[0]).startOf("second").toISOString(),
          moment(newSelected[1]).startOf("second").toISOString(),
        ]);
      } else {
        props.onChange(moment(newSelected).startOf("second").toISOString());
      }
    }
  };

  const renderCalendar = (currentDate: moment.Moment) => {
    return (
      <div
        className="Calendar"
        onMouseLeave={() => {
          if (props.onHover) {
            props.onHover("");
          }
        }}
      >
        <div className="Head">
          <div className="Navigation">
            <button
              className="NavigationButton First"
              onClick={goFirst}
              data-disabled={!canGoPrevious()}
            >
              <Icon icon={<GoToFirst />} size={16} />
            </button>
            <button
              className="NavigationButton Previous"
              data-disabled={!canGoPrevious()}
              onClick={goPrevious}
            >
              <Icon icon={<ArrowLeft />} size={16} />
            </button>
          </div>
          <div className="MonthAndYear">
            {currentDate.format("MMMM")} {currentDate.format("YYYY")}
          </div>
          <div className="Navigation">
            <button
              className="NavigationButton Next"
              data-disabled={!canGoNext()}
              onClick={goNext}
            >
              <Icon icon={<ArrowRight />} size={16} />
            </button>
            <button
              className="NavigationButton Last"
              data-disabled={!canGoNext()}
              onClick={goLast}
            >
              <Icon icon={<GoToLast />} size={16} />
            </button>
          </div>
        </div>
        <div className="Grid Weekdays">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
            (dayOfWeek) => (
              <div key={dayOfWeek} className="Item">
                {dayOfWeek}
              </div>
            )
          )}
        </div>
        <div className="Grid Days">
          {Array.from({
            length: currentDate.startOf("month").weekday(),
          }).map((_, i) => (
            <div key={i} className="Item Placeholder"></div>
          ))}
          {Array.from({
            length: currentDate.daysInMonth(),
          })
            .map((_, i) => i + 1)
            .map((day) => {
              const itemDate = currentDate.clone().date(day);

              return (
                <button
                  key={itemDate.format("MM/DD/YYYY")}
                  className={classNames("Item", {
                    Selected: isSelected(itemDate),
                    Active: isActive(itemDate),
                    Hover: isHovered(itemDate),
                    First: itemDate
                      .clone()
                      .startOf("month")
                      .isSame(itemDate, "days"),
                    FirstInRange:
                      Array.isArray(selected) &&
                      itemDate.isSame(selected[0], "days"),
                    LastInRange:
                      Array.isArray(selected) &&
                      itemDate.isSame(selected[1], "days"),
                    InRange:
                      Array.isArray(selected) && isInRange(itemDate, selected),
                  })}
                  onClick={() => {
                    if (canSelect(itemDate)) {
                      select(itemDate.clone());
                    } else {
                      select(itemDate.clone());
                    }
                  }}
                  onMouseEnter={() => {
                    if (props.onHover) {
                      props.onHover(itemDate.clone().toISOString());
                    }
                  }}
                  data-disabled={itemDate.isAfter(TODAY)}
                >
                  <div className="Circle">
                    <div
                      className={classNames("Day", {
                        Today: itemDate.isSame(TODAY, "days"),
                      })}
                    >
                      {itemDate.date()}
                    </div>
                  </div>
                </button>
              );
            })}
        </div>
      </div>
    );
  };

  if (props.range) {
    return (
      <div className={classNames("CalendarContainer", { Range: props.range })}>
        {renderCalendar(moment(date).subtract(1, "month"))}
        {renderCalendar(date)}
      </div>
    );
  }

  return renderCalendar(date);
}

export default Calendar;
