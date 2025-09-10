import isMobileCheck from "@/utils/isMobileCheck";
import { Show, JSX } from "solid-js";
import Config from "@/config";

export const Avatar = (props: {
  src?: string;
  isLive?: boolean;
  liveIcon?: "border" | "dot";
  animate?: boolean;
  style?: JSX.CSSProperties | undefined;
  liveIconPosition?: "left" | "right";
  class?: string;
}) => {
  return (
    <figure
      class={
        "flex justify-center items-center rounded-full text-white relative flex-shrink-0 " +
        (props.class || "") +
        (isMobileCheck() ? "w-8 h-8 text-sm" : "w-10 h-10 text-xl")
      }
      aria-hidden="true"
      role="presentation"
      style={{
        ...(props.style || {}),
        ...(props.isLive &&
          props.liveIcon === "border" && {
            border: "3px solid #12c92a",
          }),
      }}
    >
      <img
        src={props.src || Config.bot.defaultAvatarSrc}
        alt="Bot avatar"
        loading="lazy"
        decoding="async"
        role="presentation"
        aria-hidden="true"
        class="rounded-full object-cover w-full h-full"
      />
      <Show when={props.isLive && props.liveIcon === "dot"}>
        <div
          class={`live-dot ${props.animate ? "live-dot-animate" : ""}`}
          aria-hidden="true"
          style={{
            position: "absolute",
            top: "84%",
            left: props.liveIconPosition === "right" ? "84%" : "16%",
            transform: "translate(-50%, -50%)",
            height: "33%",
            width: "33%",
          }}
        />
      </Show>
    </figure>
  );
};
