export type UserConfig = {
  chatflowid: string;
  apiHost: string;
  load_id: string;
  default_open: boolean;
  questions: string[];
  badgeText: string | null;
  popoutMessage: {
    show: {
      desktop: boolean;
      mobile: boolean;
    };
    delay: number;
    maxPopouts: number | null;
  };
  theme: {
    button: {
      backgroundColor: string;
      showAvatar: boolean;
    };
    chatWindow: {
      welcomeMessage: string;
      poweredByTextColor: string;
      botMessage: {
        backgroundColor: string;
      };
      userMessage: {
        backgroundColor: string;
      };
    };
    popoutMessage: {
      message: string;
      backgroundColor: string;
    };
  };
  mobileQuestionFontSize: string;
  desktopQuestionFontSize: string;
  defaultOpenMobile: boolean;
  defaultOpenDesktop: boolean;
  delayOpenFlag: boolean;
  delayOpenSeconds: number;
  stayClosedFlag: boolean;
  includeQuestions: boolean;
  noMobile: boolean;
  maxPopups: number;
  no_display: boolean;
};
