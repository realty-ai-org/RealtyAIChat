import isMobileCheck from "@/utils/isMobileCheck";
import { Show, JSX } from "solid-js";
import Config from "@/config";

export const Avatar = (props: {
  src?: string;
  isLive?: boolean;
  liveIcon?: "border" | "dot";
  animate?: boolean;
  style?: JSX.CSSProperties | undefined;
}) => {
  return (
    <figure
      class={
        "flex justify-center items-center rounded-full text-white relative flex-shrink-0 " +
        (isMobileCheck() ? "w-8 h-8 text-sm" : "w-10 h-10 text-xl")
      }
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
        class="rounded-full object-cover w-full h-full"
      />
      <Show when={props.isLive && props.liveIcon === "dot"}>
        <svg
          viewBox="0 0 24 24"
          style="position: absolute;top: 84%;left: 84%;transform: translate(-50%, -50%);height: 33%;width: 33%;"
        >
          <path
            fill="#0df300"
            d="m2 12a10 10 0 1 1 10 10 10 10 0 0 1 -10-10z"
          />
          <path
            fill="#12c92a"
            class={props.animate ? "animate-pulse" : ""}
            d="m2 12a10 10 0 1 1 10 10 10 10 0 0 1 -10-10z"
          />
        </svg>
      </Show>
    </figure>
  );
};
