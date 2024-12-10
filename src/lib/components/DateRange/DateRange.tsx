import "./DateRange.scss";

import { useState, useEffect, useRef, useCallback } from "react";
import moment from "moment";
import Calendar, { TODAY, MIN } from "../Calendar/Calendar";
import { IDateRangeProps, ITimeInputProps } from "./DateRange.types";
import Icon, { ArrowDown, ArrowUp, IconCalendar } from "../Icon/Icon";
import classNames from "classnames";

const DEFAULT: [moment.Moment, moment.Moment] = [
  TODAY.clone().subtract(1, "days"),
  TODAY,
];

function TimeInput(props: ITimeInputProps) {
  const [value, _setValue] = useState(props.value ?? [0, 0]);

  const opts = [
    { min: 0, max: 23 },
    { min: 0, max: 59 },
  ];

  const setValue = (newValue: [number, number], notify = true) => {
    if (
      Number.isSafeInteger(newValue[0]) &&
      newValue[0] >= opts[0].min &&
      newValue[0] <= opts[0].max &&
      Number.isSafeInteger(newValue[1]) &&
      newValue[1] >= opts[1].min &&
      newValue[1] <= opts[1].max
    ) {
      _setValue(newValue);

      if (notify) {
        props.onChange?.(newValue);
      }
    }
  };

  useEffect(() => {
    if (props.value) {
      setValue(props.value, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.value]);

  const increment = (index: 0 | 1) => {
    if (index === 0 && value[0] < opts[0].max) {
      setValue([value[0] + 1, value[1]]);
    }
    if (index === 1 && value[1] < opts[1].max) {
      setValue([value[0], value[1] + 1]);
    }
  };

  const decrement = (index: 0 | 1) => {
    if (index === 0 && value[0] > opts[0].min) {
      setValue([value[0] - 1, value[1]]);
    }

    if (index === 1 && value[1] > opts[1].min) {
      setValue([value[0], value[1] - 1]);
    }
  };

  const onInputKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    index: 0 | 1
  ) => {
    const stringValue = e.currentTarget.value;
    let numberValue = Number(stringValue);

    if (/[0-9]/.test(e.key)) {
      if (
        e.currentTarget.selectionStart === 0 &&
        e.currentTarget.selectionEnd === 2
      ) {
        e.currentTarget.value = "";
        numberValue = Number(e.key);
      } else {
        numberValue = Number(stringValue + e.key);
      }
    } else if (e.key === "Backspace") {
      numberValue = Number(stringValue.slice(0, -1));
    }

    if (
      !Number.isSafeInteger(numberValue) ||
      numberValue < opts[index].min ||
      numberValue > opts[index].max
    ) {
      e.preventDefault();
    }

    if (e.key === "ArrowUp") {
      increment(index);
    } else if (e.key === "ArrowDown") {
      decrement(index);
    }
  };

  const onInputChange = (
    e: React.FormEvent<HTMLInputElement>,
    index: 0 | 1
  ) => {
    const stringValue = e.currentTarget.value;
    const numberValue = Number(stringValue);

    if (Number.isSafeInteger(numberValue))
      if (index === 0) {
        setValue([numberValue, value[1]]);
      } else {
        setValue([value[0], numberValue]);
      }
  };

  const stringValue = [value[0].toString(), value[1].toString()];

  if (stringValue[0].length === 1) {
    stringValue[0] = "0" + stringValue[0];
  }

  if (stringValue[1].length === 1) {
    stringValue[1] = "0" + stringValue[1];
  }

  return (
    <div className="TimeInput">
      <div className="Hours">
        <input
          onKeyDown={(e) => onInputKeyDown(e, 0)}
          onInput={(e) => onInputChange(e, 0)}
          onFocus={(e) => e.currentTarget.select()}
          value={stringValue[0]}
        />
        <div className="Arrows">
          <button className="Up" onClick={() => increment(0)}>
            <Icon size={12} icon={<ArrowUp />} />
          </button>
          <button className="Down" onClick={() => decrement(0)}>
            <Icon size={12} icon={<ArrowDown />} />
          </button>
        </div>
      </div>
      <div className="Minutes">
        <input
          onKeyDown={(e) => onInputKeyDown(e, 1)}
          onInput={(e) => onInputChange(e, 1)}
          onFocus={(e) => e.currentTarget.select()}
          value={stringValue[1]}
        />
        <div className="Arrows">
          <button className="Up" onClick={() => increment(1)}>
            <Icon size={12} icon={<ArrowUp />} />
          </button>
          <button className="Down" onClick={() => decrement(1)}>
            <Icon size={12} icon={<ArrowDown />} />
          </button>
        </div>
      </div>
    </div>
  );
}

function DateRange(props: IDateRangeProps) {
  const [min, setMin] = useState(moment(props.min ?? MIN));
  const [max, setMax] = useState(moment(props.max ?? TODAY));
  const [activeIndex, setActiveIndex] = useState<0 | 1>(0);
  const [timeSelected, setTimeSelected] = useState<
    [[number, number], [number, number]]
  >([
    [0, 0],
    [0, 0],
  ]);
  const [dateSelected, _setDateSelected] = useState<
    [moment.Moment, moment.Moment]
  >(
    props.selected
      ? [moment(props.selected[0]), moment(props.selected[1])]
      : DEFAULT
  );
  const [dateHovered, setDateHovered] = useState<moment.Moment | null>(null);

  const setDateSelected = useCallback(
    (value: [moment.Moment, moment.Moment]) => {
      _setDateSelected(value);

      setTimeSelected([
        [0, 0],
        [23, 59],
      ]);
    },
    []
  );

  const inputsRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

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
    if (props.defaultSelected !== undefined) {
      const datesToSelect: [moment.Moment, moment.Moment] = [
        moment(props.defaultSelected[0]),
        moment(props.defaultSelected[1]),
      ];

      if (
        dateSelected === undefined ||
        !dateSelected[0].isSame(datesToSelect[0], "days") ||
        !dateSelected[1].isSame(datesToSelect[1], "days")
      ) {
        setDateSelected(datesToSelect);
      }

      const timeToSelect: [[number, number], [number, number]] = [
        [datesToSelect[0].hours(), datesToSelect[0].minutes()],
        [datesToSelect[1].hours(), datesToSelect[1].minutes()],
      ];

      if (JSON.stringify(timeToSelect) !== JSON.stringify(timeSelected)) {
        setTimeSelected(timeToSelect);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.defaultSelected]);

  useEffect(() => {
    if (props.selected !== undefined) {
      const datesToSelect: [moment.Moment, moment.Moment] = [
        moment(props.selected[0]),
        moment(props.selected[1]),
      ];

      if (
        dateSelected === undefined ||
        !dateSelected[0].isSame(datesToSelect[0], "days") ||
        !dateSelected[1].isSame(datesToSelect[1], "days")
      ) {
        setDateSelected(datesToSelect);
      }

      const timeToSelect: [[number, number], [number, number]] = [
        [dateSelected[0].hours(), dateSelected[0].minutes()],
        [dateSelected[1].hours(), dateSelected[1].minutes()],
      ];

      if (JSON.stringify(timeToSelect) !== JSON.stringify(timeSelected)) {
        setTimeSelected(timeToSelect);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.selected]);

  useEffect(() => {
    if (inputsRefs[0].current && inputsRefs[1].current) {
      inputsRefs[0].current.value = dateSelected[0].format("MM/DD/YYYY");
      inputsRefs[1].current.value = dateSelected[1].format("MM/DD/YYYY");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateSelected, timeSelected]);

  return (
    <div className="DateRange">
      <div className="Inputs">
        <div className={classNames("Input")}>
          <div className="prefixIcon">
            <Icon size={16} icon={<IconCalendar />} />
          </div>
          <input
            ref={inputsRefs[0]}
            className="Field PrefixIcon"
            value={dateSelected[0].format("MM/DD/YYYY")}
            // onFocus={() => setActiveIndex(0)}
            // autoFocus={activeIndex === 0}
            // onKeyPress={(e) => {
            //   if (e.key === "Enter") {
            //     setDateFromInput(e.currentTarget.value, 0);
            //     setActiveIndex(1);
            //     inputsRefs[1].current?.focus();
            //   }
            // }}
            // onBlur={(e) => {
            //   setDateFromInput(e.currentTarget.value, 0);
            // }}
            readOnly
          />
        </div>
        <div className={classNames("Input")}>
          <div className="prefixIcon">
            <Icon size={16} icon={<IconCalendar />} />
          </div>
          <input
            ref={inputsRefs[1]}
            className="Field PrefixIcon"
            value={dateSelected[1].format("MM/DD/YYYY")}
            // onFocus={() => setActiveIndex(1)}
            // autoFocus={activeIndex === 1}
            // onKeyPress={(e) => {
            //   if (e.key === "Enter") {
            //     setDateFromInput(e.currentTarget.value, 1);
            //     setActiveIndex(0);
            //     inputsRefs[0].current?.focus();
            //   }
            // }}
            // onBlur={(e) => {
            //   setDateFromInput(e.currentTarget.value, 1);
            // }}
            readOnly
          />
        </div>
      </div>
      <div className="Calendars">
        <Calendar
          min={min.toISOString()}
          max={max.toISOString()}
          onChange={(selected: string | [string, string]) => {
            const newDateValue: [moment.Moment, moment.Moment] = [
              moment(selected[0]),
              moment(selected[1]),
            ];

            setDateSelected(newDateValue);

            if (props.onChange) {
              const newTimeValue = [
                [0, 0],
                [23, 59],
              ];

              props.onChange([
                moment(newDateValue[0])
                  .hours(newTimeValue[0][0])
                  .minutes(newTimeValue[0][1])
                  .toISOString(),
                moment(newDateValue[1])
                  .hours(newTimeValue[1][0])
                  .minutes(newTimeValue[1][1])
                  .toISOString(),
              ]);
            }
          }}
          selected={[
            dateSelected[0].toISOString(),
            dateSelected[1].toISOString(),
          ]}
          hovered={dateHovered?.toISOString()}
          onHover={(date) => setDateHovered(moment(date))}
          activeIndex={activeIndex}
          onActiveIndexChange={(index) => setActiveIndex(index)}
          range
        />
      </div>
      <div className="TimePickers">
        <div>
          <TimeInput
            value={timeSelected[0]}
            onChange={(value) => {
              setTimeSelected([value, timeSelected[1]]);

              if (props.onChange) {
                props.onChange([
                  moment(dateSelected[0])
                    .hours(value[0])
                    .minutes(value[1])
                    .toISOString(),
                  moment(dateSelected[1])
                    .hours(timeSelected[1][0])
                    .minutes(timeSelected[1][1])
                    .toISOString(),
                ]);
              }
            }}
          />
        </div>
        <div>
          <TimeInput
            value={timeSelected[1]}
            onChange={(value) => {
              setTimeSelected([timeSelected[0], value]);

              if (props.onChange) {
                props.onChange([
                  moment(dateSelected[0])
                    .hours(timeSelected[0][0])
                    .minutes(timeSelected[0][1])
                    .toISOString(),
                  moment(dateSelected[1])
                    .hours(value[0])
                    .minutes(value[1])
                    .toISOString(),
                ]);
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default DateRange;
