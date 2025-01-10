import styles from "./MessagesWrapper.module.css";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { MessageProps, MessageType } from "./MessagesWrapper.types";
import { MESSAGE_EVENT_NAME } from "./MessagesWrapper.constants";
import classNames from "classnames";
import Icon, { Close, IconCheck } from "../Icon/Icon";
import Button, { ButtonVariant } from "../Buttons/Button";
import { IconClose } from "../Icon/Icon";
import { clearQueue, getQueue, mounterRef } from "./MessagesWrapper.utils";
import { Opacity } from "@mui/icons-material";

const MessagesWrapper = () => {
  const [messages, setMessages] = useState<MessageProps[]>([]);
  const messagesRef = useRef<MessageProps[]>(messages);

  const [messagesRefs, setMessagesRefs] = useState<
    React.MutableRefObject<HTMLDivElement | null>[]
  >([]);

  const removeMessage = (messageToRemove: MessageProps) => {
    setMessages(
      messagesRef.current.filter((message) => message !== messageToRemove)
    );
  };

  const addMessage = (messageToAdd: MessageProps) => {
    const lastMessage = messagesRef.current[messagesRef.current.length - 1];

    if (lastMessage && lastMessage.text === messageToAdd.text) {
      removeMessage(lastMessage);
    }

    setMessages([messageToAdd, ...messagesRef.current]);
  };

  useEffect(() => {
    messagesRef.current = messages;
    setMessagesRefs(messages.map(() => ({ current: null })));
  }, [messages]);

  useEffect(() => {
    function onNotify(ev: CustomEvent<MessageProps>) {
      addMessage(ev.detail);

      setTimeout(() => removeMessage(ev.detail), ev.detail.duration ?? 6000);
    }

    document.addEventListener(MESSAGE_EVENT_NAME, onNotify as EventListener);

    const queue = getQueue();

    if (queue.length) {
      queue.forEach((message) => {
        addMessage(message);

        setTimeout(() => removeMessage(message), message.duration ?? 6000);
      });
    }

    clearQueue();
    mounterRef.current = true;

    return () =>
      document.removeEventListener(
        MESSAGE_EVENT_NAME,
        onNotify as EventListener
      );
  }, []);

  useEffect(() => {
    let top = 0;

    for (let i = 0; i < messagesRefs.length; ++i) {
      const { current: currentElement } = messagesRefs[i];

      if (messagesRefs[i - 1]) {
        const { current: previousElement } = messagesRefs[i - 1];

        if (previousElement) {
          top += previousElement.getBoundingClientRect().height + 24;
        }
      }

      if (currentElement) {
        currentElement.style.top = `${top}px`;
      }
    }
  }, [messagesRefs]);

  return (
    <div className={classNames(styles.wrapper)}>
      <div className={styles.container}>
        <AnimatePresence mode="popLayout">
          {messages.map((message, i) => (
            <motion.div
              key={message.id}
              ref={messagesRefs[i]}
              className={classNames(
                styles.message,
                styles[message.type ?? "success"]
              )}
              initial={{
                translateY: "-100%",
                opacity: 0,
              }}
              animate={{
                translateY: 0,
                opacity: 1,
              }}
              exit={{
                translateY: "-100%",
                opacity: 0,
              }}
              transition={{ duration: 0.3, ease: [0.6, 0.6, 0, 1] }}
              layout
            >
              <div className={styles.icon}>
                {message.type === MessageType.Success && (
                  <Icon icon={<IconCheck />} size={16} />
                )}
                {message.type === MessageType.Error && (
                  <Icon icon={<IconClose />} size={16} />
                )}
              </div>
              <div className={styles.content}>
                <div className={styles.text}>{message.text}</div>
              </div>
              {message.action && (
                <Button
                  className={styles.action}
                  variant={ButtonVariant.Link}
                  onClick={() => {
                    removeMessage(message);
                    message.action!.onClick();
                  }}
                >
                  {message.action.label}
                </Button>
              )}
              <div
                className={styles.close}
                onClick={() => removeMessage(message)}
              >
                <Icon icon={<Close />} size={12} />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default MessagesWrapper;
