import { MessageType } from "@/components/Bot";
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
export declare const sendMessageQuery: ({ chatflowid, apiHost, body, }: MessageRequest) => Promise<{
    data?: any;
    error?: Error | undefined;
}>;
export declare const sendLogConvoQuery: (convo: ConvoType) => Promise<{
    data?: any;
    error?: Error | undefined;
}>;
export declare const checkChatEngineHeartbeat: (apiHost: string) => Promise<boolean>;
//# sourceMappingURL=sendMessageQuery.d.ts.map