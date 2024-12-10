import { useEffect, useMemo, useRef, useState } from "react";
import { capitalize } from "lodash";
import moment from "moment";
import { getQueryParamByName } from "./queryParams";
import { message } from "../components/MessagesWrapper/MessagesWrapper.utils";
import { MessageType } from "../components/MessagesWrapper/MessagesWrapper.types";

export function sortObjectOfObjects(obj: any, sortedKey: string) {
  if (obj) {
    return Object.entries(obj)
      .sort((a: any, b: any) => a[1][sortedKey] - b[1][sortedKey])
      .reduce((result: any, item: any) => {
        const [key, value] = item;
        result[key] = value;
        return result;
      }, {});
  }
  return obj;
}

export function getISOPastTime(time: any) {
  const date = new Date();
  date.setTime(date.getTime() - time.value * 60 * 1000);
  return date.toISOString();
}

export function unCapitalize(str: string) {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

export const download = (filename: string, text: string) => {
  var element = document.createElement("a");
  element.setAttribute(
    "href",
    "data:text/plain;charset=utf-8," + encodeURIComponent(text)
  );
  element.setAttribute("download", filename);

  element.style.display = "none";
  document.body.appendChild(element);

  element.click();

  document.body.removeChild(element);
};

export const isNumber = (value: any) => {
  return !Number.isNaN(parseInt(value));
};
export const numberWithCommas = (value: number): string => {
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

export const processNumberByCommasTemplate = (value: any) => {
  if (isNumber(value)) return numberWithCommas(value);
  return value;
};

export function setCookie(name: string, value: string, days: number = 365) {
  let expires = "";

  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);

    expires = "; expires=" + date.toUTCString();
  }

  if (window.location.hostname.includes("localhost")) {
    document.cookie = name + "=" + (value || "") + expires + "; path=/";
  } else {
    document.cookie =
      name + "=" + (value || "") + expires + "; path=/; domain=inigo.io";
  }
}

const tokenQueryParam =
  window.location.pathname.includes("reset_password") ||
  window.location.pathname.includes("invite")
    ? null
    : getQueryParamByName("token");

if (tokenQueryParam) {
  setCookie("jwtToken", tokenQueryParam);
}

export function getCookie(name: string) {
  const nameEQ = name + "=";
  const ca = document.cookie.split(";");

  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === " ") c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
}

export function removeCookie(name: string) {
  const date = new Date();
  date.setTime(date.getTime() - 1 * 24 * 60 * 60 * 1000);

  const expires = "; expires=" + date.toUTCString();

  document.cookie = name + "=" + expires + "; path=/";
  document.cookie = name + "=" + expires + "; path=/; domain=inigo.io";
}

export function clearCookies(name: string) {
  const date = new Date();
  date.setTime(date.getTime() - 1 * 24 * 60 * 60 * 1000);

  const expires = "; expires=" + date.toUTCString();

  document.cookie = name + "=" + expires + "; path=/";
  document.cookie = name + "=" + expires + "; path=/; domain=inigo.io";
}

export const findNestedObjByKeyValue = (
  data: unknown,
  key: string,
  value: unknown
): object | undefined => {
  let firstFoundedNestedObj;
  JSON.stringify(data, (_, nestedValue) => {
    if (nestedValue && nestedValue[key] === value) {
      firstFoundedNestedObj = nestedValue;
      return null;
    }
    return nestedValue;
  });

  return firstFoundedNestedObj;
};

export function useTimeout(callback: () => void, delay: number) {
  const timeoutRef = useRef<number | null>(null);
  const savedCallback = useRef(callback);
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);
  useEffect(() => {
    const tick = () => savedCallback.current();
    if (typeof delay === "number") {
      timeoutRef.current = window.setTimeout(tick, delay);
      return () => {
        if (timeoutRef.current) {
          window.clearTimeout(timeoutRef.current);
        }
      };
    }
  }, [delay]);

  return timeoutRef;
}

export const timeFilters = [
  {
    name: "last_1_hour",
    label: "Last 1 hour",
    value: 60,
    segments: 60,
    display: "minutes",
    format: "hh:mm",
  },
  {
    name: "last_24_hours",
    label: "Last 24 hours",
    value: 60 * 24,
    segments: 24 * 4,
    display: "hours",
    format: "DD MMM hh:mm",
  },
  {
    name: "last_7_days",
    label: "Last 7 days",
    value: 60 * 7 * 24,
    segments: 7 * 12,
    display: "days",
    format: "DD MMM",
  },
  {
    name: "last_30_days",
    label: "Last 30 days",
    value: 60 * 30 * 24,
    segments: 30 * 4,
    display: "days",
    format: "DD MMM",
  },
  {
    name: "last_60_days",
    label: "Last 60 days",
    value: 60 * 60 * 24,
    segments: 60 * 2,
    display: "days",
    format: "DD MMM",
  },
];

export const formatDateForTheTooltip = (time: number, timeEnd?: number) => {
  if (time && timeEnd) {
    const timeDate = moment(time);
    const timeEndDate = moment(timeEnd);
    const timeWeekDay = timeDate.format("dddd");
    return `${timeWeekDay}, ${timeDate.format(
      "MMM DD hh:mm"
    )} - ${timeEndDate.format("hh:mm")}`;
  }
};

/**
 * @param {object} entireObj
 * @param {string} keyToFind
 * @param {array} valToFind
 * @returns {object} returns nested object that contains key: value
 */
export function findNestedObj(
  entireObj: object,
  keyToFind: string,
  valToFind: any[]
) {
  let foundObj;
  JSON.stringify(entireObj, (_, nestedValue) => {
    if (nestedValue && valToFind.some((v) => nestedValue[keyToFind] === v)) {
      foundObj = nestedValue;
    }
    return nestedValue;
  });
  return foundObj;
}

export function useRouterQuery() {
  const { search } = window.location;

  return useMemo(() => new URLSearchParams(search), [search]);
}

export function useWindowSize() {
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  useEffect(() => {
    function handleResize() {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  return windowSize;
}

function schemaDocFieldTypeToStr(fieldType: any) {
  let result = "";

  if (fieldType.List) {
    result += "[" + schemaDocFieldTypeToStr(fieldType.List) + "]";
  } else {
    result += fieldType.TypeName;
  }

  if (fieldType.Required) {
    result += "!";
  }

  return result;
}

function schemaDocTypeToStr(typeKey: string, type: any, keyword = "type") {
  let result = `${keyword} ${typeKey}`;

  if (type.Implements) {
    result += `implements ${type.Implements}`;
  }

  result += " {\n";

  const fields = type.Fields;

  result += Object.entries(fields)
    .sort((a: any, b: any) => a[1].Index - b[1].Index)
    .map(([fieldKey]) => {
      let field = `\t${fieldKey}`;

      const args = fields[fieldKey].Args;

      if (args) {
        field += "(";
        field += Object.entries(args)
          .sort((a: any, b: any) => a[1].Index - b[1].Index)
          .map(([argKey]) => {
            let arg = `${argKey}: `;

            arg += schemaDocFieldTypeToStr(args[argKey].Type);

            return arg;
          })
          .join(", ");

        field += ")";
      }

      field += ": ";

      field += schemaDocFieldTypeToStr(fields[fieldKey].Type);

      return field;
    })
    .join("\n");

  result += `\n}`;

  return result;
}

function schemaDocTypesToStr(types: any, keyword = "type") {
  return Object.keys(types)
    .map((typeKey) => schemaDocTypeToStr(typeKey, types[typeKey], keyword))
    .join("\n\n");
}

function schemaDocEnumToStr(enumKey: string, enumInfo: any) {
  let result = `enum ${enumKey} {\n`;
  result += Object.entries(enumInfo.Values)
    .map(([_key, value]: [any, any]) => `\t${value.Name}`)
    .join("\n");

  result += `\n}`;

  return result;
}

function schemaDocEnumsToStr(enums: any) {
  return Object.keys(enums)
    .map((enumKey) => schemaDocEnumToStr(enumKey, enums[enumKey]))
    .join("\n\n");
}

export function schemaDocToStr(doc: any, diff?: any) {
  let result: string[] = [];
  let handledDoc: any = {};

  if (diff) {
    Object.keys(diff).forEach((entity) => {
      if (doc[entity]) {
        handledDoc[entity] = {};

        diff[entity].forEach((key: string) => {
          if (doc[entity][key]) {
            handledDoc[entity][key] = doc[entity][key];
          }
        });
      }
    });
  } else {
    handledDoc = doc;
  }

  if (handledDoc.Types) {
    result.push(schemaDocTypesToStr(handledDoc.Types));
  }

  if (handledDoc.Inputs) {
    result.push(schemaDocTypesToStr(handledDoc.Inputs, "input"));
  }
  if (handledDoc.Enums) {
    result.push(schemaDocEnumsToStr(handledDoc.Enums));
  }

  return result.join("\n\n");
}

export const renderEnumValue = (value?: string) => {
  return value ? capitalize(value.replace(/_/gi, " ")) : "-";
};

export const useMap = <TKey, TValue>() => {
  const [map, setMap] = useState(new Map<TKey, TValue>());

  return {
    has: (key: TKey) => map.has(key),
    get: (key: TKey) => map.get(key),
    keys: () => map.keys(),
    values: () => map.values(),
    entries: () => map.entries(),
    set: (key: TKey, value: TValue) => {
      setMap(new Map(map.set(key, value)));
    },
    clear: () => {
      setMap(new Map());
    },
  };
};

export const renderBigNumber = (num: number = 0) => {
  const isFloat = num % 1 !== 0;

  if (isFloat) {
    return num
      .toFixed(2)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

let captchaPassed = true;

export const handleCaptcha = (
  e: React.MouseEvent<HTMLElement, MouseEvent>,
  cb?: () => void
) => {
  if (captchaPassed) {
    if (cb) {
      cb();
    }

    return;
  }

  console.log(e);

  e.preventDefault();

  (window as any).grecaptcha.ready(function () {
    (window as any).grecaptcha
      .execute("6LfsF4UqAAAAACq-7sA3RLb-KvjGsTkpakXd9cLX", { action: "submit" })
      .then(function () {
        captchaPassed = true;

        if (cb) {
          cb();
        } else {
          e.currentTarget.click();
        }
        setCookie("clientRedirectExplorer", "true");

        queueMicrotask(() => {
          captchaPassed = false;
        });
      })
      .catch(() => {
        message({
          type: MessageType.Error,
          text: "Google thinks you are a bot. Please contact us at support@inigo.io.",
        });
      });
  });
};

export const renderDuration = (value?: number, units?: number) => {
  if (value !== undefined) {
    const result: string[] = [];

    const duration = moment.duration(value, "milliseconds");
    const years = Math.round(duration.years());
    const months = Math.round(duration.months());
    const days = Math.round(duration.days());
    const hours = Math.round(duration.hours());
    const minutes = Math.round(duration.minutes());
    const seconds = Math.round(duration.seconds());
    const milliseconds = Math.round(duration.milliseconds());

    if (years) {
      result.push(`${years}y`);
    }
    if (months) {
      result.push(`${months}m`);
    }
    if (days) {
      result.push(`${days}d`);
    }
    if (hours) {
      result.push(`${hours}h`);
    }
    if (minutes) {
      result.push(`${minutes}m`);
    }
    if (seconds) {
      result.push(`${seconds}s`);
    }
    if (milliseconds) {
      result.push(`${milliseconds}ms`);
    }

    return result.length ? result.slice(0, units).join(" ") : "< 1ms";
  }

  return "< 1ms";
};

export const renderResponseSize = (value?: number, units?: number) => {
  if (value !== undefined) {
    const result: string[] = [];

    if (value) {
      result.push(`${value}B`);
    }

    return result.length ? result.slice(0, units).join(" ") : "0B";
  }

  return "0B";
};

export const renderStringWithSearch = (
  value: string,
  searchValue?: string | RegExp | ((str: string) => boolean)
) => {
  if (!searchValue) {
    return value;
  }

  if (searchValue instanceof Function) {
    return searchValue(value) ? (
      <span className="SearchValue">{value}</span>
    ) : (
      value
    );
  }

  if (searchValue instanceof RegExp) {
    return (
      <span
        dangerouslySetInnerHTML={{
          __html: value.replace(
            searchValue,
            (match) => `<span class="SearchValue">${match}</span>`
          ),
        }}
      ></span>
    );
  }

  const index = value.toLowerCase().indexOf(searchValue.toLowerCase());

  if (index === -1) {
    return value;
  }

  return (
    <span>
      {value.slice(0, index)}
      <span className="SearchValue">
        {value.slice(index, index + searchValue.length)}
      </span>
      {value.slice(index + searchValue.length)}
    </span>
  );
};
