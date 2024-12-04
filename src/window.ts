/* eslint-disable solid/reactivity */
import { sendRequest, getCookie, setCookie } from "@/utils/index";
import isMobileCheck from "./utils/isMobileCheck";
import Config from "./config";
import { PopoutMessageConfig } from "./features/bubble/types";
import { UserConfig } from "./types";

type BotProps = {
  chatflowid: string;
  includeQuestions: boolean;
  loadID?: string;
  userID?: string;
  defaultOpenDesktop?: boolean;
  defaultOpenMobile?: boolean;
  delayOpenFlag?: boolean;
  delayOpenSeconds?: number;
  stayClosedFlag?: boolean;
  apiHost?: string;
  chatflowConfig?: Record<string, unknown>;
  theme?: Record<string, unknown>;
  questions?: Array<string>;
  maxPopups?: number;
  popoutMessageConfig?: PopoutMessageConfig;
  mobileQuestionFontSize?: string;
  desktopQuestionFontSize?: string;
  badgeText?: string;
};

const fetchAndParseBasicConfig = <T extends BotProps>(props: T) => {
  return sendRequest<
    UserConfig & { errorType?: string; errorMessage?: string; body?: any }
  >({
    method: "GET",
    url: `${Config.server.userConfigApiUrl}?username=${props.userID}`,
  }).then((response) => {
    if (!response.data) {
      throw new Error("No response data");
    }
    if (response.data.errorType || !response.data.body) {
      console.error("Fetching config failed", response.data);
      throw new Error(response.data.errorMessage || "No response body");
    }
    const config_data = JSON.parse(response.data.body);

    // prettier-ignore
    // console.log("%c[REALTY-AI-BOT]", "color: #3B81F6; font-weight: bold;", "Config Fetched", config_data);

    props.theme = config_data?.theme;
    props.chatflowid = config_data?.chatflowid;
    props.apiHost = config_data?.apiHost;
    props.includeQuestions = config_data?.includeQuestions;
    props.defaultOpenDesktop = config_data?.defaultOpenDesktop;
    props.defaultOpenMobile = config_data?.defaultOpenMobile;
    props.delayOpenSeconds = config_data?.delayOpenSeconds;
    props.delayOpenFlag = config_data?.delayOpenFlag;
    props.loadID = config_data?.load_id ? config_data?.load_id : "";
    props.stayClosedFlag = config_data?.stayClosedFlag;
    props.questions = config_data?.questions;
    props.badgeText = config_data?.badgeText;
    props.popoutMessageConfig = config_data?.popoutMessage;
    return { props, config_data };
  });
};

const version = "realty-ai-bot-version:2.0";

// prettier-ignore
// console.log("%c[REALTY-AI-BOT]", "color: #3B81F6; font-weight: bold;", version);

export const initFull = (props: BotProps & { id?: string }) => {
  fetchAndParseBasicConfig<BotProps & { id?: string }>(props)
    .then(({ props }) => {
      const fullElement = props.id
        ? document.getElementById(props.id)
        : document.querySelector("realty-ai-fullchatbot-parent");

      if (!fullElement)
        throw new Error("<realty-ai-fullchatbot> element not found.");
      const element = document.createElement("realty-ai-fullchatbot");
      Object.assign(element, props);
      fullElement.appendChild(element);
    })
    .catch((error) => {
      console.error(error);
    });
};

export const init = async (props: BotProps) => {
  fetchAndParseBasicConfig<BotProps>(props)
    .then(({ props, config_data }) => {
      props.maxPopups = config_data?.maxPopups ? config_data?.maxPopups : 0;

      props.mobileQuestionFontSize = config_data?.mobileQuestionFontSize
        ? config_data?.mobileQuestionFontSize
        : "10px";
      props.desktopQuestionFontSize = config_data?.desktopQuestionFontSize
        ? config_data?.desktopQuestionFontSize
        : "20px";

      const no_display = config_data?.no_display;
      const isMobile = isMobileCheck();

      const noMobile = config_data?.noMobile;

      if (no_display) {
        return;
      }

      // prettier-ignore
      // console.log("%c[REALTY-AI-BOT]", "color: #3B81F6; font-weight: bold;", isMobile ? noMobile ? "Disabled on mobile" : "Platform is mobile" : "Platform is desktop");

      if (isMobile && noMobile) {
        return;
      }

      // props.isOpen = props.isOpen || default_open
      const element = document.createElement("realty-ai-chatbot");
      Object.assign(element, props);
      document.body.appendChild(element);
    })
    .catch((error) => {
      console.error(error);
    });
  // TODO: need to add error checking and handling
};

type Chatbot = {
  initFull: typeof initFull;
  init: typeof init;
};

declare const window:
  | {
      Chatbot: Chatbot | undefined;
      innerWidth: number;
    }
  | undefined;

export const parseChatbot = () => ({
  initFull,
  init,
});

export const injectChatbotInWindow = (bot: Chatbot) => {
  if (typeof window === "undefined") return;
  window.Chatbot = { ...bot };
};
