import { Message, MessageType } from "@/components/Bot";
import Config from "@/config";
import { sendRequest } from "@/utils/index";
import { min } from "lodash";

export type IncomingInput = {
  question: string;
  history: Message[];
  load_id: string;
  overrideConfig?: Record<string, unknown>;
  socketIOClientId?: string;
  page_url?: string;
};

export type MessageRequest = {
  chatflowid: string;
  apiHost?: string;
  body?: IncomingInput;
};

interface ServerMessage {
  type: MessageType;
  message: string;
}

type MessageResponseData<T> = {
  messages: Array<T>;
};

export type ConvoMesssage = {
  text: string;
  type: string;
  timestamp: string;
};

export type ConvoType = {
  messages: Array<ConvoMesssage>;
  realtor_id: string;
  load_id: string;
};

const BOT_MESSAGE_TIME_PER_CHARACTER = 1000 / 55; // ms (1000ms / X characters per second)
const BOT_MESSAGE_MIN_TIME = 1000; // ms
const BOT_MESSAGE_MAX_TIME = 6000; // ms

/// Can you send me a response with 8 detailed messages about why Squamish is a great place to live? I want the first three messages to be less than 60 characters. I want the next 2 messages to have between 90 and 120 characters. I want the next 2 messages to have between 150 and 250 characters. I want the last message to be a summary of all the other messages with at least 400 characters.

export const getExpectedMessageTime = (message: ServerMessage) => {
  switch (message.type) {
    case MessageType.UserMessage:
      return 0;
    case MessageType.BotMessage:
      return Math.max(
        Math.min(
          message.message.length * BOT_MESSAGE_TIME_PER_CHARACTER,
          BOT_MESSAGE_MAX_TIME
        ),
        BOT_MESSAGE_MIN_TIME
      );
    default:
      return 0;
  }
};

export const sendMessageQuery = ({
  chatflowid,
  apiHost = "http://localhost:3000",
  body,
}: MessageRequest): Promise<MessageResponseData<Message>> => {
  return new Promise((resolve, reject) => {
    const startTime = new Date().getTime();
    sendRequest<MessageResponseData<ServerMessage>>({
      method: "POST",
      url: `${apiHost}/api/v2/prediction/${chatflowid}`,
      body,
    })
      .then((res) => {
        if (!res.data) {
          reject("No data returned from server");
          return;
        }

        if (res.error) {
          const error = res.error;
          console.error(error);
          const err: any = error;
          const errorData =
            typeof err === "string"
              ? err
              : err.response.data ||
                `${err.response.status}: ${err.response.statusText}`;
          reject(errorData);
          return;
        }

        const responseTime = new Date().getTime();

        const messages = res.data.messages.reduce(
          (acc, message, index) => {
            const expectedMessageTime = Math.max(
              getExpectedMessageTime(message) -
                (index === 0 ? responseTime - startTime : 0),
              0
            );

            const minimumDisplayTime = acc.time + expectedMessageTime;

            acc.messages.push({
              ...message,
              timestamp: new Date(minimumDisplayTime).toISOString(),
              minimumDisplayTime,
              loading: responseTime < minimumDisplayTime,
            });
            acc.time = minimumDisplayTime;
            return acc;
          },
          { time: responseTime, messages: [] } as {
            time: number;
            messages: Message[];
          }
        );

        resolve({ ...res.data, messages: messages.messages });
      })
      .catch((error) => {
        reject(error);
      });
  });
};

// export const isStreamAvailableQuery = ({
//   chatflowid,
//   apiHost = "http://localhost:3000",
// }: MessageRequest): Promise<boolean> =>
//   sendRequest<{ isStreaming: boolean }>({
//     method: "GET",
//     url: `${apiHost}/api/v1/chatflows-streaming/${chatflowid}`,
//   })
//     .then((res) => !!res.data?.isStreaming)
//     .catch((error) => {
//       console.error("Error checking stream availability", error);
//       return false;
//     });

export const checkChatEngineHeartbeat = (apiHost: string): Promise<boolean> =>
  Promise.resolve(true);
// sendRequest<{ is_alive: boolean }>({
//   method: "GET",
//   url: `${apiHost}/api/v1/heartbeat`,
// })
//   .then((res) => !!res.data?.is_alive)
//   .catch((error) => {
//     console.error("Error checking chat engine heartbeat", error);
//     return false;
//   });
