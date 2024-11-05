import isMobileCheck from "@/utils/isMobileCheck";
import { createEffect, createSignal, Show } from "solid-js";
import { isNotEmpty } from "@/utils/index";
import { DefaultAvatar } from "./DefaultAvatar";
import { JSX } from "solid-js";

export const Avatar = (props: {
  initialAvatarSrc?: string;
  isLive?: boolean;
  liveIcon?: "border" | "dot";
  style?: JSX.CSSProperties | undefined;
}) => {
  const [avatarSrc, setAvatarSrc] = createSignal(props.initialAvatarSrc);

  createEffect(() => {
    if (
      avatarSrc()?.startsWith("{{") &&
      props.initialAvatarSrc?.startsWith("http")
    )
      setAvatarSrc(props.initialAvatarSrc);
  });

  return (
    <Show
      when={isNotEmpty(avatarSrc())}
      keyed
      fallback={
        <DefaultAvatar
          isLive={props.isLive}
          liveIcon={props.liveIcon}
          style={props.style}
        />
      }
    >
      <figure
        class={
          "flex justify-center items-center rounded-full text-white relative flex-shrink-0 " +
          (isMobileCheck() ? "w-6 h-6 text-sm" : "w-10 h-10 text-xl")
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
          src={avatarSrc()}
          alt="Bot avatar"
          class="rounded-full object-cover w-full h-full"
        />
        <Show when={props.isLive && props.liveIcon === "dot"}>
          <svg
            viewBox="0 0 24 24"
            class={isMobileCheck() ? "w-3 h-3" : "w-4 h-4"}
            style="position: absolute;top: 84%;left: 84%;transform: translate(-50%, -50%);"
          >
            <path
              fill="#12c92a"
              d="m2 12a10 10 0 1 1 10 10 10 10 0 0 1 -10-10z"
            />
          </svg>
        </Show>
      </figure>
    </Show>
  );
};
