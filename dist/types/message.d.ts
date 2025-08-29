export declare enum MessageType {
    BotMessage = "apiMessage",
    UserMessage = "userMessage",
    ErrorMessage = "errorMessage"
}
export type Message = {
    message: string;
    type: MessageType;
    timestamp?: string;
    minimumDisplayTime?: number;
    loading?: boolean;
};
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
//# sourceMappingURL=message.d.ts.map