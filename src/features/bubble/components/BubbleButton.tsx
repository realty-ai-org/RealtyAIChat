import {
  onMount,
  Show,
  createSignal,
  useTransition,
  createEffect,
} from "solid-js";
import { isNotDefined } from "@/utils/index";
import { ButtonTheme } from "../types";
import isMobileCheck from "@/utils/isMobileCheck";
import { Avatar } from "@/components/avatars/Avatar";
import Config from "@/config";
type Props = ButtonTheme & {
  isBotOpened: boolean;
  popoutMessage: {
    message: string;
    delay?: number;
    backgroundColor?: string;
    textColor?: string;
  };
  avatarSrc?: string;
  toggleBot: () => void;
};

const defaultButtonColor = "#3B81F6";
const defaultIconColor = "white";
const defaultBottom = 20;
const defaultRight = 20;

export const BubbleButton = (props: Props) => {
  const [popoutMessageVisible, setPopoutMessageVisible] = createSignal(false);

  onMount(() => {
    if (props.isBotOpened) {
      setPopoutMessageVisible(false);
    } else {
      setTimeout(() => {
        if (!props.isBotOpened && !popoutMessageVisible()) {
          setPopoutMessageVisible(true);
        }
      }, props.popoutMessage.delay ?? 2000);
    }
  });

  console.log(props.right, props.bottom);

  return (
    <div class="relative">
      <Show when={!props.isBotOpened && popoutMessageVisible()}>
        <div
          class="fixed items-end"
          style={{
            "z-index": 42424243,
            right: `${
              (props.right ? props.right : defaultRight) +
              (props.size === "large" ? 58 : 48)
            }px`,
            bottom: `${
              (props.bottom ? props.bottom : defaultBottom) +
              (props.size === "large" ? 58 : 48)
            }px`,
          }}
        >
          <div class="w-60 h-32 flex justify-end items-end">
            <div
              class="px-4 py-2 ml-2 whitespace-pre-wrap max-w-full chatbot-host-bubble chatbot-welcome-message"
              style={{
                "background-color":
                  props.popoutMessage.backgroundColor ??
                  Config.theme.messages.bot.defaultBackgroundColor,
                color:
                  props.popoutMessage.textColor ??
                  Config.theme.messages.bot.defaultTextColor,
                "box-shadow": "0px 0px 10px 0px rgba(0, 0, 0, 0.1)",
              }}
            >
              {props.popoutMessage.message}
            </div>
          </div>
        </div>
      </Show>
      <button
        part="button"
        onClick={() => {
          if (!isMobileCheck()) {
            props.toggleBot();
            setPopoutMessageVisible(false);
          }
        }}
        onTouchStart={() => {
          if (isMobileCheck()) {
            props.toggleBot();
            setPopoutMessageVisible(false);
          }
        }}
        class={
          `fixed shadow-md rounded-full hover:scale-110 active:scale-95 transition-transform duration-200 flex justify-center items-center animate-fade-in` +
          (props.size === "large" ? " w-20 h-20" : " w-16 h-16")
        }
        style={{
          "background-color": props.backgroundColor ?? defaultButtonColor,
          "z-index": 42424242,
          right: props.right
            ? `${props.right.toString()}px`
            : `${defaultRight}px`,
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
                    alt="Bubble button icon"
                  />
                </Show>
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
