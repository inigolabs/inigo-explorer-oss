import "./Menu.scss";
import React, { useEffect, useRef, useState } from "react";
import { IMenuProps } from "./Menu.types";
import classNames from "classnames";

function Menu(props: React.PropsWithChildren<IMenuProps>) {
  const [isVisible, setIsVisible] = useState(false);
  const targetRef = useRef<HTMLDivElement>(null);

  const [optionsStyle, setOptionsStyle] = useState({
    left: 0,
    top: 0,
    minWidth: 0,
  });

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

  useEffect(() => {
    function onMouseWheel() {
      if (targetRef.current?.children[0] === document.activeElement) {
        setTimeout(() => {
          (targetRef.current?.children[0] as HTMLElement)?.blur();
        }, 100);
      }
    }

    window.addEventListener("mousewheel", onMouseWheel);

    return () => {
      window.removeEventListener("mousewheel", onMouseWheel);
    };
  }, [targetRef]);

  useEffect(() => {
    handleOptionsStyle();
  }, [targetRef]);

  return (
    <div
      tabIndex={0}
      className={classNames("Menu", "Dropdown", {
        visible: isVisible,
      })}
      onMouseEnter={() => {
        if (props.trigger === "hover") {
          handleOptionsStyle();
          setIsVisible(true);
        }
      }}
      onMouseLeave={() => {
        if (props.trigger === "hover") {
          setIsVisible(false);
        }
      }}
      onFocus={() => {
        if (props.trigger === "focus") {
          handleOptionsStyle();
          setIsVisible(true);
        }
      }}
    >
      <div
        ref={targetRef}
        onMouseDown={() => {
          if (props.trigger === "hover") {
            return;
          }
          if (targetRef.current?.children[0] === document.activeElement) {
            setTimeout(() => {
              (targetRef.current?.children[0] as HTMLElement)?.blur();
            }, 100);

            setIsVisible(false);
          } else {
            handleOptionsStyle();
            setIsVisible(true);
          }
        }}
      >
        {typeof props.target === "function"
          ? props.target(isVisible)
          : props.target}
      </div>
      {!props.disableDropdown && (
        <div
          className="Options"
          style={optionsStyle}
          onTransitionEnd={(ev) => {
            const { opacity } = window.getComputedStyle(ev.currentTarget);

            if (!+opacity) {
              setIsVisible(false);
              props.onBlur?.(undefined);
            }
          }}
        >
          <div className="OptionsContent">{props.children}</div>
        </div>
      )}
    </div>
  );
}

export default Menu;
