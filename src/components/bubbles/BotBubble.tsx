import { Show, onMount } from "solid-js";
import { Avatar } from "../avatars/Avatar";
import { LoadingBubble } from "./LoadingBubble";
import Config from "@/config";
import { parseMarkdownSafely } from "@/utils/safety";

type Props = {
  message: string;
  showAvatar?: boolean;
  avatarSrc?: string;
  backgroundColor?: string;
  textColor?: string;
  loading?: boolean;
  hidden?: boolean;
};

export const BotBubble = (props: Props) => {
  let botMessageEl: HTMLDivElement | undefined;

  onMount(() => {
    if (botMessageEl) {
      botMessageEl.innerHTML = parseMarkdownSafely(props.message);
    }
  });

  const showAvatar = props.showAvatar === undefined ? true : props.showAvatar;
  return (
    <Show when={!props.hidden}>
      <div
        class="flex justify-start mb-2 items-start host-container"
        style={{ "margin-right": "50px" }}
      >
        <Show when={showAvatar}>
          <Avatar src={props.avatarSrc} liveIcon="dot" isLive />
        </Show>
        <Show
          when={!props.loading}
          fallback={
            <LoadingBubble
              backgroundColor={
                props.backgroundColor ??
                Config.theme.messages.bot.defaultBackgroundColor
              }
              textColor={
                props.textColor ?? Config.theme.messages.bot.defaultTextColor
              }
            />
          }
        >
          <span
            ref={botMessageEl}
            class={`px-4 py-2 ${showAvatar ? "ml-2" : ""} whitespace-pre-wrap max-w-full chatbot-host-bubble`}
            data-testid="host-bubble"
            aria-live="polite"
            style={{
              "background-color":
                props.backgroundColor ??
                Config.theme.messages.bot.defaultBackgroundColor,
              color:
                props.textColor ?? Config.theme.messages.bot.defaultTextColor,
            }}
          />
        </Show>
      </div>
    </Show>
  );
};
