import { Message, MessageType } from "@/components/Bot";
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
export declare const getExpectedMessageTime: (message: ServerMessage) => number;
export declare const sendMessageQuery: ({ chatflowid, apiHost, body, }: MessageRequest) => Promise<MessageResponseData<Message>>;
export declare const checkChatEngineHeartbeat: (apiHost: string) => Promise<boolean>;
export {};
//# sourceMappingURL=sendMessageQuery.d.ts.map