export enum MessageType {
  Success = 'success',
  Error = 'error',
}

export interface MessageProps {
  id: string;
  type?: MessageType;
  text: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  duration?: number;
}
