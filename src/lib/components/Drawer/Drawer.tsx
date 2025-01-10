import styles from "./Drawer.module.css";
import { DrawerProps } from "./Drawer.types";
import Icon, { Close } from "../Icon/Icon";
import Tooltip from "../Tooltip/Tooltip";
import classNames from "classnames";
import { useEffect } from "react";

// million-ignore
const Drawer = (props: DrawerProps) => {
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (props.visible) {
        const drawer = document.querySelector(`.${styles.drawer}`);

        if (drawer) {
          if (e.composedPath().includes(drawer)) return;
        }

        props.onClose?.();
      }
    }

    function onKeydown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        props.onClose?.();
      }
    }

    window.addEventListener("click", onClick);
    window.addEventListener("keydown", onKeydown);

    return () => {
      window.removeEventListener("click", onClick);
      window.removeEventListener("keydown", onKeydown);
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.onClose, props.visible]);

  return (
    <div
      className={classNames(styles.drawer, { [styles.visible]: props.visible })}
      style={props.style}
    >
      <div
        className={styles.content}
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <div className={styles.header}>
          <div className={styles.title}>
            <Tooltip text={props.title} truncated>
              {props.title}
            </Tooltip>
          </div>
          {props.description && (
            <div className={styles.description}>{props.description}</div>
          )}
          <div className={styles.close} onClick={props.onClose}>
            <Icon icon={<Close />} size={16} />
          </div>
        </div>
        <div className={styles.body}>{props.children}</div>
      </div>
    </div>
  );
};

export default Drawer;
