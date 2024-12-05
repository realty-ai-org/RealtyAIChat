import { onCleanup, onMount } from "solid-js";

type Props = {
  botContainer: HTMLDivElement | undefined;
  badgeText?: string;
  poweredByTextColor?: string;
  badgeBackgroundColor?: string;
};

const defaultTextColor = "#303235";

export const Badge = (props: Props) => {
  let liteBadge: HTMLAnchorElement | undefined;
  let observer: MutationObserver | undefined;

  const appendBadgeIfNecessary = (mutations: MutationRecord[]) => {
    mutations.forEach((mutation) => {
      mutation.removedNodes.forEach((removedNode) => {
        if (
          "id" in removedNode &&
          liteBadge &&
          removedNode.id == "lite-badge"
        ) {
          // prettier-ignore
          console.warn("%c[REALTY-AI-BOT]", "color: #3B81F6; font-weight: bold;", "Sorry, you can't remove the brand 😅");
          props.botContainer?.append(liteBadge);
        }
      });
    });
  };

  onMount(() => {
    if (!document || !props.botContainer) return;
    observer = new MutationObserver(appendBadgeIfNecessary);
    observer.observe(props.botContainer, {
      subtree: false,
      childList: true,
    });
  });

  onCleanup(() => {
    if (observer) observer.disconnect();
  });

  return (
    <div
      class="w-full h-10 flex items-center justify-center text-center"
      style={{
        "font-size": "13px",
        position: "absolute",
        bottom: 0,
        color: props.poweredByTextColor ?? defaultTextColor,
        "background-color": props.badgeBackgroundColor ?? "#ffffff",
      }}
    >
      {props.badgeText ? (
        <span
          class="leading-4"
          style={{
            "font-weight": "bold",
            color: props.poweredByTextColor ?? defaultTextColor,
          }}
        >
          {props.badgeText}
        </span>
      ) : (
        <span class="leading-4">
          Powered by{" "}
          <a
            ref={liteBadge}
            href={"https://www.realty-ai.ca"}
            target="_blank"
            rel="noopener noreferrer"
            class="lite-badge"
            id="lite-badge"
            style={{
              "font-weight": "bold",
              color: props.poweredByTextColor ?? defaultTextColor,
            }}
          >
            <span>Realty AI</span>
          </a>
        </span>
      )}
    </div>
  );
};
