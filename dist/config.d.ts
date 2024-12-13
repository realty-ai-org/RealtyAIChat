declare const Config: {
    server: {
        userConfigApiUrl: string;
        messageCollectorApiUrl: string;
    };
    bot: {
        defaultAvatarSrc: string;
        socketTimeout: number;
    };
    theme: {
        messages: {
            bot: {
                defaultBackgroundColor: string;
                defaultTextColor: string;
            };
            user: {
                defaultBackgroundColor: string;
                defaultTextColor: string;
            };
        };
        popoutMessage: {
            defaultBackgroundColor: string;
        };
    };
};
export default Config;
//# sourceMappingURL=config.d.ts.map