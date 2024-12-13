import { createSignal, createEffect, For, onMount, Show } from "solid-js";
import {
  sendMessageQuery,
  IncomingInput,
  ConvoType,
  sendLogConvoQuery,
  checkChatEngineHeartbeat,
} from "@/queries/sendMessageQuery";
import { TextInput } from "./inputs/textInput";
import { GuestBubble } from "./bubbles/GuestBubble";
import { BotBubble } from "./bubbles/BotBubble";
import { LoadingBubble } from "./bubbles/LoadingBubble";
import { SourceBubble } from "./bubbles/SourceBubble";
import {
  BotMessageTheme,
  PopoutMessageTheme,
  TextInputTheme,
  UserMessageTheme,
} from "@/features/bubble/types";
import { Badge } from "./Badge";
// import socketIOClient, { Socket } from "socket.io-client";
import { Popup } from "@/features/popup";
import { QuestionButton } from "./bubbles/QuestionButton";
import Config from "@/config";
type messageType = "apiMessage" | "userMessage" | "usermessagewaiting";

export type MessageType = {
  message: string;
  type: messageType;
  sourceDocuments?: any;
  streamable?: boolean;
  id?: string;
};

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
  const [sourcePopupOpen, setSourcePopupOpen] = createSignal(false);
  const [sourcePopupSrc, setSourcePopupSrc] = createSignal({});
  const [questionClicked, setQuestionClicked] = createSignal(false);
  // const [socket, setSocket] = createSignal<Socket | null>(null);

  // let socketTimeout: NodeJS.Timeout | null = null;

  const [messages, setMessages] = createSignal<MessageType[]>(
    [
      {
        message: props.welcomeMessage ?? defaultWelcomeMessage,
        type: "apiMessage",
      },
    ],
    { equals: false }
  );
  // const [socketIOClientId, setSocketIOClientId] = createSignal("");
  const [chatEngineAlive, setChatEngineAlive] = createSignal(false);

  const convo_message: ConvoType = {
    messages: [
      {
        text: props.welcomeMessage ? props.welcomeMessage : "",
        type: "bot",
        timestamp: new Date().toISOString(),
      },
    ],
    load_id: props.loadID,
    realtor_id: props.userID,
  };

  sendLogConvoQuery(convo_message);

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

  const updateLastMessage = (text: string) => {
    // resetSocketTimeout();
    setMessages((data) => {
      const updated = data.map((item, i) => {
        if (
          i === data.length - 1 &&
          item.type === "apiMessage" &&
          item.streamable
        ) {
          return { ...item, message: item.message + text };
        }
        return item;
      });
      return [...updated];
    });
  };
  const updateFullMessage = (text: string, id: string) => {
    // resetSocketTimeout();
    setMessages((data) => {
      const updated = data.map((item, i) => {
        if (item.type === "apiMessage" && item.id === id) {
          return { ...item, message: text, streamable: false };
        }
        return item;
      });
      return [...updated];
    });
  };

  const updateLastMessageSourceDocuments = (sourceDocuments: any) => {
    // resetSocketTimeout();
    setMessages((data) => {
      const updated = data.map((item, i) => {
        if (i === data.length - 1) {
          return { ...item, sourceDocuments: sourceDocuments };
        }
        return item;
      });
      return [...updated];
    });
  };

  // Handle errors
  const handleError = (
    message = "Oops! There seems to be an error. Please try again."
  ) => {
    setMessages((prevMessages) => [
      ...prevMessages,
      { message, type: "apiMessage" },
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
      const welcomeMessage = props.welcomeMessage ?? defaultWelcomeMessage;
      const messageList = messages().filter((msg) => !msg?.streamable);
      const message_id = String(Math.random());
      setMessages((prevMessages) => [
        ...prevMessages,
        { message: value, type: "userMessage" },
        { message: "", type: "apiMessage", streamable: true, id: message_id },
      ]);

      // if (!socket()) {
      //   await initializeSocket();
      // }

      const body: IncomingInput = {
        question: value,
        load_id: props.loadID,
        history: messageList,
      };
      if (props.chatflowConfig) body.overrideConfig = props.chatflowConfig;

      // if (isChatFlowAvailableToStream())
      //   body.socketIOClientId = socketIOClientId();
      let bot_resp_time = new Date().toISOString();
      body.page_url = window.location.href;
      // console.log(body);
      const result = await sendMessageQuery({
        chatflowid: props.chatflowid,
        apiHost: props.apiHost,
        body,
      });
      var text = "";
      if (typeof result.data === "object" && "text" in result.data) {
        text = result.data.text;
      } else {
        text = result.data;
      }

      const convo_message: ConvoType = {
        messages: [
          {
            text: value,
            type: "user",
            timestamp: message_send_time,
          },
          {
            text: text,
            type: "bot",
            timestamp: bot_resp_time,
          },
        ],
        load_id: props.loadID,
        realtor_id: props.userID,
      };

      sendLogConvoQuery(convo_message);
      if (result.data) {
        const data = handleVectaraMetadata(result.data);
        if (typeof data === "object" && data.text && data.sourceDocuments) {
          if (!chatEngineAlive()) {
            setMessages((prevMessages) => [
              ...prevMessages,
              {
                message: data.text,
                sourceDocuments: data.sourceDocuments,
                type: "apiMessage",
              },
            ]);
          }
        } else {
          updateFullMessage(text, message_id);
          //if (!isChatFlowAvailableToStream()) setMessages((prevMessages) => [...prevMessages, { message: data, type: 'apiMessage' }])
        }
        setLoading(false);
        setUserInput("");
        scrollToBottom();
      }
      if (result.error) {
        const error = result.error;
        console.error(error);
        const err: any = error;
        const errorData =
          typeof err === "string"
            ? err
            : err.response.data ||
              `${err.response.status}: ${err.response.statusText}`;
        handleError(errorData);
        return;
      }
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

  // const initializeSocket = async () => {
  //   if (socket()) return;
  //   // prettier-ignore
  //   console.log("%c[SOCKET]", "color: #F59302; font-weight: bold;", "Initializing");

  //   const s = socketIOClient(props.apiHost as string);

  //   s.on("connect", () => {
  //     setSocketIOClientId(s.id);

  //     // prettier-ignore
  //     console.log("%c[SOCKET]", "color: #F59302; font-weight: bold;", "Connected", s.id);
  //   });

  //   s.on("start", () => {
  //     // setMessages((prevMessages) => [...prevMessages, { message: '', type: 'apiMessage' }])
  //     // prettier-ignore
  //     console.log("%c[SOCKET]", "color: #F59302; font-weight: bold;", "Started");
  //   });

  //   s.on("sourceDocuments", updateLastMessageSourceDocuments);

  //   s.on("token", updateLastMessage);

  //   s.on("disconnect", () => {
  //     // prettier-ignore
  //     console.log("%c[SOCKET]", "color: #F59302; font-weight: bold;", "Disconnected");
  //     setSocketIOClientId("");
  //     setSocket(null);
  //   });

  //   setSocket(s);

  //   // prettier-ignore
  //   console.log("%c[SOCKET]", "color: #F59302; font-weight: bold;", "Configured");
  // };

  // const cleanupSocket = () => {
  //   const s = socket();
  //   if (s) {
  //     s.disconnect();
  //     setSocket(null);
  //     setSocketIOClientId("");
  //   }
  // };

  createEffect(() => {
    checkStreamAvailability();

    return () => {
      setUserInput("");
      setLoading(false);
      setMessages([
        {
          message: props.welcomeMessage ?? defaultWelcomeMessage,
          type: "apiMessage",
        },
      ]);
      // cleanupSocket();
    };
  });

  // const resetSocketTimeout = () => {
  //   if (socketTimeout) clearTimeout(socketTimeout);
  //   socketTimeout = setTimeout(() => {
  //     // prettier-ignore
  //     console.log("%c[SOCKET]", "color: #F59302; font-weight: bold;", "Closing due to inactivity");
  //     cleanupSocket();
  //   }, Config.bot.socketTimeout);
  // };

  const handleTextInputChange = () => {
    // resetSocketTimeout();
    // initializeSocket();
  };

  const isValidURL = (url: string): URL | undefined => {
    try {
      return new URL(url);
    } catch (err) {
      return undefined;
    }
  };

  const handleVectaraMetadata = (message: any): any => {
    if (message.sourceDocuments && message.sourceDocuments[0].metadata.length) {
      message.sourceDocuments = message.sourceDocuments.map((docs: any) => {
        const newMetadata: { [name: string]: any } = docs.metadata.reduce(
          (newMetadata: any, metadata: any) => {
            newMetadata[metadata.name] = metadata.value;
            return newMetadata;
          },
          {}
        );
        return {
          pageContent: docs.pageContent,
          metadata: newMetadata,
        };
      });
    }
    return message;
  };

  const removeDuplicateURL = (message: MessageType) => {
    const visitedURLs: string[] = [];
    const newSourceDocuments: any = [];

    message = handleVectaraMetadata(message);

    message.sourceDocuments.forEach((source: any) => {
      if (
        isValidURL(source.metadata.source) &&
        !visitedURLs.includes(source.metadata.source)
      ) {
        visitedURLs.push(source.metadata.source);
        newSourceDocuments.push(source);
      } else if (!isValidURL(source.metadata.source)) {
        newSourceDocuments.push(source);
      }
    });
    return newSourceDocuments;
  };

  const clickPrompt = (message: string) => {
    // console.log("clicked the button")
    // console.log(message)
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
                  {message.type === "userMessage" && (
                    <GuestBubble
                      message={message.message}
                      backgroundColor={props.userMessage?.backgroundColor}
                      textColor={props.userMessage?.textColor}
                      showAvatar={props.userMessage?.showAvatar}
                      avatarSrc={props.userMessage?.avatarSrc}
                    />
                  )}
                  {message.type === "apiMessage" && (
                    <BotBubble
                      message={message.message}
                      backgroundColor={props.botMessage?.backgroundColor}
                      textColor={props.botMessage?.textColor}
                      showAvatar={props.botMessage?.showAvatar}
                      avatarSrc={props.botMessage?.avatarSrc}
                      loading={
                        message.message === "" &&
                        loading() &&
                        index() === messages().length - 1
                      }
                    />
                  )}
                  {message.sourceDocuments &&
                    message.sourceDocuments.length && (
                      <div
                        style={{
                          display: "flex",
                          "flex-direction": "row",
                          width: "100%",
                        }}
                      >
                        <For each={[...removeDuplicateURL(message)]}>
                          {(src) => {
                            const URL = isValidURL(src.metadata.source);
                            return (
                              <SourceBubble
                                pageContent={
                                  URL ? URL.pathname : src.pageContent
                                }
                                metadata={src.metadata}
                                onSourceClick={() => {
                                  if (URL) {
                                    window.open(src.metadata.source, "_blank");
                                  } else {
                                    setSourcePopupSrc(src);
                                    setSourcePopupOpen(true);
                                  }
                                }}
                              />
                            );
                          }}
                        </For>
                      </div>
                    )}
                </>
              )}
            </For>
          </div>
          <Show when={!props?.fullScreen}>
            <button class="close-tab-btn" onclick={props.closeBoxFunction}>
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
            onChange={handleTextInputChange}
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
      {sourcePopupOpen() && (
        <Popup
          isOpen={sourcePopupOpen()}
          value={sourcePopupSrc()}
          onClose={() => setSourcePopupOpen(false)}
        />
      )}
    </>
  );
};

type BottomSpacerProps = {
  ref: HTMLDivElement | undefined;
};
const BottomSpacer = (props: BottomSpacerProps) => {
  return <div ref={props.ref} class="w-full h-32" />;
};
