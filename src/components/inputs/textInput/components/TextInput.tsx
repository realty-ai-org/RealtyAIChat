import { SendButton } from "@/components/SendButton";
import { createSignal, onMount } from "solid-js";

type Props = {
  placeholder?: string;
  backgroundColor?: string;
  textColor?: string;
  sendButtonColor?: string;
  defaultValue?: string;
  fontSize?: number;
  onSubmit: (value: string) => void;
  onChange?: (value: string) => void;
};

const defaultBackgroundColor = "#ffffff";
const defaultTextColor = "#303235";

export const TextInput = (props: Props) => {
  const [inputValue, setInputValue] = createSignal(props.defaultValue ?? "");
  let inputRef: HTMLInputElement | HTMLTextAreaElement | undefined;

  onMount(() => {
    if (inputRef) inputRef.focus();
    calculateHeight();
  });

  const handleInput = (e: InputEvent) => {
    const inputValue = (e.currentTarget as HTMLTextAreaElement).value;
    setInputValue(inputValue);
    props.onChange?.(inputValue);
    calculateHeight();
  };

  const checkIfInputIsValid = () =>
    inputValue() !== "" && inputRef?.reportValidity();

  const submit = () => {
    if (checkIfInputIsValid()) props.onSubmit(inputValue());
    setInputValue("");
    calculateHeight();
  };

  const submitWhenEnter = (e: KeyboardEvent) => {
    // Check if IME composition is in progress
    const isIMEComposition = e.isComposing || e.keyCode === 229;
    if (e.key === "Enter" && !isIMEComposition) {
      e.preventDefault(); // Prevent the Enter from adding a newline
      submit();
    }
  };

  const calculateHeight = () => {
    const textarea = inputRef as HTMLTextAreaElement;
    const fontSize = props.fontSize || 16;
    const lineHeight = fontSize * 1.5;
    const padding = 24; // 12px top + 12px bottom
    const minHeight = lineHeight + padding;
    const maxHeight = lineHeight * 6 + padding; // 6 lines max
    
    // Reset height to get accurate measurements
    textarea.style.height = "0px";
    textarea.style.height = "auto";
    
    // Get the natural scroll height
    const scrollHeight = textarea.scrollHeight;
    
    // Calculate the actual content height by subtracting padding
    const contentHeight = scrollHeight - padding;
    const lines = Math.ceil(contentHeight / lineHeight);
    const calculatedHeight = Math.max(lines, 1) * lineHeight + padding;

    if (lines >= 6) {
      textarea.style.paddingRight = `50px`;
    } else {
      textarea.style.paddingRight = `44px`;
    }
    
    // Apply height with min/max constraints
    const newHeight = Math.min(Math.max(calculatedHeight, minHeight), maxHeight);
    textarea.style.height = `${newHeight}px`;
  }

  return (
    <div
      class={
        "absolute bottom-10 left-[20px] right-[20px] chatbot-input"
      }
      style={{
        "z-index": 1000,
        "background-color": props.backgroundColor ?? defaultBackgroundColor,
        color: props.textColor ?? defaultTextColor,
      }}
    >
      <div
        class="relative flex"
        data-testid="input"
        style={{
          "max-height": `${(props.fontSize || 16) * 6 * 1.5 + 24}px`, // 6 lines max
          "min-height": `${(props.fontSize || 16) * 1.5 + 24}px`, // Ensure container matches textarea min height
        }}
        onKeyDown={submitWhenEnter}
      >
        <textarea
          id="realty-ai-chat-input"
          ref={inputRef as HTMLTextAreaElement}
          rows={1}
          class="focus:outline-none bg-transparent w-full text-input"
          style={{
            "font-size": props.fontSize ? `${props.fontSize}px` : "16px",
            "line-height": "1.5",
            "resize": "none",
            "padding-top": "12px",
            "padding-bottom": "12px",
            "padding-left": "16px",
            "padding-right": "48px",
            "overflow-y": "scroll",
            "scrollbar-width": "thin",
            "scrollbar-color": "rgba(0, 0, 0, 0.2) transparent",
            "box-sizing": "border-box",
            "border": "none",
            "outline": "none",
          }}
          onInput={handleInput}
          value={inputValue()}
          placeholder={props.placeholder ?? "Type your question"}
          aria-label="Type your question"
          role="textbox"
        />
      </div>
      <SendButton
        sendButtonColor={props.sendButtonColor}
        type="button"
        class="absolute top-0 right-0"
        style={{
          height: `${(props.fontSize || 16) * 1.5 + 24}px`
        }}
        isDisabled={inputValue() === ""}
        on:click={submit}
      >
        Send
      </SendButton>
    </div>
  );
};
