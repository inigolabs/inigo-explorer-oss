import uniqueId from 'lodash/uniqueId';
import { MESSAGE_EVENT_NAME } from './MessagesWrapper.constants';
import { MessageProps } from './MessagesWrapper.types';

export let mounterRef = {
  current: false,
};

const queue: MessageProps[] = [];

export const message = (props: Omit<MessageProps, 'id'>) => {
  const detail: MessageProps = { id: uniqueId('MESSAGE_'), ...props };

  document.dispatchEvent(
    new CustomEvent<MessageProps>(MESSAGE_EVENT_NAME, {
      detail,
    }),
  );

  if (!mounterRef.current) {
    queue.push(detail);
  }
};

export const getQueue = () => queue;
export const clearQueue = () => queue.splice(0, queue.length);
(window as any).message = message;
