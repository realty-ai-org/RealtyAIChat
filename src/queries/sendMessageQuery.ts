import { MessageType } from "@/components/Bot";
import Config from "@/config";
import { sendRequest } from "@/utils/index";

export type IncomingInput = {
  question: string;
  history: MessageType[];
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

export const sendMessageQuery = ({
  chatflowid,
  apiHost = "http://localhost:3000",
  body,
}: MessageRequest) =>
  sendRequest<any>({
    method: "POST",
    url: `${apiHost}/api/v1/prediction/${chatflowid}`,
    body,
  });

export const sendLogConvoQuery = (convo: ConvoType) =>
  sendRequest<any>({
    method: "POST",
    url: Config.server.messageCollectorApiUrl,
    body: convo,
  });

export const isStreamAvailableQuery = ({
  chatflowid,
  apiHost = "http://localhost:3000",
}: MessageRequest) =>
  sendRequest<any>({
    method: "GET",
    url: `${apiHost}/api/v1/chatflows-streaming/${chatflowid}`,
  });
