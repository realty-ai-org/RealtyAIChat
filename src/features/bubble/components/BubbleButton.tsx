import {
  onMount,
  Show,
  createSignal,
  createEffect,
} from "solid-js";
import {
  getContrastingColor,
  getCookie,
  isNotDefined,
  setCookie,
} from "@/utils/index";
import { ButtonTheme, PopoutMessageConfig, PopoutMessageTheme } from "../types";
import isMobileCheck from "@/utils/isMobileCheck";
import { Avatar } from "@/components/avatars/Avatar";
import Config from "@/config";
import { create } from "node:domain";
type Props = ButtonTheme & {
  userID: string;
  isBotOpened: boolean;
  canShowPopout: boolean;
  popoutMessageConfig: PopoutMessageConfig | undefined;
  popoutMessageTheme: PopoutMessageTheme;
  avatarSrc?: string;
  toggleBot: () => void;
  liveIconPosition?: "left" | "right";
};

const defaultButtonColor = "#3B81F6";
const defaultIconColor = "white";
const defaultBottom = 20;
const defaultRight = 20;

export const BubbleButton = (props: Props) => {
  const popout_count_cookie_name = `realty-ai-bot-popout-count-${props.userID}`;
  const isMobile = isMobileCheck();

  const [popoutClosed, setPopoutClosed] = createSignal(false);
  const [popoutShown, setPopoutShown] = createSignal(false);
  const [popoutMessage, setPopoutMessage] = createSignal("");

  var popoutOpenCount = Number(getCookie(popout_count_cookie_name));
  if (!popoutOpenCount) {
    popoutOpenCount = 0;
  }

  const openPopout = () => {
    popoutOpenCount++;
    setCookie(popout_count_cookie_name, popoutOpenCount.toString(), 1 / 48);
    setPopoutShown(true);
    setPopoutMessage(props.popoutMessageTheme.message
      ? props.popoutMessageTheme.message[
          Math.floor(
            Math.random() * props.popoutMessageTheme.message.length
          )
        ]
      : "");
  };

  const closePopout = () => {
    popoutOpenCount = props.popoutMessageConfig?.maxPopouts || 0;
    setPopoutClosed(true);
  };

  // Function to start popout timer
  const startPopoutTimer = () => {
    if (!props.popoutMessageConfig) return;
    if (!(isMobile ? props.popoutMessageConfig.show?.mobile : props.popoutMessageConfig.show?.desktop)) return;``
    if (popoutClosed()) return;
    if (popoutShown()) return;

    if (
      !props.popoutMessageConfig.maxPopouts ||
      popoutOpenCount < props.popoutMessageConfig.maxPopouts
    ) {
      setTimeout(() => {
        if (popoutClosed()) return;
        if (!props.isBotOpened && !popoutShown() && props.canShowPopout) {
          openPopout();
        }
      }, (props.popoutMessageConfig.delay ?? 2) * 1000);
    } else {
      // prettier-ignore
      console.log("%c[REALTY-AI-BOT]", "color: #3B81F6; font-weight: bold;", "MAX POPOUTS REACHED");
    }
  };

  onMount(() => {
    // Only start popout timer if we're allowed to show popouts
    if (props.canShowPopout) {
      startPopoutTimer();
    }

    if (props.popoutMessageTheme.message) {
      setPopoutMessage(props.popoutMessageTheme.message[Math.floor(Math.random() * props.popoutMessageTheme.message.length)]);
    }
  });

  // Watch for changes in canShowPopout and trigger popout timer when it becomes true
  createEffect(() => {
    if (props.canShowPopout && !popoutShown()) {
      startPopoutTimer();
    }
  });

  return (
    <div class="relative">
      <Show when={!props.isBotOpened && popoutShown() && !popoutClosed()}>
        <div
          class="fixed items-end"
          style={{
            "z-index": 42424243,
            right:
              props.position === "right"
                ? `${
                    (props.xOffset ? props.xOffset : defaultRight) +
                    (props.size === "large" ? 58 : 48)
                  }px`
                : undefined,
            left:
              props.position === "left"
                ? `${props.xOffset ? props.xOffset : defaultRight}px`
                : undefined,
            bottom: `${
              (props.bottom ? props.bottom : defaultBottom) +
              (props.size === "large" ? 58 : 48)
            }px`,
          }}
        >
          <div class="w-60 h-32 flex justify-end items-end">
            <div
              class="px-4 py-2 ml-2 whitespace-pre-wrap max-w-full chatbot-host-bubble chatbot-welcome-message relative"
              aria-live="polite"
              style={{
                "background-color":
                  props.popoutMessageTheme.backgroundColor ??
                  Config.theme.messages.bot.defaultBackgroundColor,
                color: getContrastingColor(
                  props.popoutMessageTheme.backgroundColor ??
                    Config.theme.messages.bot.defaultBackgroundColor
                ),
                "box-shadow": "0px 0px 10px 0px rgba(0, 0, 0, 0.1)",
              }}
            >
              {popoutMessage()}
              <button
                onClick={closePopout}
                class={`absolute top-[-6px] right-[-6px] h-5 w-5 flex justify-center items-center cursor-pointer hover:scale-125 active:scale-90 transition-transform duration-100`}
                style={{
                  "z-index": 42424244,
                  "background-color": getContrastingColor(
                    props.popoutMessageTheme.backgroundColor ??
                      Config.theme.messages.bot.defaultBackgroundColor
                  ),
                  color:
                    props.popoutMessageTheme.backgroundColor ??
                    Config.theme.messages.bot.defaultBackgroundColor,
                  "border-radius": "50%",
                }}
              >
                <span style="font-size:11pt">&cross;</span>
              </button>
            </div>
          </div>
        </div>
      </Show>
      <button
        part="button"
        onClick={() => {
          if (!isMobileCheck()) {
            props.toggleBot();
          }
        }}
        onTouchStart={() => {
          if (isMobileCheck()) {
            props.toggleBot();
          }
        }}
        class={
          `fixed shadow-md rounded-full hover:scale-110 active:scale-95 transition-transform duration-200 flex justify-center items-center animate-fade-in` +
          (props.size === "large" ? " w-20 h-20" : " w-16 h-16")
        }
        style={{
          "background-color": props.backgroundColor ?? defaultButtonColor,
          "z-index": 42424242,
          right:
            props.position === "right"
              ? props.xOffset
                ? `${props.xOffset.toString()}px`
                : `${defaultRight}px`
              : undefined,
          left:
            props.position === "left"
              ? props.xOffset
                ? `${props.xOffset.toString()}px`
                : `${defaultRight}px`
              : undefined,
          bottom: props.bottom
            ? `${props.bottom.toString()}px`
            : `${defaultBottom}px`,
          "box-shadow": "0px 0px 10px 0px rgba(0, 0, 0, 0.2)",
        }}
      >
        <Show
          when={props.isBotOpened && isNotDefined(props.customIconSrc)}
          keyed
        >
          <svg
            viewBox="0 0 24 24"
            style={{
              stroke: props.iconColor ?? defaultIconColor,
            }}
            class={
              `stroke-2 fill-transparent absolute duration-200 transition ` +
              (props.isBotOpened
                ? "scale-0 opacity-0"
                : "scale-100 opacity-100") +
              (props.size === "large" ? " w-11" : " w-9")
            }
          >
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
        </Show>
        <Show when={!props.isBotOpened}>
          <Show
            when={props.showAvatar}
            fallback={
              <>
                <Show when={isNotDefined(props.customIconSrc)} keyed>
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    role="presentation"
                    style={{
                      stroke: props.iconColor ?? defaultIconColor,
                    }}
                    class={
                      `stroke-2 fill-transparent absolute duration-200 transition ` +
                      (props.isBotOpened
                        ? "scale-0 opacity-0"
                        : "scale-100 opacity-100") +
                      (props.size === "large" ? " w-11 h-11" : " w-9 h-9")
                    }
                  >
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                  </svg>
                </Show>
                <Show when={props.customIconSrc}>
                  <img
                    src={props.customIconSrc}
                    class={
                      "rounded-full object-cover" +
                      (props.isBotOpened
                        ? "scale-0 opacity-0"
                        : "scale-100 opacity-100") +
                      (props.size === "large" ? " w-11 h-11" : " w-9 h-9")
                    }
                    loading="lazy"
                    decoding="async"
                    role="presentation"
                    aria-hidden="true"
                    alt="Bubble button icon"
                  />
                </Show>
                <div
                  class="live-dot live-dot-animate"
                  role="presentation"
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    top: "84%",
                    left: "84%",
                    transform: "translate(-50%, -50%)",
                    height: "33%",
                    width: "33%",
                  }}
                />
              </>
            }
          >
            <Avatar
              src={props.avatarSrc}
              style={{
                height: "100%",
                width: "100%",
              }}
              liveIcon="dot"
              isLive
              animate
              liveIconPosition={props.liveIconPosition}
            />
          </Show>
        </Show>
        {/* <Show when={!props.isBotOpened && props.customIconSrc}>
          <img
            src={props.customIconSrc}
            class={
              "rounded-full object-cover" +
              (props.isBotOpened
                ? "scale-0 opacity-0"
                : "scale-100 opacity-100") +
              (props.size === "large" ? " w-11 h-11" : " w-9 h-9")
            }
          />
        </Show> */}
        <svg
          viewBox="0 0 24 24"
          style={{ fill: props.iconColor ?? "white" }}
          class={
            `absolute duration-200 transition ` +
            (props.isBotOpened
              ? "scale-100 rotate-0 opacity-100"
              : "scale-0 -rotate-180 opacity-0") +
            (props.size === "large" ? " w-11" : " w-9")
          }
        >
          <path
            fill-rule="evenodd"
            clip-rule="evenodd"
            d="M18.601 8.39897C18.269 8.06702 17.7309 8.06702 17.3989 8.39897L12 13.7979L6.60099 8.39897C6.26904 8.06702 5.73086 8.06702 5.39891 8.39897C5.06696 8.73091 5.06696 9.2691 5.39891 9.60105L11.3989 15.601C11.7309 15.933 12.269 15.933 12.601 15.601L18.601 9.60105C18.9329 9.2691 18.9329 8.73091 18.601 8.39897Z"
          />
        </svg>
      </button>
    </div>
  );
};
