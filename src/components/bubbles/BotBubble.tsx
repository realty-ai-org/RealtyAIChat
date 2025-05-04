import { Show, onMount } from "solid-js";
import { Avatar } from "../avatars/Avatar";
import { Marked } from "@ts-stack/markdown";
import { LoadingBubble } from "./LoadingBubble";
import Config from "@/config";

type Props = {
  message: string;
  showAvatar?: boolean;
  avatarSrc?: string;
  backgroundColor?: string;
  textColor?: string;
  loading?: boolean;
  hidden?: boolean;
};

Marked.setOptions({ isNoP: true });

const update_links = (message: string) => {
  const regex = /<a\s+(?:[^>]*?\s+)?href=(["'])(.*?)\1/g;
  //const result = message.match(regex);
  const result = regex.exec(message);

  //IF THE REGEX MATCHES, SPLIT STRINGS BY RESULT THEN COMBINE INTO MESSAGE AGAIN WITH INSERTED VALUE.
  if (result) {
    var split = message.split(result[0]);
    const new_message = split[0] + result[0] + ' target="_blank"' + split[1];
    return new_message;
  }
  return message;
};

export const BotBubble = (props: Props) => {
  let botMessageEl: HTMLDivElement | undefined;

  onMount(() => {
    if (botMessageEl) {
      botMessageEl.innerHTML = update_links(Marked.parse(props.message));
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
            class="px-4 py-2 ml-2 whitespace-pre-wrap max-w-full chatbot-host-bubble"
            data-testid="host-bubble"
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
