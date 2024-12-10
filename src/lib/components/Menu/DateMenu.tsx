import "./Menu.scss";
import { useEffect, useRef, useState } from "react";
import moment from "moment";
import { IMenuProps, IOptionProps } from "./Menu.types";
import Button from "../Button/Button";
import DateRange from "../DateRange/DateRange";
import { message } from "../MessagesWrapper/MessagesWrapper.utils";
import { MessageType } from "../MessagesWrapper/MessagesWrapper.types";

export const DATE_PREDEFINED_FILTERS = {
  PAST_5_MINUTES: {
    label: "Past 5 Minutes",
    getValue: (from: moment.Moment = moment()) =>
      moment(from).subtract(5, "minutes").toISOString(),
  },
  PAST_30_MINUTES: {
    label: "Past 30 Minutes",
    getValue: (from: moment.Moment = moment()) =>
      moment(from).subtract(30, "minutes").toISOString(),
  },
  PAST_1_HOUR: {
    label: "Past 1 Hour",
    getValue: (from: moment.Moment = moment()) =>
      moment(from).subtract(1, "hours").toISOString(),
  },
  PAST_4_HOUR: {
    label: "Past 4 Hours",
    getValue: (from: moment.Moment = moment()) =>
      moment(from).subtract(4, "hours").toISOString(),
  },
  TODAY: {
    label: "Today",
    getValue: () =>
      moment().set({ hour: 0, minute: 0, second: 0 }).toISOString(),
  },
  PAST_1_DAY: {
    label: "Past 1 Day",
    getValue: (from: moment.Moment = moment()) =>
      moment(from).subtract(1, "days").toISOString(),
  },
  PAST_2_DAYS: {
    label: "Past 2 Days",
    getValue: (from: moment.Moment = moment()) =>
      moment(from).subtract(2, "days").toISOString(),
  },
  PAST_3_DAYS: {
    label: "Past 3 Days",
    getValue: (from: moment.Moment = moment()) =>
      moment(from).subtract(3, "days").toISOString(),
  },
  PAST_7_DAYS: {
    label: "Past 7 Days",
    getValue: (from: moment.Moment = moment()) =>
      moment(from).subtract(7, "days").toISOString(),
  },
  PAST_1_MONTH: {
    label: "Past 1 Month",
    getValue: (from: moment.Moment = moment()) =>
      moment(from).subtract(1, "months").toISOString(),
  },
};

export const DEFAULT_DATE_PREDEFINED_FILTER = "PAST_1_DAY";

function Option(props: IOptionProps) {
  return (
    <div className="MenuOption" onClick={() => props.onClick?.(props.value)}>
      {props.children}
    </div>
  );
}

function Menu(props: IMenuProps) {
  const targetRef = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState<[string, string]>();
  const [optionsStyle, setOptionsStyle] = useState({
    left: 0,
    top: 0,
    minWidth: 0,
  });
  const [key, setKey] = useState(0);

  useEffect(() => {
    const propsValue = props.value as [string, string];
    if (!value || propsValue[0] !== value[0] || propsValue[1] !== value[1]) {
      setValue(propsValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.value]);

  const handleOptionsStyle = () => {
    const { current: targetEl } = targetRef;

    if (targetEl) {
      const targetRect = targetEl.getBoundingClientRect();

      setOptionsStyle({
        left: targetRect.left,
        top: targetRect.bottom + 2,
        minWidth: targetRect.width,
      });
    }
  };

  return (
    <div tabIndex={0} className="Menu Date" onFocus={handleOptionsStyle}>
      <div ref={targetRef}>
        {typeof props.target === "function" ? props.target() : props.target}
      </div>
      <div className="Options" style={optionsStyle}>
        <div className="OptionsContent">
          <div className="OptionsList">
            {Object.entries(DATE_PREDEFINED_FILTERS).map(([key, data]) => (
              <div
                key={key}
                tabIndex={0}
                className="MenuOption"
                onClick={(ev) => {
                  ev.currentTarget.blur();

                  props.onSelect?.(
                    {
                      observedAt_GTEQ: key,
                      observedAt_LTEQ: undefined,
                    },
                    null
                  );
                }}
              >
                {data.label}
              </div>
            ))}
          </div>
          <div className="OptionsCustom">
            <DateRange key={key} onChange={setValue} defaultSelected={value} />
          </div>
        </div>
        <div className="OptionsFooter" tabIndex={1}>
          <div className="OptionsFooterActions">
            <Button
              label="Clear"
              type="link"
              onClick={(ev) => {
                ev.currentTarget.blur();
                setValue(undefined);
                setKey((prev) => prev + 1);
              }}
            />
            <Button
              label="Apply"
              onClick={(ev) => {
                if (value) {
                  if (moment(value[0]).isSameOrAfter(value[1])) {
                    message({
                      type: MessageType.Error,
                      text: "Start date must be before end date",
                    });
                    return;
                  }

                  ev.currentTarget.blur();

                  props.onSelect?.(
                    {
                      observedAt_GTEQ: value[0],
                      observedAt_LTEQ: value[1],
                    },
                    null
                  );
                  (document.activeElement as HTMLElement)?.blur();
                }
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export { Option };
export default Menu;
