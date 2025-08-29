import { createSignal, createEffect, For, onMount, Show } from "solid-js";
import {
  sendMessageQuery,
  checkChatEngineHeartbeat,
} from "@/queries/sendMessageQuery";
import { TextInput } from "./inputs/textInput";
import { GuestBubble } from "./bubbles/GuestBubble";
import { BotBubble } from "./bubbles/BotBubble";
import {
  BotMessageTheme,
  PopoutMessageTheme,
  TextInputTheme,
  UserMessageTheme,
} from "@/features/bubble/types";
import { Badge } from "./Badge";
import { QuestionButton } from "./bubbles/QuestionButton";
import { IncomingInput, Message, MessageType } from "@/types/message";

export type BotProps = {
  chatflowid: string;
  loadID: string;
  userID: string;
  mobileQuestionFontSize: string;
  desktopQuestionFontSize: string;
  includeQuestions?: boolean;
  closeBoxFunction?: () => void;
  apiHost?: string;
  chatflowConfig?: Record<string, unknown>;
  welcomeMessage?: string;
  botMessage?: BotMessageTheme;
  userMessage?: UserMessageTheme;
  popoutMessage?: PopoutMessageTheme;
  textInput?: TextInputTheme;
  poweredByTextColor?: string;
  badgeBackgroundColor?: string;
  fontSize?: number;
  fullScreen?: boolean;
  questions?: Array<string>;
  badgeText?: string;
};

const defaultWelcomeMessage = "Hi there! How can I help?";

export const Bot = (props: BotProps & { class?: string }) => {
  let chatContainer: HTMLDivElement | undefined;
  let bottomSpacer: HTMLDivElement | undefined;
  let botContainer: HTMLDivElement | undefined;

  const [userInput, setUserInput] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const [questionClicked, setQuestionClicked] = createSignal(false);

  const [messages, setMessages] = createSignal<Message[]>(
    [
      {
        message: props.welcomeMessage ?? defaultWelcomeMessage,
        type: MessageType.BotMessage,
        timestamp: new Date().toISOString(),
      },
    ],
    { equals: false }
  );
  const [chatEngineAlive, setChatEngineAlive] = createSignal(false);

  // TODO: Add a function to notify server of load

  onMount(() => {
    if (!bottomSpacer) return;
    setTimeout(() => {
      chatContainer?.scrollTo(0, chatContainer.scrollHeight);
    }, 50);
  });

  const scrollToBottom = () => {
    setTimeout(() => {
      chatContainer?.scrollTo(0, chatContainer.scrollHeight);
    }, 50);
  };

  // Handle errors
  const handleError = (
    message = "Oops! There seems to be an error. Please try again."
  ) => {
    setMessages((prevMessages) => [
      ...prevMessages,
      { message, type: MessageType.ErrorMessage },
    ]);
    setLoading(false);
    setUserInput("");
    scrollToBottom();
  };

  const prepend = (value: any, array: any) => {
    var newArray = array.slice();
    newArray.unshift(value);
    return newArray;
  };

  // Handle form submission
  const handleSubmit = async (value: string) => {
    try {
      setQuestionClicked(true);
      setUserInput(value);

      if (value.trim() === "") {
        return;
      }
      let message_send_time = new Date().toISOString();

      setLoading(true);
      scrollToBottom();
      // Send user question and history to API
      const messageList = messages();
      setMessages((prevMessages) => [
        ...prevMessages,
        {
          message: value,
          type: MessageType.UserMessage,
          timestamp: message_send_time,
        },
      ]);

      const body: IncomingInput = {
        question: value,
        load_id: props.loadID,
        history: messageList,
      };
      if (props.chatflowConfig) body.overrideConfig = props.chatflowConfig;

      body.page_url = window.location.href;

      const result = await sendMessageQuery({
        chatflowid: props.chatflowid,
        apiHost: props.apiHost,
        body,
      }).catch((error) => {
        console.error(error);
        handleError(error);
        return undefined;
      });

      if (!result) return;

      let bot_resp_time = new Date().getTime();

      const newMessages = result.messages.map((message) => ({
        ...message,
        loading: message.minimumDisplayTime
          ? bot_resp_time < message.minimumDisplayTime
          : false,
      }));

      setMessages((prevMessages) => [...prevMessages, ...newMessages]);

      newMessages
        .filter((message) => message.loading && !!message.minimumDisplayTime)
        .forEach((message) => {
          setTimeout(() => {
            console.log("setting loading to false", message);
            setMessages((prevMessages) =>
              prevMessages.map((m) =>
                m.timestamp === message.timestamp &&
                m.message === message.message
                  ? { ...m, loading: false }
                  : m
              )
            );
            scrollToBottom();
          }, message.minimumDisplayTime! - bot_resp_time);
        });

      setLoading(false);
      setUserInput("");
      scrollToBottom();
    } catch (error) {
      console.error(error);
      handleError();
    }
  };

  // Auto scroll chat to bottom
  createEffect(() => {
    if (messages()) scrollToBottom();
  });

  createEffect(() => {
    if (props.fontSize && botContainer)
      botContainer.style.fontSize = `${props.fontSize}px`;
  });

  const checkStreamAvailability = async () => {
    const available = await checkChatEngineHeartbeat(props.apiHost || "");
    setChatEngineAlive(available);
    return available;
  };

  createEffect(() => {
    checkStreamAvailability();

    return () => {
      setUserInput("");
      setLoading(false);
      setMessages([
        {
          message: props.welcomeMessage ?? defaultWelcomeMessage,
          type: MessageType.BotMessage,
        },
      ]);
    };
  });

  const clickPrompt = (message: string) => {
    handleSubmit(message);
    setQuestionClicked(true);
  };

  return (
    <>
      <div
        ref={botContainer}
        class={
          "relative flex w-full h-full text-base overflow-hidden bg-cover bg-center flex-col items-center chatbot-container " +
          props.class
        }
      >
        <div class="flex w-full h-full justify-center">
          <div
            style={{
              "padding-bottom":
                props.includeQuestions && !questionClicked()
                  ? "170px"
                  : "110px",
            }}
            ref={chatContainer}
            class="overflow-y-scroll min-w-full w-full min-h-full px-3 pt-10 relative scrollable-container chatbot-chat-view scroll-smooth"
          >
            <For each={[...messages()]}>
              {(message, index) => (
                <>
                  {message.type === MessageType.UserMessage && (
                    <GuestBubble
                      message={message.message}
                      backgroundColor={props.userMessage?.backgroundColor}
                      textColor={props.userMessage?.textColor}
                      showAvatar={props.userMessage?.showAvatar}
                      avatarSrc={props.userMessage?.avatarSrc}
                    />
                  )}
                  {message.type === MessageType.BotMessage && (
                    <BotBubble
                      message={message.message}
                      backgroundColor={props.botMessage?.backgroundColor}
                      textColor={props.botMessage?.textColor}
                      showAvatar={props.botMessage?.showAvatar}
                      avatarSrc={props.botMessage?.avatarSrc}
                      hidden={
                        message.loading &&
                        messages().findLastIndex((m) => m.loading) !== index()
                      }
                      loading={message.loading}
                    />
                  )}
                  {message.type === MessageType.ErrorMessage && (
                    <div class="bg-red-100 text-red-500 text-sm text-center max-w-[60%] mx-auto px-4 py-2 mb-6 mt-6 rounded-md">
                      {message.message}
                    </div>
                  )}
                </>
              )}
            </For>
            {loading() && (
              <BotBubble
                message={""}
                backgroundColor={props.botMessage?.backgroundColor}
                textColor={props.botMessage?.textColor}
                showAvatar={props.botMessage?.showAvatar}
                avatarSrc={props.botMessage?.avatarSrc}
                loading={true}
              />
            )}
          </div>
          <Show when={!props?.fullScreen}>
            <button
              class="close-tab-btn"
              onclick={props.closeBoxFunction}
              aria-label="Close chat"
              role="button"
            >
              &times;
            </button>
          </Show>
          <Show when={props.includeQuestions && !questionClicked()}>
            <div
              class="question-container flex gap-3 outer-questions"
              style={{
                position: "absolute",
                left: "20px",
                width: "calc(100% - 40px)",
                bottom: "100px",
                // height: '20px',
                margin: "auto",
                "z-index": 1000,
              }}
            >
              {props.questions?.map((item, index) => (
                <QuestionButton
                  question={item}
                  onQuestionClick={clickPrompt}
                  leftOffset="0%"
                  mobileQuestionFontSize={props.mobileQuestionFontSize}
                  desktopQuestionFontSize={props.desktopQuestionFontSize}
                />
              ))}
            </div>
          </Show>
          <TextInput
            backgroundColor={props.textInput?.backgroundColor}
            textColor={props.textInput?.textColor}
            placeholder={props.textInput?.placeholder}
            sendButtonColor={props.textInput?.sendButtonColor}
            fontSize={props.fontSize}
            defaultValue={userInput()}
            onSubmit={handleSubmit}
          />
        </div>

        <Badge
          badgeBackgroundColor={props.badgeBackgroundColor}
          poweredByTextColor={props.poweredByTextColor}
          botContainer={botContainer}
          badgeText={props.badgeText}
        />
        <BottomSpacer ref={bottomSpacer} />
      </div>
    </>
  );
};

type BottomSpacerProps = {
  ref: HTMLDivElement | undefined;
};
const BottomSpacer = (props: BottomSpacerProps) => {
  return <div ref={props.ref} class="w-full h-32" />;
};
