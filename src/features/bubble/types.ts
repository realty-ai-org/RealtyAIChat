export type BubbleParams = {
  defaultOpenDesktop: boolean;
  defaultOpenMobile: boolean;
  delayOpenFlag: boolean;
  delayOpenSeconds: number;
  stayClosedFlag: boolean;
  theme?: BubbleTheme;
  maxPopups?: number;
  badgeText?: string;
  popoutMessageConfig: PopoutMessageConfig | undefined;
};

export type BubbleTheme = {
  chatWindow?: ChatWindowTheme;
  button?: ButtonTheme;
  popoutMessage?: PopoutMessageTheme;
};

export type PopoutMessageConfig = {
  show?: {
    desktop?: boolean;
    mobile?: boolean;
  };
  delay?: number;
  maxPopouts: number | null;
};

export type TextInputTheme = {
  backgroundColor?: string;
  textColor?: string;
  placeholder?: string;
  sendButtonColor?: string;
};

export type UserMessageTheme = {
  backgroundColor?: string;
  textColor?: string;
  showAvatar?: boolean;
  avatarSrc?: string;
};

export type BotMessageTheme = {
  backgroundColor?: string;
  textColor?: string;
  showAvatar?: boolean;
  avatarSrc?: string;
};

export type PopoutMessageTheme = {
  message?: string[];
  delay?: number;
  backgroundColor?: string;
  textColor?: string;
};

export type ChatWindowTheme = {
  welcomeMessage?: string;
  backgroundColor?: string;
  height?: number;
  width?: number;
  fontSize?: number;
  userMessage?: UserMessageTheme;
  botMessage?: BotMessageTheme;
  textInput?: TextInputTheme;
  poweredByTextColor?: string;
};

export type ButtonTheme = {
  size?: "medium" | "large";
  backgroundColor?: string;
  iconColor?: string;
  customIconSrc?: string;
  bottom?: number;
  xOffset?: number;
  position: "right" | "left";
  showAvatar?: boolean;
};
