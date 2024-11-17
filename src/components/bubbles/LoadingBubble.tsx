import { TypingBubble } from "@/components";

type Props = {
  backgroundColor: string;
  textColor: string;
};

export const LoadingBubble = (props: Props) => (
  <div class="flex justify-start mb-2 items-start animate-fade-in host-container">
    <span
      class="px-4 py-4 ml-2 whitespace-pre-wrap max-w-full chatbot-host-bubble"
      style={{
        "background-color": props.backgroundColor,
      }}
      data-testid="host-bubble"
    >
      <TypingBubble textColor={props.textColor} />
    </span>
  </div>
);
