import "./Loader.scss";
import classNames from "classnames";
import { useEffect, useRef, useState } from "react";
import Lottie, { LottieRef } from "lottie-react";
import light from "./light.json";
import dark from "./dark.json";

export interface ILoaderProps {
  visible: boolean;
  style?: React.CSSProperties;
  label?: string;
  className?: string;
  theme?: "light" | "dark";
}

function Loader(props: ILoaderProps) {
  const timeout = useRef<number>();
  const lottieRef = useRef(null) as LottieRef;
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    lottieRef.current?.pause();
    lottieRef.current?.setSpeed(1.5);
  }, [lottieRef]);

  useEffect(() => {
    clearTimeout(timeout.current);

    if (props.visible) {
      setVisible(true);
      lottieRef.current?.play();
    } else {
      setVisible(false);
      lottieRef.current?.pause();
    }
  }, [props.visible, lottieRef]);

  return (
    <div
      className={classNames("Loader", { Visible: visible }, props.className)}
      style={props.style}
    >
      {props.theme === "light" ? (
        <Lottie animationData={light} loop={true} lottieRef={lottieRef} />
      ) : (
        <Lottie animationData={dark} loop={true} lottieRef={lottieRef} />
      )}
      {props.label && <span className="Label">{props.label}</span>}
    </div>
  );
}

export default Loader;
