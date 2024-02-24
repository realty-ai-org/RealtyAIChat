declare const chatbot: {
    initFull: (props: {
        chatflowid: string;
        includeQuestions: boolean;
        defaultOpenDesktop?: boolean | undefined;
        defaultOpenMobile?: boolean | undefined;
        delayOpenFlag?: boolean | undefined;
        delayOpenSeconds?: number | undefined;
        apiHost?: string | undefined;
        userID?: string | undefined;
        chatflowConfig?: Record<string, unknown> | undefined;
        theme?: Record<string, unknown> | undefined;
    } & {
        id?: string | undefined;
    }) => void;
    init: (props: {
        chatflowid: string;
        includeQuestions: boolean;
        defaultOpenDesktop?: boolean | undefined;
        defaultOpenMobile?: boolean | undefined;
        delayOpenFlag?: boolean | undefined;
        delayOpenSeconds?: number | undefined;
        apiHost?: string | undefined;
        userID?: string | undefined;
        chatflowConfig?: Record<string, unknown> | undefined;
        theme?: Record<string, unknown> | undefined;
    }) => Promise<void>;
};
export default chatbot;
//# sourceMappingURL=web.d.ts.map