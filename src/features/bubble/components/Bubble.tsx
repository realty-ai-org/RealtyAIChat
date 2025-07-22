import {
  createSignal,
  Show,
  splitProps,
  onMount,
  createEffect,
} from "solid-js";
import styles from "../../../assets/index.css";
import { BubbleButton } from "./BubbleButton";
import { BubbleParams } from "../types";
import { Bot, BotProps } from "../../../components/Bot";
import { getCookie, setCookie } from "@/utils/index";
import isMobileCheck from "@/utils/isMobileCheck";
import Config from "@/config";
import { checkChatEngineHeartbeat } from "@/queries/sendMessageQuery";
export type BubbleProps = BotProps & BubbleParams;

export const Bubble = (props: BubbleProps) => {
  const [bubbleProps] = splitProps(props, ["theme", "popoutMessageConfig"]);
  const [popoutConfigProps] = splitProps(props, ["popoutMessageConfig"]);
  const isMobile = isMobileCheck();
  const height_calc = isMobile
    ? "calc(min(350px, max(100% - 100px,275px)))"
    : "calc(min(500px, max(100% - 100px,300px)))";

  let defaultOpen = isMobile
    ? props.defaultOpenMobile
    : props.defaultOpenDesktop;
  // grab cookie to check if bot has been closed before
  const cookie_name = `realty-ai-bot-closed-${props.userID}`;
  const count_cookie_name = `realty-ai-bot-open-count-${props.userID}`;

  const bot_closed_before = getCookie(cookie_name);
  if (bot_closed_before === "true" && props.stayClosedFlag) {
    defaultOpen = false;
  }

  const [isBotOpened, setIsBotOpened] = createSignal(defaultOpen);
  const [isBotStarted, setIsBotStarted] = createSignal(defaultOpen);
  const [isVisible, setIsVisible] = createSignal(true);
  const [visibleCount, setVisibleCount] = createSignal(0);
  const [hasClosed, setHasClosed] = createSignal(false);
  const [isChatFlowAvailableToStream, setIsChatFlowAvailableToStream] =
    createSignal(false);

  var openCount = Number(getCookie(count_cookie_name));
  if (!openCount) {
    openCount = 0;
  }

  const openBot = () => {
    if (!isBotStarted()) setIsBotStarted(true);
    openCount += 1;
    setCookie(count_cookie_name, openCount.toString(), 1 / 48);
    setIsBotOpened(true);
  };

  const timedOpenBot = () => {
    if (props.stayClosedFlag && bot_closed_before === "true") {
      // console.log("No Popup - previously closed");
      return;
    }

    const maxPopups = props.maxPopups ? props.maxPopups : 0;
    if (maxPopups <= openCount && maxPopups > 0) {
      // console.log("Max Popups", maxPopups);
      // console.log("No Popup - exceeded max popups");
      return;
    }

    // console.log(props.delayOpenFlag);
    if (props.delayOpenFlag && !isBotOpened() && !hasClosed()) {
      openBot();
    } else {
      // console.log("No Popup - open and closed already");
    }
  };

  if (props.delayOpenFlag) {
    setTimeout(timedOpenBot, props.delayOpenSeconds * 1000); //convert to mills
  }

  const closeBot = () => {
    setIsBotOpened(false);
    setHasClosed(true);
    setCookie(cookie_name, "true", 1);
  };

  const toggleBot = () => {
    isBotOpened() ? closeBot() : openBot();
    setVisibleCount(0);
  };

  // check if visibility is changing and update count
  const updateVisible = () => {
    setIsVisible(document.visibilityState === "visible");
    if (isVisible() === (document.visibilityState === "visible")) {
      setVisibleCount((x) => Math.min(x + 1, 3));
    }
  };
  // event listener for changes in visibility
  document.addEventListener("visibilitychange", updateVisible);

  // if count is creater than two ie switched tabs twice then close bot window
  createEffect(() => {
    if (visibleCount() > 2) {
      // console.log("closed window because of toggling tab");
      closeBot();
    }
  });

  const checkStreamAvailability = async () => {
    const available = await checkChatEngineHeartbeat(props.apiHost || "");
    setIsChatFlowAvailableToStream(available);
    return available;
  };

  onMount(() => {
    checkStreamAvailability();
  });

  return (
    <Show when={isChatFlowAvailableToStream()}>
      <style>{styles}</style>
      <>
        <link rel="icon" href="data:," />
      </>
      <BubbleButton
        {...bubbleProps.theme?.button}
        userID={props.userID}
        toggleBot={toggleBot}
        isBotOpened={isBotOpened()}
        popoutMessageConfig={popoutConfigProps.popoutMessageConfig}
        popoutMessageTheme={{
          message:
            bubbleProps.theme?.popoutMessage?.message ??
            "Need help? Let's chat!",
          backgroundColor:
            bubbleProps.theme?.popoutMessage?.backgroundColor ??
            Config.theme.popoutMessage.defaultBackgroundColor,
        }}
        position={bubbleProps.theme?.button?.position || "right"}
        showAvatar={bubbleProps.theme?.button?.showAvatar ?? true}
        avatarSrc={bubbleProps.theme?.chatWindow?.botMessage?.avatarSrc}
        liveIconPosition={bubbleProps.theme?.button?.position || "right"}
      />
      <div
        part="bot" //ADD CHANGE TO HIGH LINE BASED ON IS MOBILE
        style={{
          height: bubbleProps.theme?.chatWindow?.height
            ? `${bubbleProps.theme?.chatWindow?.height.toString()}px`
            : height_calc,
          transition:
            "transform 200ms cubic-bezier(0, 1.2, 1, 1), opacity 150ms ease-out",
          "transform-origin": "bottom right",
          transform: isBotOpened() ? "scale3d(1, 1, 1)" : "scale3d(0, 0, 1)",
          "box-shadow": "rgb(0 0 0 / 16%) 0px 5px 40px",
          "background-color":
            bubbleProps.theme?.chatWindow?.backgroundColor || "#ffffff",
          "z-index": 42424242,
        }}
        class={
          `fixed rounded-lg w-full sm:w-[400px] max-h-[704px] overflow-hidden` +
          (isBotOpened() ? " opacity-1" : " opacity-0 pointer-events-none") +
          (props.theme?.button?.size === "large"
            ? " bottom-28"
            : " bottom-24") +
          (props.theme?.button?.position === "right"
            ? " sm:right-5"
            : " sm:left-5")
        }
      >
        <Show when={isBotStarted()}>
          <Bot
            badgeBackgroundColor={
              bubbleProps.theme?.chatWindow?.backgroundColor
            }
            welcomeMessage={bubbleProps.theme?.chatWindow?.welcomeMessage}
            poweredByTextColor={
              bubbleProps.theme?.chatWindow?.poweredByTextColor
            }
            textInput={bubbleProps.theme?.chatWindow?.textInput}
            botMessage={bubbleProps.theme?.chatWindow?.botMessage}
            userMessage={bubbleProps.theme?.chatWindow?.userMessage}
            fontSize={bubbleProps.theme?.chatWindow?.fontSize}
            chatflowid={props.chatflowid}
            chatflowConfig={props.chatflowConfig}
            apiHost={props.apiHost}
            closeBoxFunction={closeBot}
            includeQuestions={props.includeQuestions}
            fullScreen={false}
            userID={props.userID}
            loadID={props.loadID}
            questions={props.questions}
            mobileQuestionFontSize={props.mobileQuestionFontSize}
            desktopQuestionFontSize={props.desktopQuestionFontSize}
            badgeText={props.badgeText}
          />
        </Show>
      </div>
    </Show>
  );
};
